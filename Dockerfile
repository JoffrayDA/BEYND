# BEYND: one image, one process. The Hono server serves the API and the
# built PWA on the same origin. SQLite lives on the /data volume.
#   docker build -t beynd .
#   docker run -p 8787:8787 -v beynd-data:/data -e APP_PASSWORD=... beynd
# No VOLUME instruction: Railway rejects it. Mount /data from the platform.

# 1. Client build. It imports the pure rule modules server/engine.js and
#    server/raid.js (no deps) and the design-system.
FROM node:24-alpine AS client
WORKDIR /app
COPY client/package.json client/package-lock.json ./client/
RUN cd client && npm ci
COPY design-system ./design-system
COPY server/engine.js server/raid.js ./server/
COPY client ./client
RUN cd client && npm run build

# 2. Server production dependencies.
FROM node:24-alpine AS deps
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

# 3. Runtime.
FROM node:24-alpine
# tzdata: the game day starts at DAY_START_HOUR local time, so TZ matters.
# su-exec: the entrypoint fixes /data ownership, then drops to the node user.
RUN apk add --no-cache tzdata su-exec
ENV NODE_ENV=production \
    TZ=Europe/Paris \
    PORT=8787 \
    ELO_DB_PATH=/data/elo.db
WORKDIR /app/server
COPY --from=deps /app/server/node_modules ./node_modules
COPY server/package.json server/*.js ./
COPY --from=client /app/client/dist ../client/dist
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && mkdir -p /data && chown node:node /data
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:8787/api/health || exit 1
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "index.js"]
