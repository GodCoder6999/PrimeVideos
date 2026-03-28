"""FastAPI application factory."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from server.routes import router


def create_app() -> FastAPI:
    app = FastAPI(
        title="PrimeVideos Python Backend",
        description="Server-side stream proxy and multi-provider aggregator",
        version="1.0.0",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["GET", "OPTIONS"],
        allow_headers=["*"],
    )

    app.include_router(router)
    return app
