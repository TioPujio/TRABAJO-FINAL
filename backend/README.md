# HAVOK Backend (Node + Express + Prisma + PostgreSQL)

## Requisitos
- Node.js 20+ (o 18+)
- Docker Desktop (opcional, recomendado para PostgreSQL local)

## Setup (flujo profesional)
1) Instalar dependencias:
```bash
npm install
```

2) Levantar PostgreSQL:
```bash
docker compose up -d
```

3) Variables de entorno:
- Copiá `.env.example` a `.env` y ajustá `DATABASE_URL` si hace falta.

4) Prisma (generar + migrar):
```bash
npm run prisma:generate
npm run prisma:migrate
```

5) Correr la API:
```bash
npm run dev
```

Healthcheck: `GET /health`

