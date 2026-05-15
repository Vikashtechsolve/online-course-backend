#!/usr/bin/env bash
# Run ON THE PRODUCTION SERVER (Ubuntu + nginx) as a user with sudo.
# Inserts client_max_body_size into the lmsapi server block.
set -euo pipefail

SITE_NAME="${SITE_NAME:-lmsapi.vikashtechsolution.com}"
SITES_AVAILABLE="/etc/nginx/sites-available/${SITE_NAME}"
MARK="client_max_body_size 2048M"

if [[ ! -f "$SITES_AVAILABLE" ]]; then
  echo "Site config not found: $SITES_AVAILABLE"
  echo "Install deploy/nginx-lmsapi.conf or set SITE_NAME."
  exit 1
fi

if grep -q "$MARK" "$SITES_AVAILABLE"; then
  echo "Already configured: $MARK in $SITES_AVAILABLE"
else
  BACKUP="${SITES_AVAILABLE}.bak.$(date +%Y%m%d%H%M%S)"
  sudo cp "$SITES_AVAILABLE" "$BACKUP"
  echo "Backup: $BACKUP"
  sudo sed -i "/server_name.*${SITE_NAME}/a\\
    client_max_body_size 2048M;\\
    proxy_read_timeout 7200s;\\
    proxy_send_timeout 7200s;\\
    send_timeout 7200s;" "$SITES_AVAILABLE"
  echo "Inserted upload limits after server_name in $SITES_AVAILABLE"
fi

sudo nginx -t
sudo systemctl reload nginx
echo "nginx reloaded — retry the lecture video upload."
