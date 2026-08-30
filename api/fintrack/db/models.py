from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, Index, Integer, Numeric, String, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .meta import Base
from .types import EncryptedPlaidToken


class Connection(Base):
    __tablename__ = "connections"
    id: Mapped[int] = mapped_column(primary_key=True)
    provider: Mapped[str] = mapped_column(String(20), default="plaid")
    provider_item_id: Mapped[str] = mapped_column(String(128), unique=True)
    institution_id: Mapped[str | None] = mapped_column(String(128))
    institution_name: Mapped[str] = mapped_column(String(200))
    access_token: Mapped[str | None] = mapped_column(EncryptedPlaidToken)
    sync_cursor: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="active")
    consent_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_success_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(String(500))
    accounts: Mapped[list["Account"]] = relationship(back_populates="connection")
    __table_args__ = (CheckConstraint("status IN ('active','error','reconnect_required','disconnected')", name="ck_connections_status"),)


class Account(Base):
    __tablename__ = "accounts"
    id: Mapped[int] = mapped_column(primary_key=True)
    connection_id: Mapped[int] = mapped_column(ForeignKey("connections.id"), index=True)
    provider_account_id: Mapped[str] = mapped_column(String(128))
    name: Mapped[str] = mapped_column(String(200))
    official_name: Mapped[str | None] = mapped_column(String(250))
    mask: Mapped[str | None] = mapped_column(String(8))
    type: Mapped[str] = mapped_column(String(30))
    subtype: Mapped[str | None] = mapped_column(String(50))
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    current_balance: Mapped[Decimal | None] = mapped_column(Numeric(19, 4))
    available_balance: Mapped[Decimal | None] = mapped_column(Numeric(19, 4))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    balance_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    connection: Mapped[Connection] = relationship(back_populates="accounts")
    liability: Mapped["CreditCardLiability | None"] = relationship(back_populates="account", uselist=False, cascade="all, delete-orphan")
    loan_liability: Mapped["LoanLiability | None"] = relationship(back_populates="account", uselist=False, cascade="all, delete-orphan")
    __table_args__ = (
        UniqueConstraint("connection_id", "provider_account_id", name="uq_accounts_connection_provider"),
        CheckConstraint("length(currency) = 3", name="ck_accounts_currency"),
        Index("ix_accounts_connection_active_name", "connection_id", "active", "name"),
    )


class Transaction(Base):
    __tablename__ = "transactions"
    id: Mapped[int] = mapped_column(primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"))
    provider_transaction_id: Mapped[str] = mapped_column(String(128))
    pending_provider_id: Mapped[str | None] = mapped_column(String(128))
    date: Mapped[date] = mapped_column(Date)
    authorized_date: Mapped[date | None] = mapped_column(Date)
    amount: Mapped[Decimal] = mapped_column(Numeric(19, 4))
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    merchant_name: Mapped[str | None] = mapped_column(String(250))
    description: Mapped[str] = mapped_column(String(500))
    category: Mapped[str | None] = mapped_column(String(250))
    pending: Mapped[bool] = mapped_column(Boolean, default=False)
    removed: Mapped[bool] = mapped_column(Boolean, default=False)
    provider_updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    __table_args__ = (
        UniqueConstraint("provider_transaction_id", name="uq_transactions_provider_id"),
        CheckConstraint("length(currency) = 3", name="ck_transactions_currency"),
        Index("ix_transactions_account_date_id", "account_id", date.desc(), id.desc()),
        Index("ix_transactions_date_id", date.desc(), id.desc()),
        Index("ix_transactions_pending_provider_id", "pending_provider_id"),
    )


class AccountBalanceSnapshot(Base):
    __tablename__ = "account_balance_snapshots"
    id: Mapped[int] = mapped_column(primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"))
    observed_on: Mapped[date] = mapped_column(Date)
    account_type: Mapped[str] = mapped_column(String(20))
    current_balance: Mapped[Decimal] = mapped_column(Numeric(19, 4))
    __table_args__ = (
        UniqueConstraint("account_id", "observed_on", name="uq_account_snapshots_account_day"),
        CheckConstraint("account_type IN ('credit','loan')", name="ck_account_snapshots_type"),
        Index("ix_account_snapshots_observed_on", "observed_on", "account_type"),
    )


class CreditCardLiability(Base):
    __tablename__ = "credit_card_liabilities"
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"), primary_key=True)
    credit_limit: Mapped[Decimal | None] = mapped_column(Numeric(19, 4))
    last_statement_balance: Mapped[Decimal | None] = mapped_column(Numeric(19, 4))
    last_statement_date: Mapped[date | None] = mapped_column(Date)
    minimum_payment: Mapped[Decimal | None] = mapped_column(Numeric(19, 4))
    next_payment_due_date: Mapped[date | None] = mapped_column(Date)
    purchase_apr: Mapped[Decimal | None] = mapped_column(Numeric(8, 4))
    interest_charge: Mapped[Decimal | None] = mapped_column(Numeric(19, 4))
    is_overdue: Mapped[bool | None] = mapped_column(Boolean)
    provider_updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    account: Mapped[Account] = relationship(back_populates="liability")
    __table_args__ = (Index("ix_cards_due_account", "next_payment_due_date", "account_id"),)


class LoanLiability(Base):
    __tablename__ = "loan_liabilities"
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"), primary_key=True)
    next_payment_amount: Mapped[Decimal | None] = mapped_column(Numeric(19, 4))
    next_payment_due_date: Mapped[date | None] = mapped_column(Date)
    provider_updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    account: Mapped[Account] = relationship(back_populates="loan_liability")
    __table_args__ = (Index("ix_loans_due_account", "next_payment_due_date", "account_id"),)


class SyncRun(Base):
    __tablename__ = "sync_runs"
    id: Mapped[int] = mapped_column(primary_key=True)
    connection_id: Mapped[int] = mapped_column(ForeignKey("connections.id"))
    trigger: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), default="queued")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    added_count: Mapped[int] = mapped_column(Integer, default=0)
    modified_count: Mapped[int] = mapped_column(Integer, default=0)
    removed_count: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[str | None] = mapped_column(String(500))
    attempt_count: Mapped[int] = mapped_column(Integer, default=0)
    available_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    __table_args__ = (
        CheckConstraint("trigger IN ('initial','manual','scheduled','webhook')", name="ck_sync_trigger"),
        CheckConstraint("status IN ('queued','running','retry_wait','succeeded','failed')", name="ck_sync_status"),
        Index("ix_sync_connection_started", "connection_id", started_at.desc()),
        Index("uq_sync_one_active", "connection_id", unique=True, sqlite_where=text("status IN ('queued','running','retry_wait')"), postgresql_where=text("status IN ('queued','running','retry_wait')")),
    )


class WebhookEvent(Base):
    __tablename__ = "webhook_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    body_sha256: Mapped[str] = mapped_column(String(64), unique=True)
    provider_item_id: Mapped[str | None] = mapped_column(String(128))
    webhook_type: Mapped[str] = mapped_column(String(50))
    webhook_code: Mapped[str] = mapped_column(String(80))
    detail: Mapped[str | None] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(20), default="queued")
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    available_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    attempt_count: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[str | None] = mapped_column(String(500))
    __table_args__ = (
        CheckConstraint("status IN ('queued','processing','processed','ignored','retry_wait','failed')", name="ck_webhook_status"),
        Index("ix_webhook_ready", "status", "available_at", "id"),
        Index("ix_webhook_item_received", "provider_item_id", received_at.desc()),
    )


class DashboardPreference(Base):
    __tablename__ = "dashboard_preferences"
    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    account_grouping: Mapped[str] = mapped_column(String(20), default="institution")
    hide_balances: Mapped[bool] = mapped_column(Boolean, default=False)
    __table_args__ = (
        CheckConstraint("id = 1", name="ck_dashboard_preferences_singleton"),
        CheckConstraint("account_grouping IN ('institution','account_type')", name="ck_dashboard_preferences_account_grouping"),
    )
