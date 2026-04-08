"""TMDB API client."""
import httpx
from config import TMDB_API_KEY, TMDB_BASE_URL, DEFAULT_TIMEOUT


async def get_imdb_id(tmdb_id: str, media_type: str) -> str | None:
    """Fetch the IMDB ID for a given TMDB ID."""
    url = f"{TMDB_BASE_URL}/{media_type}/{tmdb_id}/external_ids"
    params = {"api_key": TMDB_API_KEY}
    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        r = await client.get(url, params=params)
        r.raise_for_status()
        return r.json().get("imdb_id")


async def search_tmdb(query: str) -> list:
    """Search TMDB for movies and TV shows."""
    url = f"{TMDB_BASE_URL}/search/multi"
    params = {"api_key": TMDB_API_KEY, "query": query, "page": 1}
    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        r = await client.get(url, params=params)
        r.raise_for_status()
        return r.json().get("results", [])


async def get_details(media_type: str, tmdb_id: str) -> dict:
    """Get full details for a movie or TV show."""
    url = f"{TMDB_BASE_URL}/{media_type}/{tmdb_id}"
    params = {"api_key": TMDB_API_KEY}
    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        r = await client.get(url, params=params)
        r.raise_for_status()
        return r.json()


async def get_trending() -> list:
    """Fetch trending movies and TV shows."""
    url = f"{TMDB_BASE_URL}/trending/all/week"
    params = {"api_key": TMDB_API_KEY}
    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        r = await client.get(url, params=params)
        r.raise_for_status()
        return r.json().get("results", [])
