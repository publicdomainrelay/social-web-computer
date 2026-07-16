#!/usr/bin/env bash
set -xeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ORG_ROOT="$(dirname "$PROJECT_DIR")"

SSH_TARGET="${SSH_TARGET:-root@socialweb.computer}"
SSH_OPTS="-o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 -o BatchMode=yes"

# ── Build static site ──────────────────────────────────────────────────────────

cd "$PROJECT_DIR"
deno run -A build.ts
mv dist fancy

mkdir -p dist/
uv run ../scripts/md.py ../README.md -o dist/index.html
mv fancy dist/

# ── Stage on remote ────────────────────────────────────────────────────────────

cd "$PROJECT_DIR"

ssh ${SSH_OPTS} "${SSH_TARGET}" "rm -rf /tmp/stage-social-web-computer && mkdir -p /tmp/stage-social-web-computer"
scp ${SSH_OPTS} -r dist/* "${SSH_TARGET}":/tmp/stage-social-web-computer/

# Caddyfile (includes digitalocean.socialweb.computer reverse-proxy)
scp ${SSH_OPTS} Caddyfile "${SSH_TARGET}":/tmp/stage-social-web-computer/Caddyfile

# ── DO OAuth secrets ───────────────────────────────────────────────────────────
# Forward DO_OAUTH_CLIENT_ID / DO_OAUTH_CLIENT_SECRET from the caller shell into a
# 0600 EnvironmentFile on the remote (kept out of the unit text, ps, and journal).
# Single-quoted remote heredocs below cannot expand local vars, so ship a file.
OAUTH_ENV="$(mktemp)"
trap 'rm -f "$OAUTH_ENV"' EXIT
{
  [ -n "${DO_OAUTH_CLIENT_ID:-}" ] && echo "DO_OAUTH_CLIENT_ID=${DO_OAUTH_CLIENT_ID}"
  [ -n "${DO_OAUTH_CLIENT_SECRET:-}" ] && echo "DO_OAUTH_CLIENT_SECRET=${DO_OAUTH_CLIENT_SECRET}"
} > "$OAUTH_ENV"
scp ${SSH_OPTS} "$OAUTH_ENV" "${SSH_TARGET}":/tmp/stage-social-web-computer/oauth.env

# ── Ship full org-root ─────────────────────────────────────────────────────────
# The bidder runs from source (deno run) so its jsr package registry can serve
# every @publicdomainrelay/* package from the real org-root tree. A deno compile
# binary cannot: import.meta.url resolves into the compile VFS, not a real FS, so
# the local-fs package store scans nothing. Stream the org-root over ssh instead.

echo "=== shipping org-root ==="
tar czf - -C "$ORG_ROOT" \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.codegraph' \
  --exclude='digitalocean-bidder/data' \
  --exclude='social-web-computer/dist' \
  --exclude='social-web-computer/fancy' \
  --exclude='*.tgz' \
  . | ssh ${SSH_OPTS} "${SSH_TARGET}" \
    "rm -rf /opt/org-root && mkdir -p /opt/org-root && tar xzf - -C /opt/org-root"
echo "=== org-root shipped → /opt/org-root ==="

# ── Remote setup ───────────────────────────────────────────────────────────────

ssh ${SSH_OPTS} "${SSH_TARGET}" bash -xe <<'REMOTE_EOF'

# ── Static site ────────────────────────────────────────────────────────────────
mkdir -p /var/www/socialweb.computer
rm -rf /var/www/socialweb.computer/*
mv /tmp/stage-social-web-computer/fancy/* /var/www/socialweb.computer/
mv /tmp/stage-social-web-computer/index.html /var/www/socialweb.computer/
# Copy remaining loose files (styles.css, main.js, *.html)
for f in /tmp/stage-social-web-computer/*; do
  if [ -f "$f" ] && [ ! -d "$f" ]; then
    cp "$f" /var/www/socialweb.computer/
  fi
done
true
chown -R caddy:caddy /var/www/socialweb.computer

# ── DigitalOcean bidder ────────────────────────────────────────────────────────
# Runs from source under /opt/org-root so the bidder's jsr registry serves
# @publicdomainrelay/* packages to guests from the real org-root tree.
mkdir -p /opt/digitalocean-bidder/data/pgdata

# DO OAuth secrets from caller shell (0600, referenced via EnvironmentFile).
install -m 600 /tmp/stage-social-web-computer/oauth.env /opt/digitalocean-bidder/oauth.env

# deno runtime (idempotent) — bidder runs via `deno run`, not a compiled binary.
if ! command -v deno >/dev/null 2>&1; then
  apt-get update && apt-get install -y curl unzip
  curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh
  chmod 755 /usr/local/bin/deno
fi

# ── systemd unit ───────────────────────────────────────────────────────────────
cat > /etc/systemd/system/digitalocean-bidder.service <<'UNIT'
[Unit]
Description=DigitalOcean Compute Bidder
After=network.target network-online.target
Requires=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/org-root/digitalocean-bidder
ExecStart=/usr/local/bin/deno run -A /opt/org-root/digitalocean-bidder/mod.ts \
  --serve-port 8000 \
  --serve-addr 127.0.0.1 \
  --public-origin https://digitalocean.socialweb.computer \
  --db-path /opt/digitalocean-bidder/data/pgdata \
  --ingress-proxy-host xrpc.fedproxy.com
EnvironmentFile=-/opt/digitalocean-bidder/oauth.env
Environment=DO_OAUTH_REDIRECT_URI=https://digitalocean.socialweb.computer/auth/digitalocean/callback
Restart=always
RestartSec=5
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable digitalocean-bidder
systemctl restart digitalocean-bidder || true
sleep 2
systemctl status --no-pager digitalocean-bidder || true

# ── Caddy ──────────────────────────────────────────────────────────────────────
mv /tmp/stage-social-web-computer/Caddyfile /etc/caddy/Caddyfile
systemctl reload caddy || systemctl restart caddy
systemctl status --no-pager caddy.service || true

echo "Deploy complete → https://socialweb.computer"
echo "Bidder → https://digitalocean.socialweb.computer"
REMOTE_EOF
