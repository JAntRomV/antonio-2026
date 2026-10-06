# 🐌 Snail Racer

Aplicación web de apuestas en carreras de caracoles con recarga de saldo mediante **SnailPay**, una pasarela de pagos simulada.

| Capa      | Stack                                                                   |
|-----------|-------------------------------------------------------------------------|
| Frontend  | React 19 · TypeScript (strict) · React Router 7 · Recharts · Vite      |
| Backend   | Express 5 · TypeScript (strict)                                         |
| Pruebas   | Vitest · React Testing Library · Supertest                              |
| Persistencia | `localStorage` (usuarios, sesión y saldo)                            |

## Requisitos

- Node.js 20 o superior (probado con Node 22) y npm 10.

## Puesta en marcha

En dos terminales:

```bash
# Terminal 1 — API SnailPay en http://localhost:4000
cd backend
npm install
npm run dev

# Terminal 2 — App en http://localhost:5173
cd frontend
npm install
npm run dev
```

Vite redirige `/api/*` al backend (proxy), así que no hace falta configurar CORS en desarrollo.

### Scripts

| Script          | backend                                  | frontend                                  |
|-----------------|------------------------------------------|-------------------------------------------|
| `npm run dev`   | `tsx watch` con recarga en caliente       | Servidor de Vite                          |
| `npm run build` | Compila a `dist/` con `tsc`               | Type-check + bundle de producción         |
| `npm start`     | Ejecuta `dist/server.js`                  | — (`npm run preview` para el build)        |
| `npm test`      | Pruebas de integración (Supertest)        | Pruebas de formularios y flujo (RTL)      |
| `npm run typecheck` | `tsc --noEmit` (incluye pruebas)      | `tsc --noEmit` (incluye pruebas)          |

### Variables de entorno (opcionales)

| Variable              | Dónde     | Por defecto                       | Uso                                     |
|-----------------------|-----------|-----------------------------------|-----------------------------------------|
| `PORT`                | backend   | `4000`                            | Puerto del API                          |
| `SNAILPAY_LATENCY_MS` | backend   | `700`                             | Latencia simulada (permite ver loaders) |
| `CORS_ORIGINS`        | backend   | `http://localhost:5173,...`       | Orígenes permitidos (coma separada)     |
| `VITE_API_URL`        | frontend  | `''` (usa el proxy)               | URL base del API si no se usa el proxy  |

## Flujo de verificación (requisitos mínimos)

1. **Registro**: `/registro` → nombre y apellido, correo, contraseña (8+ caracteres con mayúscula, minúscula y número) y confirmación. La cuenta se crea con saldo **$0.00** y abre sesión.
2. **Logout**: botón *Cerrar sesión* en la barra superior.
3. **Login**: `/login` con las credenciales registradas.
4. **Dashboard protegido**: `/dashboard` sin sesión redirige a `/login`. La sesión persiste al recargar.

## SnailPay — `POST /api/snailpay/charge`

```json
{
  "card_number": "1234123412341234",
  "expiration_date": "12/26",
  "cvv": "543",
  "cardholder_name": "Ana María López",
  "transaction_amount": 500,
  "payer_id": "usr_...",
  "payer_email": "ana@example.com"
}
```

| Escenario                          | Detonador                                         | HTTP | `status`   | `status_detail`                         |
|------------------------------------|---------------------------------------------------|------|------------|-----------------------------------------|
| Cobro exitoso                      | `1234123412341234` · `12/26` · `543`             | 201  | `approved` | `accredited` (+ `authorization_code`)   |
| Fondos insuficientes               | `5555000000000001` · fecha futura                 | 201  | `rejected` | `cc_rejected_insufficient_amount`       |
| Tarjeta bloqueada                  | `5555000000000002` · fecha futura                 | 201  | `rejected` | `cc_rejected_blacklist`                 |
| Tarjeta expirada                   | Cualquier tarjeta con vencimiento pasado          | 201  | `rejected` | `cc_rejected_card_expired`              |
| CVV / vencimiento incorrecto       | Tarjeta aprobada con otro CVV o fecha             | 201  | `rejected` | `cc_rejected_bad_filled_security_code` / `_date` |
| Tarjeta no soportada               | Cualquier otro número válido                      | 201  | `rejected` | `cc_rejected_card_not_supported`        |
| Datos inválidos                    | Monto ≤ 0, campos vacíos, formatos incorrectos    | 400  | `rejected` | `invalid_request: <campos>`             |
| Error del sistema                  | Header `x-simulate-error: true` **o** monto `9999` | 500 | `error`    | `service_unavailable`                   |

En el modal de SnailPay hay un interruptor *Simular caída del servicio* que envía el header.

Todas las respuestas (incluidos 404 y errores no controlados) usan el esquema `SnailPayResponse`. **Nunca** se devuelve el número de tarjeta ni el CVV, y tampoco se guardan en `localStorage`.

## Decisiones de diseño

- **Custodia de contraseñas**: nunca se almacenan en claro. Se deriva un hash **PBKDF2-SHA256 (100 000 iteraciones)** con Web Crypto y una sal aleatoria por usuario; el login recalcula el hash y compara en tiempo constante. Es una simulación local: en producción la verificación debe hacerse en el servidor.
- **Saldo**: vive en el registro del usuario en `localStorage`; solo se modifica tras una respuesta `approved` con `authorization_code`. Rechazos, errores HTTP, timeouts (10 s) y fallos de red dejan el saldo intacto.
- **Separación de capas**: UI (`pages`, `components`) → estado (`context`) → servicios (`services`) → persistencia/HTTP. En el backend: rutas → controlador (validación y reglas del sandbox) → middleware de errores.
- **Validación doble**: el frontend valida para dar retroalimentación inmediata; el backend vuelve a validar todo y no confía en el cliente.
- **Sin adjuntos**: no hay inputs de archivo y los formularios bloquean arrastrar/soltar archivos.
- **Datos simulados congruentes**: las victorias por caracol se *derivan* de las 6 carreras del día, por lo que siempre suman 6.
- **Accesibilidad**: etiquetas asociadas, `aria-invalid` y `aria-describedby`, modal con `aria-modal`, cierre con Escape y foco atrapado, gráficas con `aria-label` descriptivo.

## Estructura

```text
snail-race-app/
├── backend/
│   ├── src/
│   │   ├── controllers/snailPay.controller.ts   # validación + reglas del sandbox
│   │   ├── routes/snailPay.routes.ts
│   │   ├── types/snailPay.types.ts
│   │   ├── middlewares/errorHandler.ts          # 404, JSON inválido, 500
│   │   ├── app.ts                               # createApp() inyectable para pruebas
│   │   └── server.ts
│   └── tests/snailPay.test.ts
└── frontend/
    ├── src/
    │   ├── components/   # ProtectedRoute, SnailPayModal, BetsDonutChart, RacesBarChart,
    │   │                 # FormField, AuthLayout, Spinner
    │   ├── context/AuthContext.tsx
    │   ├── pages/        # LoginPage, RegisterPage, DashboardPage
    │   ├── services/     # snailPayService.ts, authService.ts
    │   ├── data/mockData.ts
    │   ├── utils/        # validation.ts, format.ts
    │   ├── types/index.ts
    │   ├── App.tsx
    │   ├── main.tsx
    │   └── index.css
    └── tests/            # AuthForm.test.tsx, SnailPayModal.test.tsx, setup.ts
```

Archivos adicionales al árbol base (`authService`, `FormField`, `AuthLayout`, `Spinner`, `mockData`, `utils/*`) existen para mantener cada capa con una sola responsabilidad.
