FROM ghcr.nju.edu.cn/astral-sh/uv:0.9.26 AS uv

FROM python:3.14-slim AS dependencies

ENV PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy \
    UV_DEFAULT_INDEX=https://mirrors.aliyun.com/pypi/simple/ \
    UV_HTTP_TIMEOUT=120 \
    UV_HTTP_RETRIES=5 \
    PATH="/app/.venv/bin:$PATH"

COPY --from=uv /uv /uvx /bin/

WORKDIR /app

COPY pyproject.toml uv.lock ./
COPY backend/pyproject.toml backend/pyproject.toml

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-dev --package app

FROM dependencies AS collector-dependencies

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-dev --package app --extra collector \
    && playwright install --with-deps --only-shell chromium

FROM dependencies AS application

COPY backend/scripts /app/backend/scripts
COPY backend/alembic.ini /app/backend/alembic.ini
COPY backend/alembic /app/backend/alembic
COPY backend/app /app/backend/app
COPY data /app/data

WORKDIR /app/backend

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
