FROM node:22-bookworm-slim
WORKDIR /runner
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY apps/hosted/archive-verification.mjs ./apps/hosted/
COPY apps/worker/run-node-tests.mjs ./apps/worker/
USER node
ENTRYPOINT ["node", "apps/worker/run-node-tests.mjs"]
