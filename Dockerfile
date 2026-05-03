# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE=node:25.4.0-alpine
ARG RUNTIME_IMAGE=alpine:3.23

FROM ${NODE_IMAGE} AS client-builder
WORKDIR /build

COPY package.json package-lock.json vite.config.js ./
COPY src/client ./src/client

RUN npm ci \
    && npm run build:client

FROM ${NODE_IMAGE} AS server-builder
WORKDIR /build

COPY package.json package-lock.json ./
COPY scripts/build-server.js ./scripts/build-server.js
COPY src/server ./src/server

RUN npm ci \
    && npm run build:server

FROM ${RUNTIME_IMAGE} AS runtime

ARG TARGETARCH
ARG TARGETPLATFORM

ENV APP_HOME=/app \
    NODE_ENV=production \
    APP_PORT=3000 \
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
      nodejs \
      npm \
      postgresql18 \
      postgresql18-client \
    postgresql18-contrib \
      tzdata

RUN addgroup -g 1000 -S harmoniarr \
    && adduser -u 1000 -S -D -h /app -G harmoniarr harmoniarr \
    && mkdir -p /app /app/data /data/downloads /data/music /data/staging /data/transcode-temp /run/postgresql \
    && chmod 0770 /run/postgresql \
    && chown -R harmoniarr:harmoniarr /app /run/postgresql /data/staging /data/transcode-temp

WORKDIR ${APP_HOME}

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=client-builder /build/dist/client ./client-dist/
COPY --from=server-builder /build/dist/server ./server-dist/
COPY docker/entrypoint.sh /usr/local/bin/harmoniarr-entrypoint
COPY docker/harmoniarrctl /usr/local/bin/harmoniarrctl

RUN chmod 0755 /usr/local/bin/harmoniarr-entrypoint /usr/local/bin/harmoniarrctl

USER harmoniarr

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD sh -ec 'wget -q -O - "http://127.0.0.1:${APP_PORT}/healthz" >/dev/null'

ENTRYPOINT ["/usr/local/bin/harmoniarr-entrypoint"]
CMD ["node", "/app/server-dist/index.js"]