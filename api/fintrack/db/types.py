from __future__ import annotations

import base64
import os

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from sqlalchemy import LargeBinary
from sqlalchemy.types import TypeDecorator

_VERSION = b"\x01"
_AAD = b"fintrack:plaid-access-token:v1"
_NONCE_BYTES = 12


def _key(value: str | None = None) -> bytes:
    encoded = value if value is not None else os.environ.get("PLAID_TOKEN_MASTER_KEY", "")
    if value is None and not encoded:
        from ..core.config import get_settings
        encoded = get_settings().plaid_token_master_key
    try:
        key = base64.b64decode(encoded, altchars=b"-_", validate=True)
    except Exception as exc:
        raise ValueError("PLAID_TOKEN_MASTER_KEY must be valid base64") from exc
    if len(key) != 32:
        raise ValueError("PLAID_TOKEN_MASTER_KEY must decode to exactly 32 bytes")
    return key


def encrypt_token(value: str, key_value: str | None = None) -> bytes:
    nonce = os.urandom(_NONCE_BYTES)
    return _VERSION + nonce + AESGCM(_key(key_value)).encrypt(nonce, value.encode(), _AAD)


def decrypt_token(value: bytes, key_value: str | None = None) -> str:
    if not isinstance(value, bytes) or len(value) < 1 + _NONCE_BYTES + 16 or value[:1] != _VERSION:
        raise ValueError("Invalid encrypted Plaid token envelope")
    nonce = value[1 : 1 + _NONCE_BYTES]
    try:
        return AESGCM(_key(key_value)).decrypt(nonce, value[1 + _NONCE_BYTES :], _AAD).decode()
    except (InvalidTag, UnicodeDecodeError) as exc:
        raise ValueError("Plaid token authentication failed") from exc


class EncryptedPlaidToken(TypeDecorator[str]):
    impl = LargeBinary
    cache_ok = True

    def process_bind_param(self, value: str | None, dialect) -> bytes | None:
        return encrypt_token(value) if value is not None else None

    def process_result_value(self, value: bytes | None, dialect) -> str | None:
        return decrypt_token(bytes(value)) if value is not None else None
