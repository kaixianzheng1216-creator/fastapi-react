FROM python:3.14-slim

ENV PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy \
    PATH="/app/.venv/bin:$PATH"

COPY --from=ghcr.io/astral-sh/uv:0.9.26 /uv /uvx /bin/

WORKDIR /app

COPY pyproject.toml uv.lock ./
COPY backend/pyproject.toml backend/pyproject.toml

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-dev --package app

COPY backend/scripts /app/backend/scripts
COPY backend/alembic.ini /app/backend/alembic.ini
COPY backend/alembic /app/backend/alembic
COPY backend/app /app/backend/app

WORKDIR /app/backend

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0"]
