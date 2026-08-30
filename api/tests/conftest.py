import os

os.environ.setdefault("APP__ENVIRONMENT", "test")
os.environ.setdefault("SESSION_SIGNING_KEY", "test-signing-key")
os.environ.setdefault("OWNER_PASSWORD_HASH", "unused-in-global-settings")
os.environ.setdefault("PLAID_TOKEN_MASTER_KEY", "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")
