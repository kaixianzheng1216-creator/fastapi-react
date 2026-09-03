FROM ghcr.nju.edu.cn/astral-sh/uv:0.9.26 AS uv

FROM python:3.14-slim AS dependencies

ENV PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy \
    UV_HTTP_TIMEOUT=120 \
    UV_HTTP_RETRIES=5 \
    PATH="/app/.venv/bin:$PATH"

COPY --from=uv /uv /uvx /bin/

WORKDIR /app

COPY pyproject.toml uv.lock ./
COPY backend/pyproject.toml backend/pyproject.toml

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-dev --package app --no-install-project

FROM dependencies AS collector-dependencies

ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium

RUN sed -i \
    's|deb.debian.org|mirrors.cloud.tencent.com|g' \
    /etc/apt/sources.list.d/debian.sources

RUN apt-get update \
    && apt-get install --yes --no-install-recommends chromium fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

FROM collector-dependencies AS application

ENV EMBEDDING_TOKENIZER=/app/models/bge-m3-tokenizer

COPY backend/scripts/download_embedding_tokenizer.py /tmp/download_embedding_tokenizer.py

RUN python /tmp/download_embedding_tokenizer.py \
    && rm /tmp/download_embedding_tokenizer.py

RUN groupadd --system app \
    && useradd --system --gid app --home-dir /home/app --create-home app

COPY --chown=app:app backend/scripts /app/backend/scripts
COPY --chown=app:app backend/alembic.ini /app/backend/alembic.ini
COPY --chown=app:app backend/alembic /app/backend/alembic
COPY --chown=app:app backend/app /app/backend/app
COPY --chown=app:app data /app/data

WORKDIR /app/backend

USER app

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0"]

FROM collector-dependencies AS data-initializer

COPY backend/scripts /app/backend/scripts
COPY backend/alembic.ini /app/backend/alembic.ini
COPY backend/alembic /app/backend/alembic
COPY backend/app /app/backend/app
COPY data /app/data

WORKDIR /app/backend

CMD ["python", "-m", "scripts.initialize_data_sources"]

FROM application AS runtime
