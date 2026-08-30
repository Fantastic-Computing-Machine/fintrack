"""Browser reference for the read-only MCP surface."""

from html import escape

from fastapi import FastAPI
from starlette.responses import HTMLResponse

from .mcp_server import MCP_TOOL_DOCS


def mcp_reference_html(endpoint: str) -> str:
    tools = "".join(
        f"""<article><code>{escape(tool['name'])}</code><h2>{escape(tool['title'])}</h2><p>{escape(tool['description'])}</p>
        <h3>Inputs</h3>{'<p>None</p>' if not tool['parameters'] else '<table><thead><tr><th>Name</th><th>Type</th><th>Required</th><th>Description</th></tr></thead><tbody>' + ''.join(f'<tr><td><code>{escape(name)}</code></td><td>{escape(kind)}</td><td>{escape(required)}</td><td>{escape(description)}</td></tr>' for name, kind, required, description in tool['parameters']) + '</tbody></table>'}
        <h3>Returns</h3><p>{escape(tool['returns'])}</p></article>"""
        for tool in MCP_TOOL_DOCS
    )
    return f"""<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Fin Track MCP</title><style>
    :root{{color-scheme:light dark;font-family:ui-sans-serif,system-ui,sans-serif;line-height:1.5}}body{{margin:0}}main{{max-width:760px;margin:auto;padding:40px 24px 72px}}h1{{font-size:2rem;letter-spacing:-.03em;margin:0}}h2{{font-size:1.2rem;margin:.4rem 0}}h3{{font-size:.8rem;letter-spacing:.06em;text-transform:uppercase;margin:1.25rem 0 .35rem;opacity:.7}}p{{margin:.45rem 0}}.lead{{max-width:40rem}}.meta{{margin:28px 0;border-block:1px solid color-mix(in srgb,currentColor 20%,transparent)}}.meta div{{padding:14px 0;border-bottom:1px solid color-mix(in srgb,currentColor 20%,transparent)}}.meta div:last-child{{border-bottom:0}}.meta strong{{display:block;font-size:.82rem;margin-bottom:4px}}code,pre{{font-family:ui-monospace,SFMono-Regular,monospace;font-size:.9em}}pre{{margin:0;white-space:pre-wrap}}article{{border-top:1px solid color-mix(in srgb,currentColor 20%,transparent);padding:24px 0}}table{{width:100%;border-collapse:collapse;font-size:.9rem}}th,td{{padding:8px 6px;border-top:1px solid color-mix(in srgb,currentColor 20%,transparent);text-align:left;vertical-align:top}}th{{font-weight:600}}@media(max-width:600px){{main{{padding:28px 16px 48px}}table{{font-size:.82rem}}th,td{{padding:7px 4px}}}}</style></head><body><main>
    <h1>Fin Track MCP</h1><p class=\"lead\">Private, read-only financial data over Streamable HTTP. Amounts are decimal strings.</p>
    <section class=\"meta\"><div><strong>Endpoint</strong><pre>{escape(endpoint)}/mcp</pre></div><div><strong>Authentication</strong><pre>Authorization: Bearer &lt;MCP_AUTH_TOKEN&gt;</pre></div><div><strong>Safety</strong>No write, sync, connection-management, provider-token, secret, or raw-SQL tools. Results include only active accounts on non-disconnected connections; transactions cap at 200.</div></section>
    <h2>Tools</h2>{tools}</main></body></html>"""


def register_mcp_docs(app: FastAPI, endpoint: str) -> None:
    @app.get("/mcp/docs", include_in_schema=False, response_class=HTMLResponse)
    async def mcp_docs():
        return mcp_reference_html(endpoint)
