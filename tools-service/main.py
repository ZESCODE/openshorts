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


@app.get("/health")
async def health() -> dict:
    return {"ok": True, "service": "openshorts-tools"}
