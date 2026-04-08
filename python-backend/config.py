import os
from dotenv import load_dotenv

load_dotenv()

TMDB_API_KEY: str = os.getenv("TMDB_API_KEY", "cb1dc311039e6ae85db0aa200345cbc5")
PORT: int = int(os.getenv("PORT", "8888"))
HOST: str = os.getenv("HOST", "0.0.0.0")

TMDB_BASE_URL = "https://api.themoviedb.org/3"
TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500"

# Request timeouts (seconds)
DEFAULT_TIMEOUT = 15
PROVIDER_TIMEOUT = 12

# User-Agent for provider requests
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)
