FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json .env.example ./
RUN cp .env.example .env
COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts
RUN pnpm install --frozen-lockfile
RUN pnpm db:generate && pnpm build

FROM base AS runtime
ENV NODE_ENV=production
CMD ["sh", "-c", "pnpm db:deploy && pnpm start:api"]
