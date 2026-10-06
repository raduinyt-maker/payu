FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./
COPY prisma ./prisma

RUN npm install

COPY tsconfig.json ./
COPY src ./src

RUN npx prisma generate
RUN npm run build

# ---------- runtime ----------
FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache openssl

COPY package.json ./
COPY prisma ./prisma

RUN npm install --omit=dev && npx prisma generate

COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
