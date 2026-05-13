# TRABAJO-FINAL (El Viejo Almacén Todo Suelto)

Monorepo con:
- `backend_new/`: Node + Express + Prisma + PostgreSQL (Neon/local)
- `frontend/`: React + Vite

## Desarrollo (local)

En 2 terminales:

```powershell
cd backend_new
npm install
npm run dev
```

```powershell
cd frontend
npm install
npm run dev
```

Frontend: `http://localhost:5173`  
Backend: `http://localhost:3000`

## Tests automatizados

### Backend (Jest + Supertest)

```powershell
cd backend_new
npm install
npm test
```

Los tests están en `backend_new/tests/`.

### E2E (Playwright)

```powershell
cd frontend
npm install
npx playwright install
npm run test:e2e
```

Los tests están en `frontend/tests/e2e/`.

Nota: los tests E2E mockean `/products` y `/chat` para ser deterministas (no dependen de DB/OpenAI).
