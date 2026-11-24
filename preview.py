"""Serve the portfolio on localhost with seekable video via aiohttp's FileResponse."""
from pathlib import Path

from aiohttp import web

SITE = Path(__file__).resolve().parent / "docs"


async def homepage(request):
    return web.FileResponse(SITE / "index.html")


async def replay(request):
    return web.FileResponse(SITE / "kalshi-viewer" / "index.html")


if __name__ == "__main__":
    app = web.Application()
    app.router.add_get("/", homepage)
    app.router.add_get("/kalshi-viewer/", replay)
    app.router.add_static("/", SITE)
    web.run_app(app, host="127.0.0.1", port=8847)