# Build frontend
FROM node:22-bookworm AS frontend
WORKDIR /app/packages/frontend
COPY packages/frontend/package.json packages/frontend/package-lock.json ./
RUN npm ci
COPY packages/frontend/ ./
RUN npm run build

# Runtime: API + built UI
FROM node:22-bookworm AS runtime
WORKDIR /app

# better-sqlite3 native module
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY backend ./backend
COPY --from=frontend /app/packages/frontend/dist ./packages/frontend/dist

ENV NODE_ENV=production
ENV PORT=8420
EXPOSE 8420

CMD ["node", "backend/server.js"]
