FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts
RUN pnpm install --frozen-lockfile=false
RUN pnpm db:generate && pnpm build

FROM base AS runtime
ENV NODE_ENV=production
CMD ["sh", "-c", "pnpm db:push && pnpm --filter @xepelin/api start"]
