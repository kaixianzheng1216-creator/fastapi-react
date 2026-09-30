import time
import uuid

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
from app.modules.knowledge.config import settings

POLL_INTERVAL_SECONDS = 3
ASR_BASE_URL = "https://openspeech.bytedance.com/api/v3/auc/bigmodel"
ASR_RESOURCE_ID = "volc.seedasr.auc"
ASR_SUCCESS_CODE = "20000000"
ASR_PENDING_CODES = {"20000001", "20000002"}
LAS_BASE_URL = "https://operator.las.cn-beijing.volces.com/api/v1"


class MediaParsingError(Exception):
    pass


class _MediaSegment(BaseModel):
    """音视频文本片段，时间单位为毫秒。"""

    text: str
    start_time: int = Field(ge=0)
    end_time: int = Field(ge=0)
    speaker: str | None = Field(
        default=None, validation_alias=AliasPath("additions", "speaker")
    )


def parse_media_document(
    *, document_id: uuid.UUID, stored_file: StoredFile
) -> DoclingDocument:
    """按文件类型解析音频或视频文档。"""
    if stored_file.content_type in VIDEO_CONTENT_TYPES:
        return _parse_video(stored_file)

    return _parse_audio(document_id=document_id, stored_file=stored_file)


def _parse_audio(*, document_id: uuid.UUID, stored_file: StoredFile) -> DoclingDocument:
    if not settings.VOLC_ASR_API_KEY.get_secret_value():
        raise MediaParsingError("请配置 VOLC_ASR_API_KEY 后处理音频文件")

    segments = _transcribe_audio(
        audio_url=object_storage.create_download_url(stored_file.object_key),
        audio_format=AUDIO_FORMAT_BY_CONTENT_TYPE[stored_file.content_type],
        user_id=str(document_id),
    )

    document = DoclingDocument(name=stored_file.filename)

    document.add_title(stored_file.filename)

    for segment in segments:
        text = segment.text.strip()

        if not text:
            continue

        if segment.speaker:
            speaker = f"说话人 {segment.speaker}"
        else:
            speaker = "说话人未标注"

        time_range = f"{_format_timestamp(segment.start_time)}–{_format_timestamp(segment.end_time)}"

        document.add_text(
            label=DocItemLabel.PARAGRAPH,
            text=f"{time_range} · {speaker}\n{text}",
            orig=text,
            source=TrackSource(
                start_time=segment.start_time / 1000,
                end_time=segment.end_time / 1000,
                voice=speaker,
            ),
        )

    if len(document.texts) == 1:
        raise MediaParsingError("音视频中没有可索引的内容")

    return document


def _transcribe_audio(
    *, audio_url: str, audio_format: str, user_id: str
) -> list[_MediaSegment]:
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
            time.sleep(POLL_INTERVAL_SECONDS)

            response = client.post(f"{ASR_BASE_URL}/query", json={})

            if _check_asr_status(response, allow_pending=True) == ASR_SUCCESS_CODE:
                segments: list[_MediaSegment] = []

                for utterance in response.json()["result"]["utterances"]:
                    segments.append(_MediaSegment.model_validate(utterance))

                return segments


def _check_asr_status(response: httpx.Response, *, allow_pending: bool = False) -> str:
    status_code: str = response.headers.get("X-Api-Status-Code", "")

    response.raise_for_status()

    if status_code != ASR_SUCCESS_CODE and not (
        allow_pending and status_code in ASR_PENDING_CODES
    ):
        raise MediaParsingError(f"火山 ASR 处理失败（状态码：{status_code or '缺失'}）")

    return status_code


class _VideoScene(BaseModel):
    """LAS 音画片段，时间单位为秒。"""

    text: str = Field(validation_alias="description")
    start_time: float = Field(ge=0, validation_alias=AliasPath("timeRange", "start"))
    end_time: float = Field(ge=0, validation_alias=AliasPath("timeRange", "end"))


class _VideoEvent(BaseModel):
    scenes: list[_VideoScene] = Field(validation_alias="actionsScenes")


class _VideoResult(BaseModel):
    events: list[_VideoEvent]


def _parse_video(stored_file: StoredFile) -> DoclingDocument:
    segments = _analyze_video(
        object_storage.create_download_url(stored_file.object_key)
    )

    document = DoclingDocument(name=stored_file.filename)

    document.add_title(stored_file.filename)

    for segment in segments:
        text = segment.text.strip()

        if not text:
            continue

        time_range = f"{_format_timestamp(segment.start_time)}–{_format_timestamp(segment.end_time)}"

        document.add_text(
            label=DocItemLabel.PARAGRAPH,
            text=f"{time_range}\n{text}",
            orig=text,
            source=TrackSource(
                start_time=segment.start_time / 1000,
                end_time=segment.end_time / 1000,
            ),
        )

    if len(document.texts) == 1:
        raise MediaParsingError("音视频中没有可索引的内容")

    return document


def _analyze_video(video_url: str) -> list[_MediaSegment]:
    if not settings.VOLC_LAS_API_KEY.get_secret_value():
        raise MediaParsingError("请配置 VOLC_LAS_API_KEY 后处理视频文件")

    request = {
        "operator_id": "las_video_understanding",
        "operator_version": "v1",
        "data": {
            "video_url": video_url,
            "task_template": "omni_video_audio_captioning@v1",
            "model_name": "doubao-seed-2-0-lite-260428",
        },
    }
    headers = {
        "Authorization": f"Bearer {settings.VOLC_LAS_API_KEY.get_secret_value()}"
    }

    with httpx.Client(timeout=30, headers=headers) as client:
        response = client.post(f"{LAS_BASE_URL}/submit", json=request)

        _check_las_status(response)

        task_id = response.json()["metadata"]["task_id"]

        while True:
            time.sleep(POLL_INTERVAL_SECONDS)

            response = client.post(
                f"{LAS_BASE_URL}/poll",
                json={
                    "operator_id": request["operator_id"],
                    "operator_version": request["operator_version"],
                    "task_id": task_id,
                },
            )

            if _check_las_status(response) == "COMPLETED":
                result = _VideoResult.model_validate_json(
                    response.json()["data"]["final_summary"]
                )

                segments: list[_MediaSegment] = []

                for event in result.events:
                    for scene in event.scenes:
                        segments.append(
                            _MediaSegment(
                                text=scene.text,
                                start_time=round(scene.start_time * 1000),
                                end_time=round(scene.end_time * 1000),
                            )
                        )

                return segments


def _check_las_status(response: httpx.Response) -> str:
    response.raise_for_status()

    metadata = response.json()["metadata"]
    task_status: str = metadata["task_status"]

    if metadata["business_code"] != "0" or task_status not in (
        "PENDING",
        "RUNNING",
        "COMPLETED",
    ):
        raise MediaParsingError(f"火山 LAS 处理失败：{metadata['error_msg']}")

    return task_status


def _format_timestamp(milliseconds: int) -> str:
    minutes, remainder = divmod(milliseconds, 60_000)

    seconds, milliseconds = divmod(remainder, 1000)

    return f"{minutes:02d}:{seconds:02d}.{milliseconds:03d}"
