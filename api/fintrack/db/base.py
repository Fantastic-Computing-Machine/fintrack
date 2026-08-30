from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from ..core.config import get_settings


from .meta import Base


settings = get_settings()
engine_options: dict = {"echo": settings.database.echo, "pool_pre_ping": True}
if not settings.database_url.startswith("sqlite"):
    engine_options.update(pool_size=settings.database.pool_size, max_overflow=settings.database.max_overflow)
engine = create_async_engine(settings.database_url, **engine_options)
if settings.database_url.startswith("sqlite"):
    @event.listens_for(engine.sync_engine, "connect")
    def enable_sqlite_foreign_keys(connection, _):
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db():
    async with SessionLocal() as db:
        yield db
