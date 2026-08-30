# Fin Track

Private, read-only Plaid dashboard. The Next.js UI talks only to FastAPI; a separate worker consumes the database queue. SQLite is the local default and PostgreSQL is the deployment target.

## Start locally

Requirements: Python 3.14, [`uv`](https://docs.astral.sh/uv/), and Node.js 24.

```powershell
cd api
uv sync --dev
Copy-Item .env.example .env
uv run python -c "import base64,secrets; print(base64.b64encode(secrets.token_bytes(32)).decode())"
uv run python -c "from pwdlib import PasswordHash; print(PasswordHash.recommended().hash('your-password'))"
```

Put those values in `.env` as `PLAID_TOKEN_MASTER_KEY` and `OWNER_PASSWORD_HASH`. Set a long random `SESSION_SIGNING_KEY` and Plaid credentials. Then use three terminals:

```powershell
# terminal 1
cd api
uv run alembic upgrade head
uv run uvicorn fintrack.main:app --reload

# terminal 2
cd api
uv run python -m fintrack.worker

# terminal 3
cd app
Copy-Item .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). For containers, fill `api/.env`, set `POSTGRES_PASSWORD`, then run `docker compose up --build`.

## Webhooks and checks

Set `APP__WEBHOOK_URL` to the public HTTPS URL ending in `/api/v1/webhooks/plaid`. Cloudflare Tunnel or ngrok can forward only that route to port 8000. Plaid JWT signatures are authoritative. Optional edge allowlisting may use Plaid's currently documented sources `52.21.26.131`, `52.21.47.157`, `52.41.247.19`, and `52.88.82.239`, but Plaid says these can change—verify the current list before deployment.

```powershell
cd api; uv run pytest -q
cd ..\app; npm run lint; npm run build
```

Never place database credentials or encryption keys in `alembic.ini`. Existing Fernet token rows require both `OLD_TOKEN_ENCRYPTION_KEY` and `PLAID_TOKEN_MASTER_KEY` for the hardening migration. Future master-key changes must be explicit Alembic data migrations; autogenerate cannot rotate ciphertext.
