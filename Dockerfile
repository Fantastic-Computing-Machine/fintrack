# syntax=docker/dockerfile:1

# =========================================================
# Next.js builder
# =========================================================

FROM node:24-slim AS frontend-builder

WORKDIR /build/app

COPY app/package*.json ./
RUN npm ci

COPY app/ ./

ARG NEXT_PUBLIC_API_URL=http://localhost:8000

ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN npm run build


# =========================================================
# Python builder
# =========================================================

FROM python:3.14-slim AS python-builder

COPY --from=ghcr.io/astral-sh/uv:latest \
    /uv \
    /usr/local/bin/uv

WORKDIR /opt/fintrack/api

COPY api/pyproject.toml api/uv.lock ./

RUN uv sync \
    --frozen \
    --no-dev \
    --no-install-project


# =========================================================
# Runtime
# =========================================================

FROM python:3.14-slim

# Next.js standalone runtime needs only the Node binary.
COPY --from=node:24-slim \
    /usr/local/bin/node \
    /usr/local/bin/node

WORKDIR /opt/fintrack


# ---------------------------------------------------------
# FastAPI
# ---------------------------------------------------------

COPY --from=python-builder \
    /opt/fintrack/api/.venv \
    /opt/fintrack/api/.venv

COPY api/ /opt/fintrack/api/


# ---------------------------------------------------------
# Next.js
# ---------------------------------------------------------

COPY --from=frontend-builder \
    /build/app/.next/standalone \
    /opt/fintrack/app/

COPY --from=frontend-builder \
    /build/app/.next/static \
    /opt/fintrack/app/.next/static

COPY --from=frontend-builder \
    /build/app/public \
    /opt/fintrack/app/public

# ---------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------

COPY docker-entrypoint.sh \
    /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
    && useradd --system --uid 10001 --create-home fintrack \
    && chown -R fintrack:fintrack /opt/fintrack


ENV PATH="/opt/fintrack/api/.venv/bin:${PATH}" \
    NODE_ENV=production

EXPOSE 3000 8000

USER fintrack

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
