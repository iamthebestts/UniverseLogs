FROM oven/bun:1-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

FROM base AS app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN chown -R bun:bun /app

USER bun

ENV PORT=8080
ENV NODE_ENV=prod

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-8080}/ping || exit 1

CMD ["bun", "run", "start"]
