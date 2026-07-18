# Agent guide — ArpaDashboard

This file is for coding agents and humans automating home-lab service registration.

ArpaDashboard is a **private LAN** tool. Do not expose it to the public internet. Never commit `API_KEY`, `.env`, or real LAN secrets into git.

## Goal (local / WIP app)

Register a developer machine’s app under **`*.dev.home.arpa`** so it is reachable as:

```text
https://<name>.dev.home.arpa
```

(no port in the URL). That requires **`proxy: true`** (default) plus a reverse proxy (usually Caddy) that forwards the hostname to `ip:port`.

## Prerequisites

1. ArpaDashboard is running and reachable (example base: `https://home.home.arpa` or `http://127.0.0.1:8787`).
2. You have `API_KEY` (Bearer token).
3. The app listens on a **LAN IP** (not `127.0.0.1` / `localhost`) so other devices and the proxy can reach it.
4. You know the listen **port** (e.g. Vite `5174`).

### Obtain `API_KEY`

- Local Docker/Node: value of `API_KEY` in the instance `.env` (never commit this file).
- Shared lab: ask the lab operator; they read it from the instance secrets/env file only.
- Do **not** invent a key or reuse unrelated passwords.

## Preferred path: HTTP API

Base URL: `<BASE>` = origin of ArpaDashboard (no trailing slash), e.g. `https://home.home.arpa`.

### 1. Health check

```bash
curl -sS "$BASE/api/health"
```

Expect JSON with `"ok": true` and a `zones` array that includes `dev.home.arpa`.

### 2. Register / upsert (portless URL)

Replace placeholders. Keep `"proxy": true`.

```bash
export BASE='https://home.home.arpa'   # or http://127.0.0.1:8787
export API_KEY='…'                     # from .env / lab admin

curl -sS -X POST "$BASE/api/services" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "myapp",
    "zone": "dev.home.arpa",
    "ip": "192.168.1.50",
    "port": 5174,
    "title": "My Vite app",
    "group": "Development",
    "proxy": true,
    "protocol": "https"
  }'
```

| Field | Rule |
|---|---|
| `name` | DNS label only (`^[a-z0-9]([a-z0-9-]*[a-z0-9])?$`). Hostname becomes `name.zone`. |
| `zone` | Must be `dev.home.arpa` for WIP / laptop work. |
| `ip` | Machine **Network** IPv4 from the app (Vite “Network” line), never `127.0.0.1`. |
| `port` | **Required** when `proxy` is true (backend for Caddy). |
| `proxy` | `true` → DNS points at `CADDY_IP`; public URL has **no port**. |
| `group` | Dashboard category (use `Development` for WIP). |

Success: HTTP `201` (created) or `200` (updated). Body includes `service.hostname`, `service.href`, and `integrations`.

### 3. Verify registry

```bash
curl -sS "$BASE/api/services?zone=dev.home.arpa"
```

Confirm your `hostname` appears (e.g. `myapp.dev.home.arpa`).

### 4. Reverse proxy (required for no-port HTTPS)

If this instance has **Caddy snippet automation** enabled (`CADDY_SNIPPET_PATH` set), the API response `integrations.caddy` should succeed and the proxy reloads or already imports that snippet.

If snippet automation is **off** (common): after API success, the lab operator must add a Caddy (or equivalent) site for `myapp.dev.home.arpa` → `reverse_proxy <ip>:<port>`, then reload the proxy. DNS alone is not enough for portless HTTPS.

### 5. Open the app

```text
https://myapp.dev.home.arpa
```

Clients must trust the lab’s local CA if using HTTPS with an internal certificate.

## UI alternative (same defaults)

1. Open `$BASE/dev.html`
2. Paste `API_KEY`
3. Fill name, LAN IP, port; leave **Proxy via Caddy** checked
4. Save
5. Complete proxy step above if snippets are not automated

Interactive OpenAPI: `$BASE/api/docs` (Authorize with the same key).

## Update vs create

`POST /api/services` **upserts by hostname** (`name` + `zone`). Same name+zone updates IP/port/title/etc.

Partial update:

```bash
curl -sS -X PATCH "$BASE/api/services/<id>" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"port": 5175, "group": "Development"}'
```

List ids via `GET /api/services` or `GET /api/services?zone=dev.home.arpa`.

## Cleanup

```bash
curl -sS -X DELETE "$BASE/api/services/<id>" \
  -H "Authorization: Bearer $API_KEY"
```

Or move to category `Paused` via Manage UI / `PATCH` `{"group":"Paused","paused":true}`.

## Agent checklist

- [ ] Used LAN IP, not localhost
- [ ] `zone` is `dev.home.arpa`
- [ ] `proxy: true` and `port` set (portless public URL)
- [ ] `Authorization: Bearer` header present on writes
- [ ] Confirmed service in `GET /api/services?zone=dev.home.arpa`
- [ ] Confirmed reverse proxy targets `ip:port` (snippet or manual)
- [ ] Did not commit `API_KEY` or `.env`

## Do not

- Do not use `*.local` or public `.dev` as the zone.
- Do not invent zones outside `ALLOWED_ZONES` (default: `home.arpa`, `dev.home.arpa`, `test.home.arpa`).
- Do not register with `proxy: false` if the requirement is a **portless** URL (that mode needs `:port` or a separate proxy setup).
- Do not print secrets into logs, PRs, or public docs.

## Stable vs WIP zones

| Zone | Use |
|---|---|
| `home.arpa` | Deployed / shared stable services |
| `dev.home.arpa` | Laptop / WIP (this guide) |
| `test.home.arpa` | Temporary experiments |
