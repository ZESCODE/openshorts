"""Slim free-tools service.

Serves the three anonymous endpoints that live in ``free_tools.py`` without
pulling in torch, ffmpeg or the rest of the OpenShorts backend:

    GET  /api/tools/youtube-transcript
    GET  /api/tools/tiktok-transcript
    POST /api/tools/youtube-metadata
    GET  /health

``free_tools`` only needs the stdlib plus FastAPI/pydantic at import time;
yt-dlp, the SSRF guard and the Gemini SDK are imported inside the handlers.
"""
from fastapi import FastAPI

import free_tools

app = FastAPI(title="OpenShorts free tools", version="1.0.0")
app.include_router(free_tools.router)


@app.get("/diag")
async def diag() -> dict:
    """Temporary probe: can this instance reach Gemini at all?"""
    import os
    import time

    import httpx

    key = os.environ.get("GEMINI_API_KEY", "")
    out: dict = {"key": bool(key), "model": os.environ.get("FREE_TOOLS_GEMINI_MODEL", "")}
    for label, url in (
        ("models", "https://generativelanguage.googleapis.com/v1beta/models"),
        ("youtube", "https://www.youtube.com/robots.txt"),
    ):
        started = time.time()
        try:
            r = await httpx.AsyncClient(timeout=15).get(
                url, headers={"x-goog-api-key": key} if key else {}
            )
            out[label] = {"status": r.status_code, "ms": int((time.time() - started) * 1000)}
        except Exception as exc:  # noqa: BLE001
            out[label] = {"error": type(exc).__name__, "ms": int((time.time() - started) * 1000)}
    return out


@app.get("/health")
async def health() -> dict:
    return {"ok": True, "service": "openshorts-tools"}
