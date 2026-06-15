FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

ENV NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
RUN npm run build

# ── Production stage ───────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Security: non-root user
RUN addgroup -S tempops && adduser -S tempops -G tempops

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

RUN chown -R tempops:tempops /app
USER tempops

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
