# Fin Track MCP

The MCP endpoint is read-only. It runs inside FastAPI at `/mcp`; starting FastAPI also starts the database worker and, when enabled, MCP.

## Enable and start

Set these values in `api/.env`:

```env
MCP_ENABLE=true
MCP_AUTH_TOKEN=replace-with-a-long-random-secret
DOCS_ENABLE=false
```

Generate a token in PowerShell if needed:

```powershell
cd api
uv run python -c "import secrets; print(secrets.token_urlsafe(32))"
uv run alembic upgrade head
uv run python -m fintrack.main
```

The local endpoint is `http://localhost:8000/mcp`. An agent on another machine needs the API exposed over HTTPS and must use that reachable URL instead. Do not send the bearer token to an untrusted agent or commit it to source control.

## Connect an MCP client

Create a Streamable HTTP MCP connection with this URL and header:

```json
{
  "url": "http://localhost:8000/mcp",
  "headers": {
    "Authorization": "Bearer <MCP_AUTH_TOKEN>"
  }
}
```

For clients that use an `mcpServers` configuration object, the equivalent entry is:

```json
{
  "mcpServers": {
    "fin-track": {
      "type": "streamable-http",
      "url": "http://localhost:8000/mcp",
      "headers": {
        "Authorization": "Bearer <MCP_AUTH_TOKEN>"
      }
    }
  }
}
```

Use the configuration format your MCP client requires, but preserve the URL, Streamable HTTP transport, and bearer header. A missing or incorrect token receives `401 Unauthorized`.

## Tools

All money values are decimal strings to preserve precision. The server has no write, sync, token, raw-SQL, or connection-management tools.

| Tool | Inputs | Returns |
| --- | --- | --- |
| `get_financial_summary` | None | Cash, credit-card debt, net position, freshness, and connection error counts. |
| `list_accounts` | `account_type` optional | Active accounts, balances, masks, institution names, currencies, and timestamps. |
| `list_credit_cards` | None | Active credit cards, balances, limits, statement balances/dates, minimum payments, due dates, APRs, and overdue state. |
| `list_transactions` | `account_id`, `start_date`, `end_date`, `search` optional; `limit` optional (default 50, maximum 200) | Newest matching transactions and `truncated` when more results exist. Dates are `YYYY-MM-DD`. |
| `get_transaction_statement` | Required `account_id`, `start_date`, `end_date` | Account details and transactions in the requested date range, capped at 200 with `truncated`. This is a transaction view, not a bank-statement PDF. |

Only active accounts on non-disconnected connections are returned. Transaction searches are case-insensitive across merchant names and descriptions.
