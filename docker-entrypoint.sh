#!/bin/sh
# A fresh bind mount arrives owned by root: hand /data to the node user,
# then run the server as node (never as root).
set -e
chown -R node:node /data 2>/dev/null || true
exec su-exec node "$@"
