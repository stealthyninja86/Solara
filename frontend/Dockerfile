# Stage 1: Build Stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy lockfile + manifest and install dependencies (npm ci = lockfile-exact)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build (tsc -b && vite build → dist/)
COPY . .
RUN npm run build

# Stage 2: Runtime Stage (nginx serves the static SPA)
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

# 80-only config (active by default); ssl-mode.conf is swapped in by
# docker-entrypoint.sh only when certificate files are mounted in /etc/nginx/certs
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx.ssl.conf /etc/nginx/ssl-mode.conf
COPY docker-entrypoint.sh /docker-entrypoint.d/40-ssl-mode.sh

EXPOSE 80 443
