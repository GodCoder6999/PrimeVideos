"""Provider manager — runs all providers in parallel."""
import asyncio
from typing import Optional
from core.models import StreamInfo
from core.providers.vidsrc_pro import VidsrcProProvider
from core.providers.autoembed import AutoEmbedProvider
from core.providers.embedsu import EmbedSuProvider
from core.providers.vidsrc_xyz import VidsrcXyzProvider
from core.providers.moviesapi import MoviesApiProvider

_PROVIDERS = [
    VidsrcProProvider(),
    AutoEmbedProvider(),
    EmbedSuProvider(),
    VidsrcXyzProvider(),
    MoviesApiProvider(),
]

QUALITY_RANK = {"4K": 5, "1080p": 4, "720p": 3, "480p": 2, "Auto": 1}

LANGUAGE_PRIORITY = [
    "Multi Audio", "Dual Audio",
    "Hindi", "Tamil", "Telugu", "Bengali",
    "Malayalam", "Kannada", "Marathi", "Punjabi",
    "Hindi + English", "Tamil + English", "Telugu + English", "Bengali + English",
    "English",
]


def _lang_rank(lang: str) -> int:
    try:
        return LANGUAGE_PRIORITY.index(lang)
    except ValueError:
        return 999


async def fetch_all_streams(
    tmdb_id: str,
    media_type: str,
    season: Optional[int] = None,
    episode: Optional[int] = None,
    imdb_id: Optional[str] = None,
) -> list[StreamInfo]:
    """Run all providers concurrently and return de-duplicated, sorted streams."""
    tasks = [
        p.fetch_streams(tmdb_id, media_type, season, episode, imdb_id)
        for p in _PROVIDERS
        if p.enabled
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    raw: list[StreamInfo] = []
    for result in results:
        if isinstance(result, list):
            raw.extend(result)

    # De-duplicate: keep best per (language × quality)
    buckets: dict[str, StreamInfo] = {}
    for s in raw:
        key = f"{s.language}|{s.quality}"
        existing = buckets.get(key)
        if not existing:
            buckets[key] = s
            continue
        new_hls = s.type == "hls"
        ex_hls = existing.type == "hls"
        if new_hls and not ex_hls:
            buckets[key] = s

    deduped = list(buckets.values())

    # Sort: language priority then quality descending
    deduped.sort(key=lambda s: (_lang_rank(s.language), -(QUALITY_RANK.get(s.quality, 0))))
    return deduped


def get_provider_status() -> list[dict]:
    return [{"name": p.name, "enabled": p.enabled} for p in _PROVIDERS]
