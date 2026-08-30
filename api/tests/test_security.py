import base64
import logging
import secrets

import pytest

from fintrack.core.logging import RedactingFilter, redact
from fintrack.db.types import decrypt_token, encrypt_token


def test_aes_gcm_is_random_and_rejects_tampering():
    key = base64.b64encode(secrets.token_bytes(32)).decode()
    first = encrypt_token("access-secret", key)
    second = encrypt_token("access-secret", key)
    assert first != second and b"access-secret" not in first
    assert decrypt_token(first, key) == "access-secret"
    damaged = first[:-1] + bytes([first[-1] ^ 1])
    with pytest.raises(ValueError):
        decrypt_token(damaged, key)
    with pytest.raises(ValueError):
        encrypt_token("token", "bad-key")


def test_recursive_log_redaction():
    value = redact({"access_token": "token", "nested": [{"Authorization": "Bearer value"}], "url": "postgresql://user:pass@db/name"})
    rendered = str(value)
    assert "'token'" not in rendered and "Bearer value" not in rendered and "pass@" not in rendered
