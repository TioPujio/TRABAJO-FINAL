# Consigna 3 — Optimización de la suite de pruebas

## Objetivo
Optimizar la suite automatizada eliminando redundancias, maximizando cobertura (líneas y ramas) y justificando las elecciones de herramientas y estrategia.

## Cambios aplicados (optimización)

### 1) Eliminación de redundancias
- Se creó un helper común de tests para backend: `backend_new/tests/_helpers.js`.
  - Centraliza el mock de Prisma (`makePrismaMock`) y la creación del `app` con `jest.unstable_mockModule` (`createAppWithPrisma`).
  - Reduce duplicación de setup en cada archivo de test.

### 2) Maximización de cobertura (enfocada en ramas)
Se agregaron casos para cubrir ramas de lógica críticas:
- `POST /orders/preview`
  - Conversión de `unit=kg` + `quantity` a `grams` (flujo que antes quedaba sin cubrir).
  - Uso de `product.price` para unidades no-kg (ej: `unidad`) en lugar de `pricePerKg`.
- CORS
  - Se validó que con un `Origin` permitido el backend responda con `Access-Control-Allow-Origin`.
  - Se validó que con un `Origin` no permitido no se exponga el header.

### 3) Coverage como criterio de calidad
- Se activó cobertura por defecto al correr `npm test` en `backend_new/`.
- Se definieron umbrales globales en `backend_new/jest.config.js`:
  - `statements`: 80%
  - `branches`: 70%
  - `functions`: 75%
  - `lines`: 80%

Esto fuerza a que nuevas modificaciones mantengan el nivel de calidad y evita regresiones silenciosas.

## Justificación de elecciones

### Backend: Jest + Supertest
- Jest permite mocks controlados de dependencias (Prisma/OpenAI) y ejecución rápida.
- Supertest valida el contrato HTTP real (status codes y payloads) sin levantar un servidor externo.
- Resultado: tests estables, rápidos y con foco en la lógica de negocio y validaciones.

### E2E: Playwright
- Se conservaron pocos tests E2E (smoke tests) para validar el flujo principal:
  - catálogo + filtro por categoría
  - “Consultar” abre chat y prellena mensaje
- Se mockean `/products` y `/chat` para evitar flakes (DB/red/IA) y mantener determinismo.

## Cómo ejecutar

Backend:
```powershell
cd backend_new
npm test
```

E2E:
```powershell
cd frontend
npm run test:e2e
```

## Resultado
- Suite más simple (menos repetición).
- Más cobertura real (incluye ramas críticas).
- Umbrales de cobertura para sostener calidad en el tiempo.

