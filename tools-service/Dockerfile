# Slim image for the three free-tool endpoints only.
# Build context is the repository root:
#   docker build -f tools-service/Dockerfile .
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

COPY tools-service/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# The three modules free_tools needs; nothing else from the backend.
COPY free_tools.py ssrf_guard.py security_utils.py ./
COPY tools-service/main.py /app/main.py

EXPOSE 8000

# Render (and any PaaS) supplies $PORT; fall back to 8000 locally.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips '*'"]
