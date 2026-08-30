"""Validated HTTP request and response shapes."""

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class LoginRequest(StrictModel):
    password: str = Field(min_length=1, max_length=1024)


class PublicTokenRequest(StrictModel):
    public_token: str = Field(min_length=1)
    institution_id: str | None = None
    institution_name: str = Field(min_length=1, max_length=200)


class SyncRequest(StrictModel):
    connection_id: int | None = None


class LinkTokenRequest(StrictModel):
    connection_id: int | None = None


class ConnectionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    institution_id: str | None
    institution_name: str
    status: str
    last_success_at: datetime | None
    last_error: str | None


class AccountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    institution_name: str
    name: str
    mask: str | None
    type: str
    subtype: str | None
    currency: str
    current_balance: Decimal | None
    available_balance: Decimal | None
    balance_at: datetime | None
    connection_status: str


class SummaryOut(BaseModel):
    cash: Decimal
    credit_card_debt: Decimal
    net_position: Decimal
    currency: str = "USD"
    last_success_at: datetime | None
    stale_count: int
    error_count: int


class TransactionOut(BaseModel):
    id: int
    account_id: int
    account_name: str
    institution_name: str
    date: date
    authorized_date: date | None
    amount: Decimal
    currency: str
    merchant_name: str | None
    description: str
    category: str | None
    pending: bool


class TransactionPage(BaseModel):
    items: list[TransactionOut]
    next_cursor: str | None
    total: int


AnalyticsRange = Literal["1w", "1m", "3m", "6m", "1y", "all", "custom"]


class CashFlowPoint(BaseModel):
    date: date
    spending: Decimal
    inflows: Decimal
    movements: Decimal


class SpendingCategoryOut(BaseModel):
    category: str
    amount: Decimal
    share: Decimal


class DebtPoint(BaseModel):
    date: date
    credit_card_debt: Decimal
    loan_debt: Decimal


class DebtAccountOut(BaseModel):
    account_id: int
    institution_name: str
    account_name: str
    account_type: Literal["credit", "loan"]
    current_balance: Decimal


class AnalyticsOut(BaseModel):
    range: AnalyticsRange
    from_date: date
    to_date: date
    timezone: str
    first_debt_snapshot: date | None
    debt_history_available: bool
    spending_total: Decimal
    inflows_total: Decimal
    movements_total: Decimal
    credit_card_debt: Decimal
    loan_debt: Decimal
    cash_flow: list[CashFlowPoint]
    spending_categories: list[SpendingCategoryOut]
    debt_history: list[DebtPoint]
    debt_accounts: list[DebtAccountOut]


class CardOut(BaseModel):
    account_id: int
    institution_name: str
    account_name: str
    mask: str | None
    current_balance: Decimal | None
    credit_limit: Decimal | None
    last_statement_balance: Decimal | None
    last_statement_date: date | None
    minimum_payment: Decimal | None
    next_payment_due_date: date | None
    purchase_apr: Decimal | None
    interest_charge: Decimal | None
    is_overdue: bool | None
    provider_updated_at: datetime | None


class SyncRunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    connection_id: int
    trigger: str
    status: str
    started_at: datetime
    finished_at: datetime | None
    added_count: int
    modified_count: int
    removed_count: int
    error: str | None
    attempt_count: int
    available_at: datetime


class SyncAccepted(BaseModel):
    run_ids: list[int]
    status: Literal["accepted"] = "accepted"
