# Render free-tools service (`openshorts-tools`)

A slim, standalone deployment of the three anonymous free-tool endpoints in
`free_tools.py`. It exists so the free-tool API can stay up (and be scraped by
crawlers) without shipping torch, ffmpeg, the osrender kernels or the rest of
the backend image.

## What runs

| Endpoint | Handler |
| --- | --- |
| `GET /api/tools/youtube-transcript` | `free_tools` router |
| `GET /api/tools/tiktok-transcript` | `free_tools` router |
| `POST /api/tools/youtube-metadata` | `free_tools` router |
| `GET /health` | `tools-service/main.py` (`{"ok": true, "service": "openshorts-tools"}`) |

`tools-service/main.py` only imports `free_tools` and mounts its router. The
handlers pull in `yt-dlp`, `ssrf_guard` and the Gemini SDK lazily, so nothing
heavy is imported at boot.

## Deployment

- Provider: Render, web service, **Docker** runtime.
- Repo/branch: `ZESCODE/openshorts`, `main`, auto-deploy on commit.
- Dockerfile: `tools-service/Dockerfile`, build context is the **repository
  root** (it copies `free_tools.py`, `ssrf_guard.py`, `security_utils.py`).
- Health check: `/health`. Render injects `$PORT`; the image's `CMD` honours it.
- Free plan, single instance, Oregon. Expect cold starts after idle; the first
  request can take ~30 s. That is normal, not an outage.

The same code is also served by the main backend, so a change to `free_tools.py`
must be validated locally before pushing: a push to `main` redeploys both.

### Environment variables (names only — values live in Render, never here)

- `GEMINI_API_KEY` — metadata prompt.
- `FREE_TOOLS_GEMINI_MODEL` — model id for the metadata prompt.
- `FREE_TOOLS_YT_TIMEOUT` — per-extraction timeout in seconds.
- `FREE_TOOLS_YT_CONCURRENCY` — concurrent yt-dlp extractions.

The service deliberately has **no** `PROXY_URL`, `YOUTUBE_COOKIES` or account
credentials: free tools go direct/static only, and the image is public.

## Changing it

1. Edit `free_tools.py` (and `tools-service/` only if the image shape changes).
2. Run the free-tool tests: `pytest tests/ -k free_tools -v`.
3. Push to `main`; Render rebuilds from `tools-service/Dockerfile`.
4. Verify `/health`, then one transcript call and one metadata call.

## Why it is separate from the main deploy

The main backend image is large (torch, ffmpeg, PTX kernels) and GPU-shaped.
Free tools are CPU-only, low-traffic and public, so they get their own cheap
container that can restart or cold-start without touching jobs, the queue or
billing.
