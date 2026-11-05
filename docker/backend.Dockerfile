# ローカル開発専用（Vercel では使わない）。ソースは docker-compose.yml でマウントする
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# 依存だけ先に入れる（pyproject.toml の dependencies + dev）
COPY pyproject.toml ./
RUN pip install '.[dev]'

EXPOSE 8000
CMD ["uvicorn", "backend.app:app", "--reload", "--host", "0.0.0.0", "--port", "8000"]
