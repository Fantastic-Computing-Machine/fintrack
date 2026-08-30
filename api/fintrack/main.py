from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from sqlalchemy import text

from .core.config import get_settings
from .core.logging import configure_logging
from .db.base import engine
from .integrations.plaid import PlaidClient
from .routers.api import router
from .worker import start_worker, stop_worker


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler = await start_worker(settings) if settings.app.environment != "test" else None
    try:
        yield
    finally:
        if scheduler:
            stop_worker(scheduler)
        await PlaidClient.close()
        await engine.dispose()


settings = get_settings()
configure_logging(settings.app.log_level)
production = settings.app.environment == "production"
app = FastAPI(
    title="Fin Track API",
    version="0.2.0",
    lifespan=lifespan,
    docs_url=None if production else "/docs",
    redoc_url=None if production else "/redoc",
    openapi_url=None if production else "/openapi.json",
)
if production:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.app.trusted_hosts)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(settings.app.frontend_url).rstrip("/")],
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-CSRF-Token"],
)
app.include_router(router)


@app.get("/health/live")
async def live():
    return {"status": "ok"}


@app.get("/health/ready")
async def ready():
    async with engine.connect() as connection:
        await connection.execute(text("SELECT 1"))
    return {"status": "ok"}
