import asyncio

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from .core.config import Settings, get_settings
from .integrations.plaid import PlaidClient
from .services.sync import drain_sync_runs, drain_webhook_events, enqueue_fallback_syncs


async def start_worker(settings: Settings | None = None) -> AsyncIOScheduler:
    settings = settings or get_settings()
    scheduler = AsyncIOScheduler()
    scheduler.add_job(drain_webhook_events, "interval", seconds=settings.sync.queue_seconds, max_instances=1, coalesce=True)
    scheduler.add_job(drain_sync_runs, "interval", seconds=settings.sync.queue_seconds, max_instances=1, coalesce=True)
    scheduler.add_job(enqueue_fallback_syncs, "interval", hours=settings.sync.fallback_hours, max_instances=1, coalesce=True)
    scheduler.start()
    try:
        await enqueue_fallback_syncs()
    except Exception:
        scheduler.shutdown(wait=False)
        raise
    return scheduler


def stop_worker(scheduler: AsyncIOScheduler) -> None:
    scheduler.shutdown(wait=False)


async def main() -> None:
    scheduler = await start_worker()
    try:
        await asyncio.Event().wait()
    finally:
        stop_worker(scheduler)
        await PlaidClient.close()


if __name__ == "__main__":
    asyncio.run(main())
