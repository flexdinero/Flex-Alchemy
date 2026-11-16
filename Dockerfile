FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    ALCHEMY_LISTEN_HOST=0.0.0.0
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY apps/hosted/ ./apps/hosted/
COPY apps/local/style.css ./apps/local/style.css
COPY db/ ./db/
COPY docs/flex-alchemy/ ./docs/flex-alchemy/
USER node
EXPOSE 4174
CMD ["node", "apps/hosted/server.mjs"]
