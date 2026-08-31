# Fin Track

Private, read-only Plaid dashboard. The Next.js UI talks only to FastAPI; FastAPI starts the lightweight database-queue worker with the API process. SQLite is the local default and PostgreSQL is the deployment target.

## Start locally

Requirements: Python 3.14, [`uv`](https://docs.astral.sh/uv/), and Node.js 24.

```powershell
cd api
uv sync --dev
Copy-Item .env.example .env
uv run python -c "import base64,secrets; print(base64.b64encode(secrets.token_bytes(32)).decode())"
uv run python -c "from pwdlib import PasswordHash; print(PasswordHash.recommended().hash('your-password'))"
```

Put those values in `.env` as `PLAID_TOKEN_MASTER_KEY` and `OWNER_PASSWORD_HASH`. Set a long random `SESSION_SIGNING_KEY` and Plaid credentials. Then use two terminals:

```powershell
# terminal 1
cd api
uv run alembic upgrade head
uv run python -m fintrack.main
```

This starts the API on `0.0.0.0:8000` for LAN access. If you prefer Uvicorn directly, include the ASGI attribute and host explicitly:

```powershell
uv run uvicorn fintrack.main:app --host 0.0.0.0 --port 8000 --reload
```

```powershell
# terminal 2
cd app
Copy-Item .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Docker Compose (Raspberry Pi / LAN)

Both Compose options run the same single `fintrack` image, which contains the Next.js UI and FastAPI process. Choose one database arrangement.

### Bundled PostgreSQL

`compose.yml` starts the dashboard, API, and a persistent PostgreSQL service:

```powershell
Copy-Item .env.example .env
Copy-Item api/.env.example api/.env
# Set API secrets, MCP_ENABLE, and MCP_AUTH_TOKEN in api/.env.
# Set NEXT_PUBLIC_API_URL in .env to http://<pi-LAN-IP-or-hostname>:8000.
docker compose up --build -d
```

### External PostgreSQL

`compose.external-db.yml` starts only the `fintrack` image. Point `DATABASE_URL` in `api/.env` at your managed or self-hosted PostgreSQL instance, then start it:

```powershell
Copy-Item .env.example .env
Copy-Item api/.env.example api/.env
# Set DATABASE_URL and API secrets in api/.env. Set NEXT_PUBLIC_API_URL in .env.
docker compose -f compose.external-db.yml up --build -d
```

Set `APP__FRONTEND_URL=http://<pi-LAN-IP-or-hostname>:3000` in `api/.env` when opening the dashboard from another LAN device. View logs with `docker compose logs -f fintrack` and stop it with `docker compose down`.

## Read-only MCP

Set `MCP_ENABLE=true` and a long random `MCP_AUTH_TOKEN` in `api/.env` to expose the authenticated Streamable HTTP endpoint at `http://localhost:8000/mcp`. Configure your MCP client with `Authorization: Bearer <MCP_AUTH_TOKEN>`. Set `DOCS_ENABLE=true` to expose `/docs`, `/redoc`, `/openapi.json`, and the browser-friendly MCP reference at `/mcp/docs`; both features default off. See [MCP.md](MCP.md) for client configuration and the complete read-only tool reference.

## Webhooks and checks

Set `APP__WEBHOOK_URL` to the public HTTPS URL ending in `/api/v1/webhooks/plaid`. Cloudflare Tunnel or ngrok can forward only that route to port 8000. Plaid JWT signatures are authoritative. Optional edge allowlisting may use Plaid's currently documented sources `52.21.26.131`, `52.21.47.157`, `52.41.247.19`, and `52.88.82.239`, but Plaid says these can change—verify the current list before deployment.

```powershell
cd api; uv run pytest -q
cd ..\app; npm run lint; npm run build
```

Never place database credentials or encryption keys in `alembic.ini`. Existing Fernet token rows require both `OLD_TOKEN_ENCRYPTION_KEY` and `PLAID_TOKEN_MASTER_KEY` for the hardening migration. Future master-key changes must be explicit Alembic data migrations; autogenerate cannot rotate ciphertext.
