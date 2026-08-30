import logging
import re
from collections.abc import Mapping
from typing import Any

SENSITIVE = {
    "access_token", "new_access_token", "public_token", "secret", "plaid_secret",
    "authorization", "cookie", "set-cookie", "database_url", "password",
}
_URL_CREDENTIALS = re.compile(r"(?P<scheme>[a-z][a-z0-9+.-]*://)[^/@\s:]+:[^/@\s]+@", re.I)


def redact(value: Any, key: str = "") -> Any:
    if key.lower().replace("-", "_") in SENSITIVE:
        return "[REDACTED]"
    if isinstance(value, Mapping):
        return {item_key: redact(item_value, str(item_key)) for item_key, item_value in value.items()}
    if isinstance(value, (list, tuple)):
        return type(value)(redact(item) for item in value)
    if isinstance(value, str):
        return _URL_CREDENTIALS.sub(r"\g<scheme>[REDACTED]@", value)
    return value


class RedactingFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.msg = redact(record.msg)
        record.args = redact(record.args)
        return True


def configure_logging(level: str) -> None:
    logging.basicConfig(level=level)
    for handler in logging.getLogger().handlers:
        handler.addFilter(RedactingFilter())
