# ==============================================================================
# Dockerfile for AI Bot (Chatbot + Search) — Node.js
# ==============================================================================
FROM node:20-bookworm-slim
WORKDIR /app

RUN apt-get update \
    && apt-get install --no-install-recommends -y openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .
RUN ./node_modules/.bin/prisma generate

EXPOSE 3001

ENTRYPOINT ["sh", "/app/docker-entrypoint.sh"]
CMD ["node", "src/ai-server.js"]
