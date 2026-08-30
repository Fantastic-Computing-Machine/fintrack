import hashlib
import hmac
import time
from dataclasses import dataclass

import jwt

from ..integrations.plaid import PlaidClient, PlaidError


class WebhookVerificationError(Exception):
    pass


class WebhookKeyUnavailable(Exception):
    pass


@dataclass
class _CachedKey:
    key: object
    expires_at: float


class WebhookVerifier:
    def __init__(self, client: PlaidClient):
        self.client = client
        self.cache: dict[str, _CachedKey] = {}

    async def _key(self, kid: str):
        cached = self.cache.get(kid)
        now = time.time()
        if cached and cached.expires_at > now:
            return cached.key
        try:
            data = await self.client.webhook_verification_key(kid)
            jwk = data["key"]
            key = jwt.PyJWK.from_dict(jwk, algorithm="ES256").key
            expires_at = float(jwk["expired_at"]) if jwk.get("expired_at") is not None else float("inf")
        except (PlaidError, KeyError, TypeError, ValueError) as exc:
            raise WebhookKeyUnavailable from exc
        self.cache[kid] = _CachedKey(key, expires_at)
        return key

    async def verify(self, token: str, body: bytes) -> str:
        try:
            header = jwt.get_unverified_header(token)
        except jwt.PyJWTError as exc:
            raise WebhookVerificationError from exc
        if header.get("alg") != "ES256" or not isinstance(header.get("kid"), str):
            raise WebhookVerificationError
        key = await self._key(header["kid"])
        try:
            claims = jwt.decode(token, key, algorithms=["ES256"], options={"require": ["iat", "request_body_sha256"]})
        except jwt.PyJWTError as exc:
            raise WebhookVerificationError from exc
        iat = claims.get("iat")
        now = time.time()
        if not isinstance(iat, (int, float)) or iat > now + 30 or now - iat > 300:
            raise WebhookVerificationError
        body_hash = hashlib.sha256(body).hexdigest()
        if not hmac.compare_digest(str(claims.get("request_body_sha256", "")), body_hash):
            raise WebhookVerificationError
        return body_hash
