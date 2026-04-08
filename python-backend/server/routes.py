"""API route definitions."""
from typing import Optional
from fastapi import APIRouter, Query, Request

from core.providers.manager import fetch_all_streams, get_provider_status
from core.tmdb_client import search_tmdb, get_details, get_trending, get_imdb_id
from core.models import MultiStreamResponse
from server.proxy import proxy_stream

router = APIRouter()


# ── Stream endpoints ──────────────────────────────────────────────────────────

@router.get("/api/multi-stream")
async def multi_stream(
    tmdbId: str = Query(...),
    type: str = Query("movie"),
    season: Optional[int] = Query(None),
    episode: Optional[int] = Query(None),
):
    """Fetch streams from all 5 providers in parallel."""
    media_type = type  # "movie" or "tv"

    # Resolve IMDB ID (needed by some providers)
    imdb_id: Optional[str] = None
    try:
        imdb_id = await get_imdb_id(tmdbId, media_type)
    except Exception:
        pass

    streams = await fetch_all_streams(
        tmdb_id=tmdbId,
        media_type=media_type,
        season=season,
        episode=episode,
        imdb_id=imdb_id,
    )

    if streams:
        return MultiStreamResponse(
            success=True,
            count=len(streams),
            imdbId=imdb_id,
            streams=streams,
            subtitles=[],
            audioTracks=[],
        )
    return MultiStreamResponse(
        success=False,
        imdbId=imdb_id,
        error="No playable streams found from any source.",
    )


@router.get("/proxy/stream")
async def stream_proxy(
    request: Request,
    url: str = Query(...),
    referer: str = Query(""),
):
    """Proxy a remote stream URL, rewriting M3U8 segment URLs to avoid CORS."""
    return await proxy_stream(url, referer, request)


# ── TMDB endpoints ────────────────────────────────────────────────────────────

@router.get("/api/search")
async def search(q: str = Query(...)):
    results = await search_tmdb(q)
    return {"results": results}


@router.get("/api/details/{media_type}/{tmdb_id}")
async def details(media_type: str, tmdb_id: str):
    data = await get_details(media_type, tmdb_id)
    return data


@router.get("/api/trending")
async def trending():
    results = await get_trending()
    return {"results": results}


# ── Status endpoints ──────────────────────────────────────────────────────────

@router.get("/api/providers/status")
async def providers_status():
    return {"providers": get_provider_status()}


@router.get("/api/health")
async def health():
    return {"status": "ok"}
