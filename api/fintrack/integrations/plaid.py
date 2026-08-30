from __future__ import annotations

from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from typing import Any

import httpx

from ..core.config import Settings


class PlaidError(Exception):
    def __init__(self, code: str, error_type: str = "API_ERROR", retry_after: float | None = None, endpoint: str = ""):
        super().__init__(code)
        self.code = code
        self.error_type = error_type
        self.retry_after = retry_after
        self.endpoint = endpoint


def _retry_after(response: httpx.Response) -> float | None:
    value = response.headers.get("retry-after")
    if not value:
        return None
    try:
        return max(0.0, float(value))
    except ValueError:
        try:
            return max(0.0, (parsedate_to_datetime(value) - parsedate_to_datetime(response.headers["date"])).total_seconds())
        except Exception:
            return None


class PlaidClient:
    _http: httpx.AsyncClient | None = None

    def __init__(self, settings: Settings):
        self.settings = settings
        self.host = {
            "sandbox": "https://sandbox.plaid.com",
            "development": "https://development.plaid.com",
            "production": "https://production.plaid.com",
        }[settings.plaid.environment]

    @classmethod
    def http(cls) -> httpx.AsyncClient:
        if cls._http is None:
            cls._http = httpx.AsyncClient(timeout=httpx.Timeout(45, connect=10), verify=True)
        return cls._http

    @classmethod
    async def close(cls) -> None:
        if cls._http is not None:
            await cls._http.aclose()
            cls._http = None

    async def post(self, path: str, **payload: Any) -> dict[str, Any]:
        body = {"client_id": self.settings.plaid_client_id, "secret": self.settings.plaid_secret, **payload}
        try:
            response = await self.http().post(f"{self.host}{path}", json=body)
        except httpx.HTTPError as exc:
            raise PlaidError("NETWORK_ERROR") from exc
        if response.is_error:
            try:
                error = response.json()
            except ValueError:
                error = {}
            raise PlaidError(error.get("error_code", "PROVIDER_ERROR"), error.get("error_type", "API_ERROR"), _retry_after(response), path)
        return response.json()

    async def create_link_token(self, access_token: str | None = None) -> str:
        payload: dict[str, Any] = {
            "user": {"client_user_id": "owner"},
            "client_name": "Fin Track",
            "country_codes": self.settings.plaid.country_codes,
            "language": "en",
        }
        if access_token:
            payload["access_token"] = access_token
        else:
            payload["products"] = self.settings.plaid.products
            payload["transactions"] = {"days_requested": self.settings.sync.history_days}
        if self.settings.app.webhook_url:
            payload["webhook"] = self.settings.app.webhook_url
        return (await self.post("/link/token/create", **payload))["link_token"]

    async def exchange(self, public_token: str) -> dict[str, Any]:
        return await self.post("/item/public_token/exchange", public_token=public_token)

    async def transactions_sync(self, access_token: str, cursor: str | None) -> dict[str, Any]:
        return await self.post("/transactions/sync", access_token=access_token, cursor=cursor, count=500, options={"include_personal_finance_category": True})

    async def balances(self, access_token: str) -> dict[str, Any]:
        # Capital One credit accounts require an acceptable cached-balance age.
        oldest_acceptable = (datetime.now(timezone.utc) - timedelta(days=365)).isoformat().replace("+00:00", "Z")
        return await self.post("/accounts/balance/get", access_token=access_token, options={"min_last_updated_datetime": oldest_acceptable})

    async def liabilities(self, access_token: str) -> dict[str, Any]:
        return await self.post("/liabilities/get", access_token=access_token)

    async def remove_item(self, access_token: str) -> None:
        await self.post("/item/remove", access_token=access_token)

    async def rotate_access_token(self, access_token: str) -> str:
        return (await self.post("/item/access_token/invalidate", access_token=access_token))["new_access_token"]

    async def webhook_verification_key(self, key_id: str) -> dict[str, Any]:
        return await self.post("/webhook_verification_key/get", key_id=key_id)
