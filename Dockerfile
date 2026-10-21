# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE=node:24.22.1-alpine3.23@sha256:4b00b6d1aa138805aace94cc2482808f2b4f01e5e9c9f8cdc0e217fd70600ef9
ARG RUNTIME_IMAGE=alpine:3.23@sha256:85fe1e81d6758c208f3e1eed4338a1997e19d4be002d4dd32d3100c9a8c010a0

FROM ${NODE_IMAGE} AS node-base

RUN npm install --global --ignore-scripts npm@12.0.2

FROM node-base AS client-builder
WORKDIR /build

COPY package.json package-lock.json .npmrc vite.config.js ./
COPY src/client ./src/client
COPY src/shared ./src/shared

RUN --mount=type=cache,target=/root/.npm npm ci \
    && npm run build:client

FROM ${NODE_IMAGE} AS server-builder
WORKDIR /build

COPY package.json ./
COPY scripts/build-server.js ./scripts/build-server.js
COPY src/server ./src/server

RUN --network=none node scripts/build-server.js

FROM ${RUNTIME_IMAGE} AS runtime

ARG TARGETARCH
ARG TARGETPLATFORM

ENV APP_HOME=/app \
    NODE_ENV=production \
    APP_PORT=3000 \
    HARMONIARR_CLIENT_DIST=/app/client-dist \
    HARMONIARR_CONTACT_URL=https://github.com/cloudbyday90/harmoniarr \
    TZ=UTC \
    UMASK=0022

RUN case "${TARGETARCH:-unknown}" in \
      amd64|arm64) ;; \
      *) echo "Harmoniarr requires a 64-bit target platform (amd64 or arm64); got ${TARGETPLATFORM:-unknown}" >&2; exit 1 ;; \
    esac

RUN apk add --no-cache \
      bash \
      ca-certificates \
      coreutils \
      ffmpeg \
      postgresql18 \
      postgresql18-client \
    postgresql18-contrib \
      tzdata

COPY --from=node-base /usr/local/bin/node /usr/local/bin/node
COPY --from=node-base /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm

RUN addgroup -g 1000 -S harmoniarr \
    && adduser -u 1000 -S -D -h /app -G harmoniarr harmoniarr \
    && mkdir -p /app /app/data /data/downloads /data/music /data/staging /data/transcode-temp /run/postgresql \
    && chmod 0770 /run/postgresql \
    && chown -R harmoniarr:harmoniarr /app /run/postgresql /data/staging /data/transcode-temp

WORKDIR ${APP_HOME}

COPY package.json package-lock.json .npmrc ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

COPY --from=client-builder /build/dist/client ./client-dist/
COPY --from=server-builder /build/dist/server ./server-dist/
COPY src/shared ./shared/
COPY docker/entrypoint.sh /usr/local/bin/harmoniarr-entrypoint
COPY docker/harmoniarrctl /usr/local/bin/harmoniarrctl
COPY docker/managed-slskd-config.js /usr/local/bin/harmoniarr-managed-slskd-config.js
COPY docker/walkthrough-bootstrap.js /usr/local/bin/harmoniarr-walkthrough-bootstrap.js

RUN chmod 0755 \
    /usr/local/bin/harmoniarr-entrypoint \
    /usr/local/bin/harmoniarrctl \
    /usr/local/bin/harmoniarr-managed-slskd-config.js \
    /usr/local/bin/harmoniarr-walkthrough-bootstrap.js

USER harmoniarr

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD sh -ec 'wget -q -O - "http://127.0.0.1:${APP_PORT}/healthz" >/dev/null'

ENTRYPOINT ["/usr/local/bin/harmoniarr-entrypoint"]
CMD ["node", "/app/server-dist/index.js"]
