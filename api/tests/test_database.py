from datetime import datetime, timezone

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from fintrack.db.meta import Base
from fintrack.db.models import Connection, SyncRun


@pytest.mark.asyncio
async def test_only_one_active_sync_per_connection(tmp_path):
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'queue.db'}")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    Session = async_sessionmaker(engine, expire_on_commit=False)
    now = datetime.now(timezone.utc)
    async with Session() as db:
        connection = Connection(provider_item_id="item", institution_name="Bank")
        db.add(connection); await db.flush()
        db.add(SyncRun(connection_id=connection.id, trigger="manual", status="queued", started_at=now, available_at=now))
        await db.commit()
        db.add(SyncRun(connection_id=connection.id, trigger="scheduled", status="running", started_at=now, available_at=now))
        with pytest.raises(IntegrityError):
            await db.commit()
    await engine.dispose()
