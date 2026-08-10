#!/bin/sh
# Enable the HTTPS server block only when certificate files are mounted in
# /etc/nginx/certs. nginx refuses to start when ssl_certificate files are
# missing, so default.conf stays 80-only until the host's certbot deploy hook
# drops real certs into ./certs (bound at /etc/nginx/certs).
if [ -f /etc/nginx/certs/fullchain.pem ] && [ -f /etc/nginx/certs/privkey.pem ]; then
  cp /etc/nginx/ssl-mode.conf /etc/nginx/conf.d/default.conf
fi
