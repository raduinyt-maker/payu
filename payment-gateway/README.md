# Payment Gateway Platform

Production-ready payment gateway with:
- Merchant web dashboard (React + Vite + Tailwind)
- REST API backend (Node + TypeScript + Prisma)
- Android merchant app (Kotlin + Compose)
- PostgreSQL database

## Deployment

Deployed on Railway. See `/docs/DEPLOY.md`.

## Local Development

```bash
# Backend
cd backend
npm install
npx prisma migrate dev
npm run dev

# Frontend
cd frontend
npm install
npm run dev
