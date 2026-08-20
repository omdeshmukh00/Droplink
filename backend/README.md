# LinkDrop Backend Core Foundation

Production-ready, highly scalable, and modular backend foundation for **LinkDrop** — Instant Secure File Sharing (No Login, No Cable, No Installation).

Engineered with Express 5, TypeScript strict mode, Zod environment validation, Winston structured logging, Mongoose 9, Socket.IO, node-cron, and clean feature-module architecture.

---

## 🏗 Architecture & Repository Layout

```
src/
├── config/
│   ├── env.ts                 # Zod environment variable validation & process crash handler
│   └── database.ts            # Singleton Mongoose connection manager with graceful shutdown
├── constants/
│   ├── errorCodes.ts          # Machine-readable error code constants
│   └── httpStatusCodes.ts     # HTTP status code constants
├── middleware/
│   ├── requestId.ts           # X-Request-ID attachment for distributed tracing
│   ├── rateLimiter.ts         # Global API and route-level rate limiters
│   ├── requestLogger.ts       # HTTP traffic logging integrating Morgan and Winston
│   └── errorHandler.ts        # Centralized error handler catching AppError, Zod, and DB errors
├── services/
│   ├── storage/
│   │   ├── storage.provider.ts# StorageProvider strategy interface
│   │   └── local.storage.ts   # LocalStorageProvider implementation
│   ├── socket.service.ts      # Socket.IO manager with /socket namespace
│   └── cron.service.ts        # Node-cron background task manager
├── utils/
│   ├── logger.ts              # Winston logger with sensitivity masking
│   ├── AppError.ts            # Operational exception class
│   ├── ApiResponse.ts         # Standardized success and error response formatter
│   ├── response.ts            # Quick response helpers
│   ├── asyncHandler.ts        # Global async route wrapper
│   └── generateId.ts          # UUID and secure random short code generators
├── types/
│   ├── express.d.ts           # Express Request interface extension (req.id)
│   ├── storage.types.ts       # Storage interface types
│   └── api.types.ts           # API contract interfaces
├── sockets/
│   └── index.ts               # Socket.IO initialization handler
├── cron/
│   └── index.ts               # Cron jobs initialization handler
├── modules/
│   ├── upload/                # Upload module (routes, controller, service, schema)
│   ├── download/              # Download module (routes, controller, service, schema)
│   ├── transfer/              # Transfer module (routes, controller, service, schema)
│   └── cleanup/               # Cleanup module (routes, controller, service, schema)
├── routes/
│   ├── health.routes.ts       # GET /health & GET /ready
│   └── index.ts               # Central API v1 router aggregator (/api/v1)
├── app.ts                     # Express 5 app configuration and middleware pipeline
└── server.ts                  # Server entry point with DB, WebSockets, Cron, and Graceful Shutdown
```

---

## 🛠 Tech Stack

- **Runtime**: Node.js (Active LTS)
- **Language**: TypeScript (Strict mode enabled)
- **Framework**: Express 5 (`^5.2.1`)
- **Database / ODM**: MongoDB Atlas / Mongoose 9
- **Validation**: Zod 4
- **Logging**: Winston 3 (Dev: Pretty Color, Prod: JSON; automatic sensitive data masking)
- **Real-Time**: Socket.IO 4 (`/socket` namespace)
- **File Upload & Compression**: Multer, Archiver
- **Job Scheduling**: node-cron
- **Security**: Helmet, CORS allowlisting, express-rate-limit, Request ID tracing

---

## 🚀 Environment Setup

1. Copy the `.env.example` file to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Configure environment variables in `.env`:
   ```env
   NODE_ENV=development
   PORT=5000
   CLIENT_URL=http://localhost:3000
   CORS_ORIGINS=http://localhost:3000,http://localhost:5173
   MONGODB_URI=mongodb://localhost:27017/linkdrop
   STORAGE_PROVIDER=local
   UPLOAD_DIR=uploads
   TEMP_DIR=temp
   MAX_FILE_SIZE=2147483648
   MAX_FILES=100
   TRANSFER_EXPIRY_MINUTES=10
   MAX_DOWNLOADS=1
   LOG_LEVEL=info
   ```

---

## 📦 Scripts

- **Development Server**:
  ```bash
  npm run dev
  ```
- **Production Build**:
  ```bash
  npm run build
  ```
- **Production Start**:
  ```bash
  npm run start
  ```

---

## 📡 API Standard Response Format

### Success Response
```json
{
  "success": true,
  "data": {
    "key": "value"
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE_CONSTANT",
    "message": "Human readable error description",
    "fields": {
      "fieldName": ["Validation error message"]
    }
  }
}
```

---

## 🏥 Health & Readiness Probes

- **`GET /health`** (Liveness Check)
  - Returns HTTP `200 OK`: `{ "success": true, "status": "healthy" }`
- **`GET /ready`** (Readiness Check)
  - Returns HTTP `200 OK` if MongoDB is connected: `{ "success": true, "status": "ready", "database": "connected" }`
  - Returns HTTP `503 Service Unavailable` if MongoDB is disconnected.

---

## 🔮 Storage & Extension Architecture

- **Storage Provider Strategy**: All file operations interact through `StorageProvider` abstraction (`src/services/storage/storage.provider.ts`). Adding Cloudflare R2, AWS S3, or Azure Blob requires implementing a class inheriting from `AbstractStorageProvider` without altering module business logic.
- **Future Feature Readiness**: Chunked upload streaming, WebRTC signaling events on `/socket`, auto-zipping via `Archiver`, and end-to-end client-side encryption can be appended directly into the existing `upload`, `download`, `transfer`, and `cleanup` modules without refactoring the core foundation.
