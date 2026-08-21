#!/bin/bash
# DuckDNS/HTTPS values — `make provision` PREPENDS the real values above this
# block (they sit above `set -euxo pipefail`, so xtrace never echoes the token
# into cloud-init logs; the launch copy lives under ~/.aws/state, mode 0600,
# never in git — same rule as the JWT keys). Empty here = plain HTTP demo.
DUCK_DNS_DOMAIN=''
DUCK_DNS_TOKEN=''
LE_EMAIL=''
# Solara demo host bootstrap (Amazon Linux 2023, arm64)
# ---------------------------------------------------------------------------
# Runs once via EC2 user-data on first launch. AL2023 ships WITHOUT Docker
# (verified against AWS docs) — everything needed is installed here. The repo
# is public, so the clone needs no credentials; no secrets ever land on this
# box (same pattern as getnable/finopsmcp).
#
# The stack is 100% compose-managed — including the frontend, which builds in
# its own image (node:22 build → nginx serve) and owns ports 80/443. The host
# installs NO nginx and NO Node: user-data only prepares runtime dirs + certs.
#
# First boot is SLOW on a t4g.small: docker compose --build compiles 4 Spring
# Boot images in-container (Maven) + the frontend image (npm ci + vite),
# 15-40 min. Subsequent boots are fast — the systemd unit at the end just
# runs `docker compose up -d`.
set -euxo pipefail
chmod 600 /var/log/cloud-init-output.log 2>/dev/null || true   # user-data echo (incl. curl URLs) stays private
# AL2023 repos ship `docker` but NOT the compose plugin — that comes from Docker's
# official repo. AL2023's $releasever has no path on download.docker.com, so pin the
# baseurl to centos/9 (AL2023 is RHEL9-compatible — verified live 2026-08-02).
# Use the FULL docker-ce suite (engine + cli + buildx + compose), NOT Amazon's
# docker package: dnf pulls docker-buildx-plugin via weak deps and it conflicts
# with amazonlinux's docker over /usr/libexec/docker/cli-plugins/docker-buildx
# (transaction test error, seen live). One repo = one coherent engine + plugins.
dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
dnf config-manager --setopt=docker-ce-stable.baseurl=https://download.docker.com/linux/centos/9/\$basearch/stable --save
dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin git certbot
systemctl enable --now docker

# --- 2. swap: t4g.small has 2 GiB RAM; 4 JVMs + Kafka + 3 Postgres + Ollama ---
if [ ! -f /swapfile ]; then
  fallocate -l 4G /swapfile && chmod 600 /swapfile
  mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# --- 3. repo (public, no credentials) ---
mkdir -p /srv/solara
if [ ! -d /srv/solara/.git ]; then
  # Deploy branch is `production` — the default-branch clone would land on `main`,
  # which carries no deployment assets and no CI (ea91877). make deploy / git pull
  # on the host must track production.
  git clone -b production --single-branch https://github.com/stealthyninja86/Solara.git /srv/solara
fi
cd /srv/solara

# --- 4. compose bind-mount targets that git does not track ---
mkdir -p auth-service/auth-service-db
chown 999:999 auth-service/auth-service-db          # postgres official image uid
mkdir -p data/uploads/tmp                            # multipart upload location
mkdir -p certs certbot-webroot                       # frontend mounts (gitignored): TLS certs + ACME webroot

# --- 5. JWT keys: generated per deployment, never committed ---------------------
# auth-service signs JWTs (private.pem), the gateway verifies (public.pem). The
# keys are untracked in git (the repo only carries the Dockerfiles), so a fresh
# clone has no key files and the api-gateway image build fails at its
# COPY src/main/resources/keys/public.pem (seen live). Generate the pair
# together on first boot so both services always share a matching pair, and
# never land in the repo — committing private.pem would let anyone forge tokens.
mkdir -p auth-service/src/main/resources/keys api-gateway/src/main/resources/keys
if [ ! -f auth-service/src/main/resources/keys/private.pem ]; then
  openssl genrsa -out auth-service/src/main/resources/keys/private.pem 2048
  openssl rsa -in auth-service/src/main/resources/keys/private.pem -pubout \
    -out auth-service/src/main/resources/keys/public.pem
fi
cp auth-service/src/main/resources/keys/public.pem api-gateway/src/main/resources/keys/public.pem

# --- 6. build + start the stack (Maven + frontend builds inside images; slow first run) ---
# The frontend container starts in plain-HTTP mode (no certs in ./certs yet);
# the deploy hook below drops real certs in and restarts it into HTTPS mode.
docker compose up -d --build

# --- 7. HTTPS: DuckDNS A-record + Let's Encrypt (certbot webroot) --------------
# Enabled only when `make provision` was given DUCK_DNS_DOMAIN + DUCK_DNS_TOKEN.
# The box has NO Elastic IP, so the public IP changes on every stop/start:
# solara-duckdns.service (below) re-points the A-record on each boot and
# certbot-renew.timer renews the 90-day cert. certbot is deliberately
# NON-FATAL: a cert hiccup must not abort first boot; retry manually per the docs.
if [ -n "$DUCK_DNS_DOMAIN" ] && [ -n "$DUCK_DNS_TOKEN" ]; then
  echo "HTTPS enabled for ${DUCK_DNS_DOMAIN}.duckdns.org"
  FQDN="${DUCK_DNS_DOMAIN}.duckdns.org"

  # persist token for boot-time updates (root-only; never in git)
  mkdir -p /etc/solara
  set +x   # never echo the token into cloud-init logs
  cat > /etc/solara/duckdns.conf <<EOF
DUCK_DNS_DOMAIN='${DUCK_DNS_DOMAIN}'
DUCK_DNS_TOKEN='${DUCK_DNS_TOKEN}'
EOF
  chmod 600 /etc/solara/duckdns.conf
  curl -fsS "https://www.duckdns.org/update?domains=${DUCK_DNS_DOMAIN}&token=${DUCK_DNS_TOKEN}&ip=" \
    -o /tmp/duckdns.update.log || echo "duckdns update failed: $(cat /tmp/duckdns.update.log 2>/dev/null || true)" >&2
  set -x

  # certbot's HTTP-01 needs the FQDN resolving to THIS box's public IP
  PUBLIC_IP=$(curl -fsS --max-time 5 https://checkip.amazonaws.com 2>/dev/null || true)
  if [ -n "$PUBLIC_IP" ]; then
    for _ in $(seq 1 12); do
      RESOLVED=$(getent ahostsv4 "$FQDN" 2>/dev/null | awk 'NR==1{print $1}')
      [ -n "$RESOLVED" ] && [ "$RESOLVED" = "$PUBLIC_IP" ] && break
      sleep 10
    done
    sleep 10   # propagation cushion
  fi

  # deploy hook: copy the issued/renewed cert into the frontend's mount and
  # restart the container so its entrypoint swap enables the HTTPS server block.
  # Runs on EVERY successful issuance AND renewal (certbot renew --deploy-hook).
  cat > /usr/local/sbin/solara-cert-deploy.sh <<EOF
#!/bin/bash
set -euo pipefail
cp -L /etc/letsencrypt/live/${FQDN}/fullchain.pem /srv/solara/certs/fullchain.pem
cp -L /etc/letsencrypt/live/${FQDN}/privkey.pem /srv/solara/certs/privkey.pem
chmod 600 /srv/solara/certs/privkey.pem
docker compose -f /srv/solara/docker-compose.yml restart frontend
EOF
  chmod 700 /usr/local/sbin/solara-cert-deploy.sh

  if [ -n "$LE_EMAIL" ]; then
    CERTBOT_ACCOUNT=(--email "$LE_EMAIL")
  else
    CERTBOT_ACCOUNT=(--register-unsafely-without-email)
  fi
  certbot certonly --webroot -w /srv/solara/certbot-webroot \
    --non-interactive --agree-tos \
    "${CERTBOT_ACCOUNT[@]}" -d "$FQDN" \
    --deploy-hook /usr/local/sbin/solara-cert-deploy.sh \
    || echo "certbot failed — retry via ssh: sudo certbot certonly --webroot -w /srv/solara/certbot-webroot -d ${FQDN}" >&2
  systemctl enable --now certbot-renew.timer

  # every boot: repoint DuckDNS at the (possibly new) public IP
  cat > /usr/local/sbin/solara-duckdns-update.sh <<'EOF'
#!/bin/bash
set -euo pipefail
source /etc/solara/duckdns.conf
curl -fsS "https://www.duckdns.org/update?domains=${DUCK_DNS_DOMAIN}&token=${DUCK_DNS_TOKEN}&ip=" -o /tmp/duckdns.update.log
EOF
  chmod 700 /usr/local/sbin/solara-duckdns-update.sh
  cat > /etc/systemd/system/solara-duckdns.service <<'EOF'
[Unit]
Description=Solara DuckDNS A-record update (public IP changes on every start)
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/solara-duckdns-update.sh

[Install]
WantedBy=multi-user.target
EOF
  systemctl enable solara-duckdns.service
else
  echo "HTTPS skipped: set DUCK_DNS_DOMAIN + DUCK_DNS_TOKEN on make provision for a Let's Encrypt cert"
fi

# --- 8. boot persistence: user-data runs ONCE; this unit re-ups the stack on every start ---
cat > /etc/systemd/system/solara-stack.service <<'EOF'
[Unit]
Description=Solara docker-compose stack
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/srv/solara
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down

[Install]
WantedBy=multi-user.target
EOF
systemctl enable solara-stack.service

# --- 9. ssh user (make deploy / make ssh) can use docker + write the repo ---
usermod -aG docker ec2-user
chown -R ec2-user:ec2-user /srv/solara
# auth-service-db is a HOST BIND MOUNT that the postgres image (uid 999) must own:
# the recursive chown above strands the data dir (seen live 2026-08-15 —
# "could not open file global/pg_filenode.map: Permission denied", auth-service
# crashes at Flyway connect). Re-assert postgres ownership AFTER the recursive chown.
chown -R 999:999 /srv/solara/auth-service/auth-service-db

echo "Solara bootstrap complete: $(date -u +%FT%TZ)"
