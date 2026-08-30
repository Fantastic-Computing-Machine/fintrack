import base64
import json
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response, status
from pydantic import BaseModel, ConfigDict, ValidationError
from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.config import Settings, get_settings
from ..core.security import COOKIE_NAME, CSRF_COOKIE_NAME, create_session, require_csrf, require_owner, validate_origin, verify_password
from ..db.base import get_db
from ..db.models import Account, Connection, CreditCardLiability, SyncRun, Transaction, WebhookEvent
from ..integrations.plaid import PlaidClient, PlaidError
from ..services.sync import enqueue_sync, utcnow
from ..services.webhooks import WebhookKeyUnavailable, WebhookVerificationError, WebhookVerifier
from .schemas import AccountOut, CardOut, ConnectionOut, LinkTokenRequest, LoginRequest, PublicTokenRequest, SummaryOut, SyncAccepted, SyncRequest, SyncRunOut, TransactionOut, TransactionPage

router = APIRouter(prefix="/api/v1")
protected = APIRouter(dependencies=[Depends(require_owner)])
_verifier: WebhookVerifier | None = None


class PlaidWebhook(BaseModel):
    model_config = ConfigDict(extra="ignore")
    webhook_type: str
    webhook_code: str
    item_id: str | None = None
    error: dict | None = None


@router.post("/auth/login", status_code=204, dependencies=[Depends(validate_origin)])
async def login(body: LoginRequest, response: Response, settings: Settings = Depends(get_settings)):
    if not verify_password(body.password, settings):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid password")
    production = settings.app.environment == "production"
    token, csrf = create_session(settings)
    common = {"secure": production, "samesite": "none" if production else "lax", "max_age": settings.app.session_hours * 3600, "path": "/"}
    response.set_cookie(COOKIE_NAME, token, httponly=True, **common)
    response.set_cookie(CSRF_COOKIE_NAME, csrf, httponly=False, **common)


@protected.post("/auth/logout", status_code=204, dependencies=[Depends(require_csrf)])
async def logout(response: Response):
    response.delete_cookie(COOKIE_NAME, path="/")
    response.delete_cookie(CSRF_COOKIE_NAME, path="/")


@protected.post("/plaid/link-token", dependencies=[Depends(require_csrf)])
async def link_token(body: LinkTokenRequest, db: AsyncSession = Depends(get_db), settings: Settings = Depends(get_settings)):
    access_token = None
    if body.connection_id is not None:
        connection = await db.get(Connection, body.connection_id)
        if not connection or connection.status == "disconnected" or not connection.access_token:
            raise HTTPException(404, "Connection not found")
        access_token = connection.access_token
    return {"link_token": await PlaidClient(settings).create_link_token(access_token)}


@protected.post("/plaid/exchange", status_code=202, response_model=SyncAccepted, dependencies=[Depends(require_csrf)])
async def exchange(body: PublicTokenRequest, db: AsyncSession = Depends(get_db), settings: Settings = Depends(get_settings)):
    data = await PlaidClient(settings).exchange(body.public_token)
    connection = Connection(provider_item_id=data["item_id"], institution_id=body.institution_id, institution_name=body.institution_name, access_token=data["access_token"])
    db.add(connection)
    try:
        await db.commit()
        await db.refresh(connection)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, "Connection already exists")
    run = await enqueue_sync(db, connection.id, "initial")
    return SyncAccepted(run_ids=[run.id] if run else [])


@protected.get("/accounts", response_model=list[AccountOut])
async def accounts(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Account, Connection).join(Connection).where(Account.active, Connection.status != "disconnected").order_by(Connection.institution_name, Account.type, Account.name))).all()
    return [AccountOut(id=a.id, institution_name=c.institution_name, name=a.name, mask=a.mask, type=a.type, subtype=a.subtype, currency=a.currency, current_balance=a.current_balance, available_balance=a.available_balance, balance_at=a.balance_at, connection_status=c.status) for a, c in rows]


@protected.get("/connections", response_model=list[ConnectionOut])
async def connections(db: AsyncSession = Depends(get_db)):
    return list((await db.scalars(select(Connection).order_by(Connection.institution_name))).all())


@protected.get("/summary", response_model=SummaryOut)
async def summary(db: AsyncSession = Depends(get_db), settings: Settings = Depends(get_settings)):
    accounts = (await db.scalars(select(Account).join(Connection).where(Account.active, Account.currency == "USD", Connection.status != "disconnected"))).all()
    cash = sum((a.current_balance or Decimal() for a in accounts if a.type == "depository"), Decimal())
    debt = sum((a.current_balance or Decimal() for a in accounts if a.type == "credit"), Decimal())
    connections = (await db.scalars(select(Connection).where(Connection.status != "disconnected"))).all()
    cutoff = datetime.now(timezone.utc) - timedelta(hours=settings.sync.stale_hours)
    stale = sum(1 for c in connections if not c.last_success_at or c.last_success_at.replace(tzinfo=c.last_success_at.tzinfo or timezone.utc) < cutoff)
    return SummaryOut(cash=cash, credit_card_debt=debt, net_position=cash - debt, last_success_at=max((c.last_success_at for c in connections if c.last_success_at), default=None), stale_count=stale, error_count=sum(c.status in {"error", "reconnect_required"} for c in connections))


def encode_cursor(day: date, row_id: int) -> str:
    return base64.urlsafe_b64encode(f"{day.isoformat()}|{row_id}".encode()).decode().rstrip("=")


def decode_cursor(value: str) -> tuple[date, int]:
    try:
        raw = base64.urlsafe_b64decode(value + "=" * (-len(value) % 4)).decode()
        day, row_id = raw.split("|", 1)
        return date.fromisoformat(day), int(row_id)
    except Exception:
        raise HTTPException(422, "Invalid cursor")


@protected.get("/transactions", response_model=TransactionPage)
async def transactions(account_id: int | None = None, institution: str | None = None, start: date | None = None, end: date | None = None, status_filter: str | None = Query(None, alias="status"), search: str | None = None, cursor: str | None = None, limit: int = Query(50, ge=1, le=200), db: AsyncSession = Depends(get_db)):
    query = select(Transaction, Account, Connection).join(Account, Transaction.account_id == Account.id).join(Connection, Account.connection_id == Connection.id).where(~Transaction.removed)
    if account_id: query = query.where(Transaction.account_id == account_id)
    if institution: query = query.where(Connection.institution_id == institution)
    if start: query = query.where(Transaction.date >= start)
    if end: query = query.where(Transaction.date <= end)
    if status_filter == "pending": query = query.where(Transaction.pending)
    elif status_filter == "posted": query = query.where(~Transaction.pending)
    if search:
        needle = f"%{search.lower()}%"
        query = query.where(or_(func.lower(Transaction.description).like(needle), func.lower(func.coalesce(Transaction.merchant_name, "")).like(needle)))
    if cursor:
        cursor_date, cursor_id = decode_cursor(cursor)
        query = query.where(or_(Transaction.date < cursor_date, and_(Transaction.date == cursor_date, Transaction.id < cursor_id)))
    rows = (await db.execute(query.order_by(Transaction.date.desc(), Transaction.id.desc()).limit(limit + 1))).all()
    page = rows[:limit]
    items = [TransactionOut(id=t.id, account_id=a.id, account_name=a.name, institution_name=c.institution_name, date=t.date, authorized_date=t.authorized_date, amount=t.amount, currency=t.currency, merchant_name=t.merchant_name, description=t.description, category=t.category, pending=t.pending) for t, a, c in page]
    return TransactionPage(items=items, next_cursor=encode_cursor(page[-1][0].date, page[-1][0].id) if len(rows) > limit else None)


@protected.get("/cards", response_model=list[CardOut])
async def cards(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Account, Connection, CreditCardLiability).join(Connection).outerjoin(CreditCardLiability).where(Account.active, Account.type == "credit", Connection.status != "disconnected").order_by(CreditCardLiability.next_payment_due_date.asc().nulls_last(), Account.id))).all()
    return [CardOut(account_id=a.id, institution_name=c.institution_name, account_name=a.name, mask=a.mask, current_balance=a.current_balance, credit_limit=l.credit_limit if l else None, last_statement_balance=l.last_statement_balance if l else None, last_statement_date=l.last_statement_date if l else None, minimum_payment=l.minimum_payment if l else None, next_payment_due_date=l.next_payment_due_date if l else None, purchase_apr=l.purchase_apr if l else None, interest_charge=l.interest_charge if l else None, is_overdue=l.is_overdue if l else None, provider_updated_at=l.provider_updated_at if l else None) for a, c, l in rows]


@protected.get("/sync-runs", response_model=list[SyncRunOut])
async def sync_runs(limit: int = Query(20, ge=1, le=100), db: AsyncSession = Depends(get_db)):
    return list((await db.scalars(select(SyncRun).order_by(SyncRun.started_at.desc()).limit(limit))).all())


@protected.post("/sync", status_code=202, response_model=SyncAccepted, dependencies=[Depends(require_csrf)])
async def start_sync(body: SyncRequest, db: AsyncSession = Depends(get_db)):
    query = select(Connection.id).where(Connection.status != "disconnected", Connection.access_token.is_not(None))
    if body.connection_id: query = query.where(Connection.id == body.connection_id)
    run_ids = []
    for connection_id in (await db.scalars(query)).all():
        run = await enqueue_sync(db, connection_id, "manual")
        if run: run_ids.append(run.id)
    return SyncAccepted(run_ids=run_ids)


@protected.post("/connections/{connection_id}/rotate-token", status_code=204, dependencies=[Depends(require_csrf)])
async def rotate_token(connection_id: int, db: AsyncSession = Depends(get_db), settings: Settings = Depends(get_settings)):
    connection = await db.scalar(select(Connection).where(Connection.id == connection_id).with_for_update())
    if not connection or not connection.access_token or connection.status == "disconnected":
        raise HTTPException(404, "Connection not found")
    connection.access_token = await PlaidClient(settings).rotate_access_token(connection.access_token)
    await db.commit()


@protected.delete("/connections/{connection_id}", status_code=204, dependencies=[Depends(require_csrf)])
async def disconnect(connection_id: int, db: AsyncSession = Depends(get_db), settings: Settings = Depends(get_settings)):
    connection = await db.get(Connection, connection_id)
    if not connection: raise HTTPException(404, "Connection not found")
    if connection.access_token:
        try: await PlaidClient(settings).remove_item(connection.access_token)
        except PlaidError: pass
    connection.access_token = None
    connection.status = "disconnected"
    connection.sync_cursor = None
    connection.last_error = None
    await db.execute(update(Account).where(Account.connection_id == connection.id).values(active=False))
    await db.commit()


@router.post("/webhooks/plaid")
async def plaid_webhook(request: Request, verification: str | None = Header(None, alias="Plaid-Verification"), db: AsyncSession = Depends(get_db), settings: Settings = Depends(get_settings)):
    if not verification: raise HTTPException(401, "Invalid webhook signature")
    length = request.headers.get("content-length")
    try:
        if length and int(length) > settings.app.max_webhook_bytes: raise HTTPException(413, "Webhook body too large")
    except ValueError:
        raise HTTPException(400, "Invalid Content-Length")
    body = await request.body()
    if len(body) > settings.app.max_webhook_bytes: raise HTTPException(413, "Webhook body too large")
    global _verifier
    _verifier = _verifier or WebhookVerifier(PlaidClient(settings))
    try:
        body_hash = await _verifier.verify(verification, body)
    except WebhookKeyUnavailable:
        raise HTTPException(503, "Webhook verification temporarily unavailable")
    except WebhookVerificationError:
        raise HTTPException(401, "Invalid webhook signature")
    try:
        payload = PlaidWebhook.model_validate(json.loads(body))
    except (json.JSONDecodeError, ValidationError):
        raise HTTPException(400, "Invalid webhook payload")
    detail = str((payload.error or {}).get("error_code", ""))[:100] or None
    db.add(WebhookEvent(body_sha256=body_hash, provider_item_id=payload.item_id, webhook_type=payload.webhook_type, webhook_code=payload.webhook_code, detail=detail, status="queued", received_at=utcnow(), available_at=utcnow()))
    try: await db.commit()
    except IntegrityError: await db.rollback()
    return {"status": "accepted"}


router.include_router(protected)
