# Consigna — CI/CD (GitHub Actions)

## Objetivo
Integrar la ejecución automática de pruebas en un pipeline CI/CD para que cada cambio (push / PR) valide calidad antes de desplegar.

## Implementación
Se configuró un workflow de GitHub Actions en:
- `.github/workflows/ci.yml`

### Disparadores
- `push` a `main`
- `pull_request`

### Jobs incluidos
- **Backend (backend_new):** `npm ci` + `npm test`
- **Backend (backend):** `npm ci` + `npm test` + `npm run coverage`
- **Frontend:** `npm ci` + `npm run lint` + Playwright E2E (Chromium)

### Criterio de aprobación
El pipeline se considera exitoso cuando los 3 jobs finalizan en estado **Success** (verde).

## Evidencia
Insertar captura: **GitHub Actions en verde** (pestaña “Actions”, ejecución más reciente con check verde).

