# Trusted local validation runner only. Supply an immutable reviewed Node image.
ARG NODE_IMAGE=node:24.22.3-alpine3.23@sha256:3946fb783fdce8a2812136ea694bc95c698c4f4096f3fd18568dc27a8ac389dc
FROM ${NODE_IMAGE}
RUN apk add --no-cache ffmpeg docker-cli
RUN npm install --global --ignore-scripts npm@12.0.2
WORKDIR /work
COPY package.json package-lock.json .npmrc ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY src/server ./src/server
COPY src/shared ./src/shared
COPY testing ./testing
COPY test/integration/missing-music-add-to-library.test.js ./test/integration/missing-music-add-to-library.test.js
COPY scripts/validate-linux-canonical-media.js ./scripts/validate-linux-canonical-media.js
ENTRYPOINT ["node", "scripts/validate-linux-canonical-media.js"]
