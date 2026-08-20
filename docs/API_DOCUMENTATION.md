# DropLink Backend API Documentation

**Version:** 1.0.0  
**Base URL:** `/api/v1`  
**Protocol:** HTTP/1.1 & WebSockets (Socket.IO namespace: `/socket`)

---

## Response Formats

### Standard Success Response
```json
{
  "success": true,
  "data": { ... }
}
```

### Standard Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message describing the error",
    "fields": {
      "field_name": ["Validation error message"]
    }
  }
}
```

---

## Core API Endpoints

### 1. Create Transfer & Upload Files
**Endpoint:** `POST /api/v1/transfers` (or `POST /api/v1/upload`)  
**Content-Type:** `multipart/form-data`

#### Request Payload
- `files`: File or Array of Files (Key: `files`, Max limit: 100 files, Max size: 2GB per file/transfer).
- `maxDownloads` or `maxUsers`: *(Optional, Number, Default: 1, Range: 1-100)* — Maximum number of recipients/users allowed to download from the share link.
- `expiryMinutes`: *(Optional, Number, Default: 10, Range: 1-1440)* — Transfer validity window in minutes.

#### Success Response `201 Created`
```json
{
  "success": true,
  "data": {
    "token": "4f9d8a2e1c3b7f6a9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f",
    "shareId": "ABC-92L-KJD",
    "shareUrl": "http://localhost:3000/t/4f9d8a2e1c3b7f6a9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f",
    "qrPayload": {
      "shareUrl": "http://localhost:3000/t/4f9d8a2e1c3b7f6a9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f",
      "shareId": "ABC-92L-KJD",
      "transferToken": "4f9d8a2e1c3b7f6a9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f"
    },
    "files": [
      {
        "originalName": "document.pdf",
        "size": 1048576,
        "mimeType": "application/pdf"
      }
    ],
    "totalSize": 1048576,
    "isZip": false,
    "status": "ready",
    "expiresAt": "2026-08-06T01:10:00.000Z",
    "downloadCount": 0,
    "maxDownloads": 5,
    "remainingDownloads": 5,
    "createdAt": "2026-08-06T01:00:00.000Z"
  }
}
```

---

### 2. Lookup Transfer Metadata by Token
**Endpoint:** `GET /api/v1/transfers/:token`

#### Success Response `200 OK`
```json
{
  "success": true,
  "data": {
    "token": "4f9d8a2e1c3b7f6a9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f",
    "shareId": "ABC-92L-KJD",
    "shareUrl": "http://localhost:3000/t/4f9d8a2e1c3b7f6a9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f",
    "files": [...],
    "totalSize": 1048576,
    "isZip": false,
    "status": "ready",
    "expiresAt": "2026-08-06T01:10:00.000Z",
    "downloadCount": 1,
    "maxDownloads": 5,
    "remainingDownloads": 4,
    "createdAt": "2026-08-06T01:00:00.000Z"
  }
}
```

---

### 3. Lookup Transfer Metadata by Share ID
**Endpoint:** `GET /api/v1/transfers/share/:shareId`  
*(Accepts raw `ABC92LKJD` or formatted `ABC-92L-KJD`)*

#### Success Response `200 OK`
*(Returns identical transfer payload as token lookup)*

---

### 4. Stream Download Transfer Files
**Endpoint:** `GET /api/v1/transfers/:token/download`

#### Response Headers
- `Content-Type`: `application/octet-stream` (or `application/zip` for multi-file transfers)
- `Content-Disposition`: `attachment; filename="document.pdf"` (or `DropLink-Transfer-ABC-92L-KJD.zip`)
- `Content-Length`: `1048576`

#### Response Body
Binary file byte stream streamed directly from disk.

---

### 5. Get Real-Time Transfer Status
**Endpoint:** `GET /api/v1/transfers/:token/status`

#### Success Response `200 OK`
```json
{
  "success": true,
  "data": {
    "token": "4f9d8a2e1c3b7f6a9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f",
    "shareId": "ABC-92L-KJD",
    "status": "ready",
    "downloadCount": 1,
    "maxDownloads": 5,
    "remainingDownloads": 4,
    "expiresAt": "2026-08-06T01:10:00.000Z",
    "secondsRemaining": 540,
    "isExpired": false
  }
}
```

---

### 6. Delete Transfer
**Endpoint:** `DELETE /api/v1/transfers/:token`

#### Success Response `200 OK`
```json
{
  "success": true,
  "data": {
    "message": "Transfer deleted successfully"
  }
}
```

---

## Real-Time WebSockets (Socket.IO)

**Namespace:** `/socket`

### Room Connection
To listen for updates on a specific transfer, join the transfer room:
```javascript
const socket = io("http://localhost:5000/socket");
socket.emit("join-transfer", { roomKey: "<transferToken or shareId>" });
```

### Supported Socket Events
- `upload-progress`: `{ progress: number }`
- `processing`: `{ message: string }`
- `transfer-ready`: `{ transferResponseData }`
- `download-started`: `{ token, downloadCount, maxDownloads, remainingDownloads }`
- `download-progress`: `{ progress: number }`
- `completed`: `{ token, downloadCount, maxDownloads, remainingDownloads }`
- `expired`: `{ message: string }`
