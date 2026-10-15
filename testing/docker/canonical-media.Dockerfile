# Trusted local validation runner only. Supply an immutable reviewed Node image.
ARG NODE_IMAGE=node@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1
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
