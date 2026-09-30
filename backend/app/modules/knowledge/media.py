import subprocess
import time
import uuid

import ffmpeg  # type: ignore[import-untyped]
import httpx
from docling_core.types.doc.common.source import TrackSource
from docling_core.types.doc.document import DoclingDocument
from docling_core.types.doc.labels import DocItemLabel
from pydantic import AliasPath, BaseModel, Field

from app.modules.files import object_storage
from app.modules.files.constants import (
    AUDIO_FORMAT_BY_CONTENT_TYPE,
    VIDEO_CONTENT_TYPES,
)
from app.modules.files.models import StoredFile
from app.modules.files.service import cleanup_objects
from app.modules.knowledge.config import settings
from app.modules.knowledge.documents import document_audio_key

ASR_BASE_URL = "https://openspeech.bytedance.com/api/v3/auc/bigmodel"
ASR_RESOURCE_ID = "volc.seedasr.auc"
ASR_SUCCESS = "20000000"
ASR_PENDING = {"20000001", "20000002"}
ASR_POLL_INTERVAL_SECONDS = 3


class MediaParsingError(Exception):
    pass


class _Segment(BaseModel):
    text: str
    start_time: int = Field(ge=0)
    end_time: int = Field(ge=0)
    speaker: str | None = Field(
        default=None, validation_alias=AliasPath("additions", "speaker")
    )


def parse_media_document(
    *, document_id: uuid.UUID, stored_file: StoredFile
) -> DoclingDocument:
    """在现有文档任务内转写音视频，返回可缓存、切片和导出 MD 的文档。"""
    if not settings.VOLC_ASR_API_KEY.get_secret_value():
        raise MediaParsingError("请配置 VOLC_ASR_API_KEY 后处理音视频文件")

    is_video = stored_file.content_type in VIDEO_CONTENT_TYPES

    if is_video:
        audio_key = document_audio_key(document_id)
        audio_format = "mp3"
    else:
        audio_key = stored_file.object_key
        audio_format = AUDIO_FORMAT_BY_CONTENT_TYPE[stored_file.content_type]

    try:
        if is_video:
            _extract_audio(stored_file, audio_key)

        segments = _transcribe_audio(
            audio_url=object_storage.create_download_url(audio_key),
            audio_format=audio_format,
            user_id=str(document_id),
        )

        document = DoclingDocument(name=stored_file.filename)

        document.add_title(stored_file.filename)

        for segment in segments:
            text = segment.text.strip()

            if not text:
                continue

            if segment.end_time < segment.start_time:
                raise MediaParsingError("火山 ASR 返回的段落时间无效")

            if segment.speaker:
                speaker_label = f"说话人 {segment.speaker}"
            else:
                speaker_label = "说话人未标注"

            document.add_text(
                label=DocItemLabel.PARAGRAPH,
                text=(
                    f"{_format_time(segment.start_time)}–{_format_time(segment.end_time)} · {speaker_label}\n"
                    f"{text}"
                ),
                orig=text,
                source=TrackSource(
                    start_time=segment.start_time / 1000,
                    end_time=segment.end_time / 1000,
                    voice=speaker_label,
                ),
            )

        if len(document.texts) == 1:
            raise MediaParsingError("音视频中没有可识别的语音内容")

        return document
    finally:
        if is_video:
            cleanup_objects([audio_key])


def _extract_audio(stored_file: StoredFile, audio_key: str) -> None:
    """提取第一条音轨为 MP3；不解码或重编码视频画面。"""
    audio = ffmpeg.input(object_storage.create_download_url(stored_file.object_key))[
        "a:0"
    ].output("pipe:1", format="mp3")

    try:
        result = subprocess.run(
            ffmpeg.compile(audio),
            stdin=subprocess.DEVNULL,
            check=True,
            capture_output=True,
            timeout=120,
        )
    except FileNotFoundError:
        raise MediaParsingError("视频转写需要安装 FFmpeg") from None
    except subprocess.CalledProcessError:
        raise MediaParsingError("无法提取视频音轨，请确认视频有效且包含声音") from None
    except subprocess.TimeoutExpired:
        raise MediaParsingError("视频音轨提取超时") from None

    object_storage.write_object_content(
        object_key=audio_key,
        content=result.stdout,
        content_type="audio/mpeg",
    )


def _transcribe_audio(
    *, audio_url: str, audio_format: str, user_id: str
) -> list[_Segment]:
    headers = {
        "X-Api-Key": settings.VOLC_ASR_API_KEY.get_secret_value(),
        "X-Api-Resource-Id": ASR_RESOURCE_ID,
        "X-Api-Request-Id": str(uuid.uuid4()),
    }

    with httpx.Client(timeout=30, headers=headers) as client:
        response = client.post(
            f"{ASR_BASE_URL}/submit",
            headers={"X-Api-Sequence": "-1"},
            json={
                "user": {"uid": user_id},
                "audio": {"url": audio_url, "format": audio_format},
                "request": {
                    "model_name": "bigmodel",
                    "show_utterances": True,
                    "enable_speaker_info": True,
                    "ssd_version": "300",
                },
            },
        )

        _check_asr_status(response)

        while True:
            time.sleep(ASR_POLL_INTERVAL_SECONDS)

            response = client.post(f"{ASR_BASE_URL}/query", json={})

            if _check_asr_status(response, allow_pending=True) == ASR_SUCCESS:
                segments: list[_Segment] = []

                for item in response.json()["result"]["utterances"]:
                    segments.append(_Segment.model_validate(item))

                return segments

def _check_asr_status(response: httpx.Response, *, allow_pending: bool = False) -> str:
    status: str = response.headers.get("X-Api-Status-Code", "")

    response.raise_for_status()

    if status != ASR_SUCCESS and not (allow_pending and status in ASR_PENDING):
        raise MediaParsingError(f"火山 ASR 处理失败（状态码：{status or '缺失'}）")

    return status


def _format_time(milliseconds: int) -> str:
    minutes, remainder = divmod(milliseconds, 60_000)

    seconds, milliseconds = divmod(remainder, 1000)

    return f"{minutes:02d}:{seconds:02d}.{milliseconds:03d}"
