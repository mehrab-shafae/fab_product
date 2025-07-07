# ---- Stage 1: Build ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* yarn.lock* ./
RUN npm ci --include=dev || yarn install --frozen-lockfile
COPY . .
RUN npm run build

# ---- Stage 2: Production ----
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json ./
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/product ./product
COPY --from=builder /app/asyncHandler.ts ./
COPY --from=builder /app/cwd.ts ./
# COPY --from=builder /app/.env.example ./
COPY --from=builder /app/.env ./
EXPOSE 7011 7021
CMD ["node", "."] 