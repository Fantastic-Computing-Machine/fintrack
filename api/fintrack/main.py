import hmac
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from starlette.responses import Response
from sqlalchemy import text

from .core.config import get_settings
from .core.logging import configure_logging
from .db.base import engine
from .integrations.plaid import PlaidClient
from .mcp_docs import register_mcp_docs
from .mcp_server import create_mcp_server
from .routers.api import router
from .worker import start_worker, stop_worker

OPENAPI_TAGS = [
    {"name": "Authentication", "description": "Owner session and CSRF-cookie lifecycle."},
    {"name": "Dashboard", "description": "Balances, financial summary, and dashboard preferences."},
    {"name": "Transactions", "description": "Transaction search and cursor pagination."},
    {"name": "Credit cards", "description": "Credit-card liability and payment information."},
    {"name": "Analytics", "description": "Cash flow, category spending, and debt history."},
    {"name": "Plaid connections", "description": "Institution linking and connection management."},
    {"name": "Synchronization", "description": "Background synchronization status and manual queueing."},
    {"name": "Webhooks", "description": "Plaid provider webhook ingestion."},
    {"name": "Health", "description": "Service liveness and database readiness probes."},
]

API_DESCRIPTION = """Private, single-owner finance dashboard API.

### Authentication

Call `POST /api/v1/auth/login` first. It sets an HTTP-only session cookie and a readable CSRF cookie. Authenticated state-changing requests must include the session cookie, originate from the configured frontend URL, and copy the CSRF cookie value into the `X-CSRF-Token` header.

### Data handling

Amounts are decimal values serialized as JSON strings. Plaid access tokens and database credentials are never returned. The separate `/mcp` endpoint is not part of this HTTP API specification.
"""


def create_app(app_settings=None) -> FastAPI:
    active_settings = app_settings or get_settings()
    configure_logging(active_settings.app.log_level)
    production = active_settings.app.environment == "production"
    mcp_server = create_mcp_server() if active_settings.mcp_enable else None

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        scheduler = await start_worker(active_settings) if active_settings.app.environment != "test" else None
        try:
            if mcp_server:
                async with mcp_server.session_manager.run():
                    yield
            else:
                yield
        finally:
            if scheduler:
                stop_worker(scheduler)
            await PlaidClient.close()
            await engine.dispose()

    app = FastAPI(title="Fin Track API", summary="Private Plaid-backed finance dashboard", description=API_DESCRIPTION, version="0.2.0", openapi_tags=OPENAPI_TAGS, lifespan=lifespan, docs_url="/docs" if active_settings.docs_enable else None, redoc_url="/redoc" if active_settings.docs_enable else None, openapi_url="/openapi.json" if active_settings.docs_enable else None)
    app.dependency_overrides[get_settings] = lambda: active_settings
    if production:
        app.add_middleware(TrustedHostMiddleware, allowed_hosts=active_settings.app.trusted_hosts)
    app.add_middleware(CORSMiddleware, allow_origins=[str(active_settings.app.frontend_url).rstrip("/")], allow_credentials=True, allow_methods=["GET", "POST", "DELETE", "OPTIONS"], allow_headers=["Content-Type", "X-CSRF-Token"])
    app.include_router(router)

    if active_settings.docs_enable:
        register_mcp_docs(app, str(active_settings.app.api_url).rstrip("/"))

    if mcp_server:
        mcp_app = mcp_server.streamable_http_app(streamable_http_path="/mcp", stateless_http=True, host=active_settings.app.api_url.host)

        @app.middleware("http")
        async def require_mcp_token(request, call_next):
            if request.url.path == "/mcp":
                token = request.headers.get("Authorization", "").removeprefix("Bearer ")
                if not hmac.compare_digest(token, active_settings.mcp_auth_token):
                    return Response(status_code=401, headers={"WWW-Authenticate": "Bearer"})
            return await call_next(request)

    @app.get("/health/live", tags=["Health"], summary="Check process liveness", description="Returns success while the API process is running.")
    async def live():
        return {"status": "ok"}

    @app.get("/health/ready", tags=["Health"], summary="Check database readiness", description="Returns success only when the API can execute a database query.")
    async def ready():
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
        return {"status": "ok"}

    if mcp_server:
        app.mount("/", mcp_app)

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("fintrack.main:app", host="0.0.0.0", port=8000, reload=True)
