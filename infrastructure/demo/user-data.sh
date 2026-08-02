#!/bin/bash
# Solara demo host bootstrap (Amazon Linux 2023, arm64)
# ---------------------------------------------------------------------------
# Runs once via EC2 user-data on first launch. AL2023 ships WITHOUT Docker
# (verified against AWS docs) — everything needed is installed here. The repo
# is public, so the clone needs no credentials; no secrets ever land on this
# box (same pattern as getnable/finopsmcp).
#
# First boot is SLOW on a t4g.small: docker compose --build compiles 4 Spring
# Boot images in-container (Maven), 15-40 min. Subsequent boots are fast —
# the systemd unit at the end just runs `docker compose up -d`.
set -euxo pipefail

# --- 1. packages: docker + compose plugin + nginx + Node 22 (frontend build) ---
# AL2023 repos ship `docker` but NOT the compose plugin — that comes from Docker's
# official repo. AL2023's $releasever has no path on download.docker.com, so pin the
# baseurl to centos/9 (AL2023 is RHEL9-compatible — verified live 2026-08-02).
# Use the FULL docker-ce suite (engine + cli + buildx + compose), NOT Amazon's
# docker package: dnf pulls docker-buildx-plugin via weak deps and it conflicts
# with amazonlinux's docker over /usr/libexec/docker/cli-plugins/docker-buildx
# (transaction test error, seen live). One repo = one coherent engine + plugins.
dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
dnf config-manager --setopt=docker-ce-stable.baseurl=https://download.docker.com/linux/centos/9/\$basearch/stable --save
dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin nginx nodejs22 git
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
  git clone https://github.com/stealthyninja86/service_categorizer.git /srv/solara
fi
cd /srv/solara

# --- 4. compose bind-mount targets that git does not track ---
mkdir -p auth-service/auth-service-db
chown 999:999 auth-service/auth-service-db          # postgres official image uid
mkdir -p data/uploads/tmp                            # multipart upload location

# --- 5. build + start the stack (Maven builds inside the images; slow first run) ---
docker compose up -d --build

# --- 6. frontend static build (nginx serves dist/, proxies /api) ---
npm --prefix frontend ci
npm --prefix frontend run build

# --- 7. nginx: repo config replaces the default site (port 80 conflict) ---
install -m 0644 infrastructure/demo/nginx.conf /etc/nginx/conf.d/solara.conf
rm -f /etc/nginx/conf.d/default.conf
nginx -t
systemctl enable --now nginx

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

echo "Solara bootstrap complete: $(date -u +%FT%TZ)"
