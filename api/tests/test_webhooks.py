import hashlib
import json
import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec

from fintrack.services.webhooks import WebhookVerificationError, WebhookVerifier


class KeyClient:
    def __init__(self, jwk): self.jwk = jwk; self.calls = 0
    async def webhook_verification_key(self, key_id):
        self.calls += 1
        assert key_id == "key-1"
        return {"key": self.jwk}


@pytest.mark.asyncio
async def test_es256_webhook_body_binding_and_cache():
    private = ec.generate_private_key(ec.SECP256R1())
    public = json.loads(jwt.algorithms.ECAlgorithm.to_jwk(private.public_key()))
    public.update(kid="key-1", alg="ES256", expired_at=time.time() + 60)
    client = KeyClient(public)
    verifier = WebhookVerifier(client)
    body = b'{"webhook_type":"TRANSACTIONS","webhook_code":"SYNC_UPDATES_AVAILABLE"}'
    token = jwt.encode({"iat": int(time.time()), "request_body_sha256": hashlib.sha256(body).hexdigest()}, private, algorithm="ES256", headers={"kid": "key-1"})
    assert await verifier.verify(token, body) == hashlib.sha256(body).hexdigest()
    assert await verifier.verify(token, body) and client.calls == 1
    with pytest.raises(WebhookVerificationError):
        await verifier.verify(token, body + b" ")


@pytest.mark.asyncio
async def test_webhook_rejects_wrong_algorithm_and_stale_timestamp():
    private = ec.generate_private_key(ec.SECP256R1())
    public = json.loads(jwt.algorithms.ECAlgorithm.to_jwk(private.public_key()))
    public.update(kid="key-1", alg="ES256", expired_at=time.time() + 60)
    verifier = WebhookVerifier(KeyClient(public))
    body = b"{}"
    stale = jwt.encode({"iat": int(time.time()) - 301, "request_body_sha256": hashlib.sha256(body).hexdigest()}, private, algorithm="ES256", headers={"kid": "key-1"})
    with pytest.raises(WebhookVerificationError): await verifier.verify(stale, body)
    wrong = jwt.encode({"iat": int(time.time()), "request_body_sha256": hashlib.sha256(body).hexdigest()}, "a-secret-key-that-is-at-least-32-bytes", algorithm="HS256", headers={"kid": "key-1"})
    with pytest.raises(WebhookVerificationError): await verifier.verify(wrong, body)
