# Migrações: aplicação roda na subida (RUN_MIGRATE=true). Ver docs/deploy.md.
FROM oven/bun:1-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

FROM base AS app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV PORT=8080
ENV NODE_ENV=prod

EXPOSE 8080

CMD ["bun", "run", "start"]
