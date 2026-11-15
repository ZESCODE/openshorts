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

    model = os.environ.get("FREE_TOOLS_GEMINI_MODEL", "gemini-3.1-flash-lite")
    started = time.time()
    try:
        r = await httpx.AsyncClient(timeout=60).post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
            headers={"x-goog-api-key": key, "Content-Type": "application/json"},
            json={
                "contents": [{"parts": [{"text": "Reply with the single word ok"}]}],
                "generationConfig": {"maxOutputTokens": 64},
            },
        )
        out["generate"] = {"status": r.status_code, "ms": int((time.time() - started) * 1000),
                           "body": r.text[:160]}
    except Exception as exc:  # noqa: BLE001
        out["generate"] = {"error": type(exc).__name__, "ms": int((time.time() - started) * 1000)}

    started = time.time()
    try:
        prompt = free_tools.build_prompt(
            "titles", "How I built a clipper that turns long videos into shorts", "", "creators"
        )
        r = await httpx.AsyncClient(timeout=120).post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
            headers={"x-goog-api-key": key, "Content-Type": "application/json"},
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "responseMimeType": "application/json",
                    "maxOutputTokens": 6000,
                    "temperature": 0.9,
                    "thinkingConfig": {"thinkingLevel": "low"},
                },
            },
        )
        out["generate_big"] = {"status": r.status_code, "ms": int((time.time() - started) * 1000),
                               "chars": len(r.text)}
    except Exception as exc:  # noqa: BLE001
        out["generate_big"] = {"error": type(exc).__name__, "ms": int((time.time() - started) * 1000)}

    started = time.time()
    try:
        import google.genai as genai

        out["sdk_version"] = getattr(genai, "__version__", "?")
        client = genai.Client(api_key=key)
        resp = client.models.generate_content(
            model=model,
            contents="Reply with the single word ok",
            config={"max_output_tokens": 64},
        )
        out["sdk"] = {"ms": int((time.time() - started) * 1000), "text": (resp.text or "")[:40]}
    except Exception as exc:  # noqa: BLE001
        out["sdk"] = {"error": f"{type(exc).__name__}: {exc}"[:200],
                      "ms": int((time.time() - started) * 1000)}
    return out


@app.get("/health")
async def health() -> dict:
    return {"ok": True, "service": "openshorts-tools"}
