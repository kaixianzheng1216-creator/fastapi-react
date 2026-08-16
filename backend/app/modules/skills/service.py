import stat
import uuid
import zipfile
from io import BytesIO
from pathlib import PurePosixPath

import frontmatter
from deepagents.backends import StoreBackend
from langgraph.store.base import BaseStore, SearchItem
from pydantic import JsonValue, TypeAdapter, ValidationError
from yaml import YAMLError

from app.modules.skills.exceptions import (
    SkillAlreadyExistsError,
    SkillInvalidError,
    SkillMdTooLargeError,
    SkillNotFoundError,
    SkillZipTooLargeError,
)
from app.modules.skills.schemas import (
    SkillFileNodePublic,
    SkillMdRequest,
    SkillMetadata,
    SkillPublic,
    SkillSummaryPublic,
)

SKILL_NAMESPACE = "skills"

MAX_SKILL_MD_SIZE = 10 * 1024 * 1024  # 10 MiB
MAX_ZIP_SIZE = 10 * 1024 * 1024  # 10 MiB
MAX_ZIP_FILE_COUNT = 100  # files
MAX_ZIP_CONTENT_SIZE = 20 * 1024 * 1024  # 20 MiB
STORE_SEARCH_PAGE_SIZE = 100  # items per page
FRONTMATTER_ADAPTER = TypeAdapter(dict[str, JsonValue])


async def create_md_skill(
    *,
    store: BaseStore,
    user_id: uuid.UUID,
    request: SkillMdRequest,
) -> SkillPublic:
    metadata = SkillMetadata(name=request.name, description=request.description)

    skill_md = frontmatter.dumps(
        frontmatter.Post(
            request.content,
            **metadata.model_dump(),
        ),
        sort_keys=False,
    ).encode()

    if len(skill_md) > MAX_SKILL_MD_SIZE:
        raise SkillMdTooLargeError

    files = {"SKILL.md": skill_md}

    await _create_skill(
        store=store,
        user_id=user_id,
        skill_name=metadata.name,
        files=files,
    )

    return _to_public(metadata, request.content, files)


async def create_zip_skill(
    *,
    store: BaseStore,
    user_id: uuid.UUID,
    zip_content: bytes,
) -> SkillPublic:
    if len(zip_content) > MAX_ZIP_SIZE:
        raise SkillZipTooLargeError

    metadata, content, files = _read_skill_zip(zip_content)

    await _create_skill(
        store=store,
        user_id=user_id,
        skill_name=metadata.name,
        files=files,
    )

    return _to_public(metadata, content, files)


async def list_skills(
    *,
    store: BaseStore,
    user_id: uuid.UUID,
    offset: int,
    limit: int,
    search: str | None = None,
) -> tuple[list[SkillSummaryPublic], int]:
    items = await _search_user_skill_items(store=store, user_id=user_id)

    skill_md_paths: list[str] = []

    for item in items:
        if item.key.endswith("/SKILL.md"):
            skill_md_paths.append(item.key)

    skill_md_paths.sort()

    if not skill_md_paths:
        return [], 0

    backend = _get_store_backend(store=store, user_id=user_id)
    downloads = await backend.adownload_files(skill_md_paths)

    skills: list[SkillSummaryPublic] = []

    for download in downloads:
        if download.content is None:
            raise SkillNotFoundError

        metadata, _content = _parse_skill_md(download.content)

        skills.append(
            SkillSummaryPublic(
                name=metadata.name,
                description=metadata.description,
            )
        )

    if search is not None:
        normalized_search = search.casefold()

        filtered_skills: list[SkillSummaryPublic] = []

        for skill in skills:
            if (
                normalized_search in skill.name.casefold()
                or normalized_search in skill.description.casefold()
            ):
                filtered_skills.append(skill)

        skills = filtered_skills

    return skills[offset : offset + limit], len(skills)


async def get_skill(
    *,
    store: BaseStore,
    user_id: uuid.UUID,
    skill_name: str,
) -> SkillPublic:
    items = await _get_skill_items(
        store=store,
        user_id=user_id,
        skill_name=skill_name,
    )

    prefix = f"/{skill_name}/"

    paths: list[str] = []

    for item in items:
        paths.append(item.key)

    paths.sort()

    backend = _get_store_backend(store=store, user_id=user_id)

    downloads = await backend.adownload_files(paths)

    files: dict[str, bytes] = {}

    for download in downloads:
        if download.content is None:
            raise SkillNotFoundError

        files[download.path.removeprefix(prefix)] = download.content

    metadata, content = _parse_skill_md(files["SKILL.md"])

    return _to_public(metadata, content, files)


async def get_skill_file(
    *,
    store: BaseStore,
    user_id: uuid.UUID,
    skill_name: str,
    file_path: str,
) -> bytes:
    normalized_path = _normalize_relative_path(file_path)

    namespace = get_skill_namespace(user_id)

    skill_md_path = f"/{skill_name}/SKILL.md"

    if await store.aget(namespace, skill_md_path) is None:
        raise SkillNotFoundError

    backend = _get_store_backend(store=store, user_id=user_id)

    store_path = f"/{skill_name}/{normalized_path}"

    download = (await backend.adownload_files([store_path]))[0]

    if download.content is None:
        raise SkillNotFoundError

    return download.content


async def delete_skill(
    *,
    store: BaseStore,
    user_id: uuid.UUID,
    skill_name: str,
) -> None:
    items = await _get_skill_items(
        store=store,
        user_id=user_id,
        skill_name=skill_name,
    )

    namespace = get_skill_namespace(user_id)

    skill_md_path = f"/{skill_name}/SKILL.md"

    await store.adelete(namespace, skill_md_path)

    for item in items:
        if item.key == skill_md_path:
            continue

        await store.adelete(namespace, item.key)


async def download_user_skill_files(
    *,
    store: BaseStore,
    user_id: uuid.UUID,
) -> list[tuple[str, bytes]]:
    items = await _search_user_skill_items(store=store, user_id=user_id)

    completed_skill_prefixes: set[str] = set()

    for item in items:
        if item.key.endswith("/SKILL.md"):
            completed_skill_prefixes.add(item.key.removesuffix("SKILL.md"))

    if not completed_skill_prefixes:
        return []

    paths: list[str] = []

    for item in items:
        for skill_prefix in completed_skill_prefixes:
            if item.key.startswith(skill_prefix):
                paths.append(item.key)
                break

    paths.sort()

    backend = _get_store_backend(store=store, user_id=user_id)

    downloads = await backend.adownload_files(paths)

    files: list[tuple[str, bytes]] = []

    for download in downloads:
        if download.content is None:
            raise SkillNotFoundError

        files.append((download.path, download.content))

    return files


def get_skill_namespace(user_id: uuid.UUID) -> tuple[str, str]:
    return SKILL_NAMESPACE, str(user_id)


def _read_skill_zip(
    zip_content: bytes,
) -> tuple[SkillMetadata, str, dict[str, bytes]]:
    try:
        with zipfile.ZipFile(BytesIO(zip_content)) as skill_zip:
            files: dict[PurePosixPath, bytes] = {}
            total_size = 0

            for entry in skill_zip.infolist():
                if stat.S_ISLNK(entry.external_attr >> 16):
                    raise SkillInvalidError

                if entry.is_dir():
                    continue

                if len(files) >= MAX_ZIP_FILE_COUNT:
                    raise SkillInvalidError

                path = _normalize_zip_path(entry.filename)

                if path in files:
                    raise SkillInvalidError

                total_size += entry.file_size

                if total_size > MAX_ZIP_CONTENT_SIZE:
                    raise SkillZipTooLargeError

                file_content = skill_zip.read(entry)

                files[path] = file_content

            skill_md_paths: list[PurePosixPath] = []

            for path in files:
                if path.name == "SKILL.md":
                    skill_md_paths.append(path)

            if len(skill_md_paths) != 1:
                raise SkillInvalidError

            skill_md_path = skill_md_paths[0]

            if len(skill_md_path.parts) > 2:
                raise SkillInvalidError

            skill_root = skill_md_path.parent

            metadata, content = _parse_skill_md(files[skill_md_path])

            if skill_root != PurePosixPath(".") and skill_root.name != metadata.name:
                raise SkillInvalidError

            skill_files: dict[str, bytes] = {}

            for path, file_content in files.items():
                try:
                    relative_path = path.relative_to(skill_root)
                except ValueError:
                    raise SkillInvalidError from None

                skill_files[relative_path.as_posix()] = file_content

            _build_file_tree(skill_files)

            return metadata, content, skill_files
    except zipfile.BadZipFile, RuntimeError:
        raise SkillInvalidError from None


def _normalize_zip_path(file_path: str) -> PurePosixPath:
    normalized_path = PurePosixPath(file_path.replace("\\", "/"))

    if (
        normalized_path == PurePosixPath(".")
        or normalized_path.is_absolute()
        or ".." in normalized_path.parts
    ):
        raise SkillInvalidError

    return normalized_path


def _parse_skill_md(skill_md: bytes) -> tuple[SkillMetadata, str]:
    if len(skill_md) > MAX_SKILL_MD_SIZE:
        raise SkillMdTooLargeError

    try:
        post = frontmatter.loads(skill_md.decode("utf-8-sig"))
        metadata = SkillMetadata.model_validate(post.metadata)
        FRONTMATTER_ADAPTER.validate_python(metadata.model_dump())

        return metadata, post.content
    except UnicodeDecodeError, YAMLError, ValidationError:
        raise SkillInvalidError from None


def _build_file_tree(files: dict[str, bytes]) -> list[SkillFileNodePublic]:
    file_paths: set[PurePosixPath] = set()
    directory_paths: set[PurePosixPath] = set()

    for path in files:
        file_path = PurePosixPath(path)
        file_paths.add(file_path)

        for parent in file_path.parents:
            if parent == PurePosixPath("."):
                break

            directory_paths.add(parent)

    if directory_paths.intersection(file_paths):
        raise SkillInvalidError

    def build_children(parent: PurePosixPath) -> list[SkillFileNodePublic]:
        child_directories: list[PurePosixPath] = []
        child_files: list[PurePosixPath] = []

        for directory_path in directory_paths:
            if directory_path.parent == parent:
                child_directories.append(directory_path)

        for file_path in file_paths:
            if file_path.parent == parent:
                child_files.append(file_path)

        child_directories.sort(key=lambda path: path.name.casefold())
        child_files.sort(key=lambda path: path.name.casefold())

        nodes: list[SkillFileNodePublic] = []

        for directory_path in child_directories:
            nodes.append(
                SkillFileNodePublic(
                    name=directory_path.name,
                    path=directory_path.as_posix(),
                    type="folder",
                    children=build_children(directory_path),
                )
            )

        for file_path in child_files:
            nodes.append(
                SkillFileNodePublic(
                    name=file_path.name,
                    path=file_path.as_posix(),
                    type="file",
                )
            )

        return nodes

    return build_children(PurePosixPath("."))


async def _create_skill(
    *,
    store: BaseStore,
    user_id: uuid.UUID,
    skill_name: str,
    files: dict[str, bytes],
) -> None:
    namespace = get_skill_namespace(user_id)
    skill_md_path = f"/{skill_name}/SKILL.md"

    if await store.aget(namespace, skill_md_path) is not None:
        raise SkillAlreadyExistsError

    backend = _get_store_backend(store=store, user_id=user_id)
    upload_files: list[tuple[str, bytes]] = []

    for path, content in files.items():
        if path != "SKILL.md":
            upload_files.append((f"/{skill_name}/{path}", content))

    if upload_files:
        uploads = await backend.aupload_files(upload_files)

        if any(upload.error is not None for upload in uploads):
            raise RuntimeError("Skill 文件写入失败")

    skill_md_upload = (
        await backend.aupload_files([(skill_md_path, files["SKILL.md"])])
    )[0]

    if skill_md_upload.error is not None:
        raise RuntimeError("SKILL.md 写入失败")


async def _search_user_skill_items(
    *,
    store: BaseStore,
    user_id: uuid.UUID,
) -> list[SearchItem]:
    namespace = get_skill_namespace(user_id)

    items: list[SearchItem] = []

    offset = 0

    while batch := await store.asearch(
        namespace,
        limit=STORE_SEARCH_PAGE_SIZE,
        offset=offset,
    ):
        items.extend(batch)

        offset += len(batch)

    return items


async def _get_skill_items(
    *,
    store: BaseStore,
    user_id: uuid.UUID,
    skill_name: str,
) -> list[SearchItem]:
    prefix = f"/{skill_name}/"
    items: list[SearchItem] = []
    has_skill_md = False

    user_skill_items = await _search_user_skill_items(store=store, user_id=user_id)

    for item in user_skill_items:
        if not item.key.startswith(prefix):
            continue

        items.append(item)

        if item.key == f"{prefix}SKILL.md":
            has_skill_md = True

    if not has_skill_md:
        raise SkillNotFoundError

    return items


def _normalize_relative_path(file_path: str) -> str:
    normalized_path = PurePosixPath(file_path)

    if (
        not file_path
        or "\\" in file_path
        or normalized_path.is_absolute()
        or ".." in normalized_path.parts
    ):
        raise SkillNotFoundError

    return normalized_path.as_posix()


def _get_store_backend(*, store: BaseStore, user_id: uuid.UUID) -> StoreBackend:
    namespace = get_skill_namespace(user_id)

    return StoreBackend(store=store, namespace=lambda _runtime: namespace)


def _to_public(
    metadata: SkillMetadata,
    content: str,
    files: dict[str, bytes],
) -> SkillPublic:
    return SkillPublic(
        frontmatter=metadata.model_dump(),
        content=content,
        file_count=len(files),
        files=_build_file_tree(files),
    )
