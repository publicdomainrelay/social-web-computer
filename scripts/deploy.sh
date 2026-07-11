#!/usr/bin/env bash
set -xeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Build
deno run -A build.ts

# Deploy — adjust SSH_TARGET to your server
SSH_TARGET="${SSH_TARGET:-root@computecontracts.org}"
SSH_OPTS="-o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 -o BatchMode=yes"

ssh ${SSH_OPTS} "${SSH_TARGET}" "rm -rf /tmp/stage-social-web-computer && mkdir -p /tmp/stage-social-web-computer"
scp ${SSH_OPTS} -r dist/* "${SSH_TARGET}":/tmp/stage-social-web-computer/

ssh ${SSH_OPTS} "${SSH_TARGET}" bash -xe <<'REMOTE_EOF'
  mkdir -p /var/www/computecontracts.org
  rm -rf /var/www/computecontracts.org/*
  mv /tmp/stage-social-web-computer/* /var/www/computecontracts.org/
  chown -R caddy:caddy /var/www/computecontracts.org
  echo "Deploy complete → https://computecontracts.org"
REMOTE_EOF
