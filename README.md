# DropLink

> Fast, private, browser-to-browser file sharing using WebRTC.

DropLink is a browser-based file transfer application that allows users to transfer files between devices without USB cables, chat-app logins, or installing a native application.

The primary transfer mechanism uses **WebRTC DataChannels** for direct peer-to-peer file transfer, while **Socket.IO** is used for signaling. **PostgreSQL** is used to store transfer and session metadata, while the actual file bytes are transferred through WebRTC.

---

## 🚀 Features

- Peer-to-peer file transfer using WebRTC
- Phone ↔ PC file sharing
- No account required for basic transfers
- Shareable transfer codes
- QR/code-based transfer initiation
- Real-time transfer progress
- Real-time transfer speed display
- Multiple-file transfer support
- Bulk file distribution
- Multi-participant bulk sessions
- Automatic transfer/session expiry
- Responsive desktop and mobile UI
- PostgreSQL relational database
- Prisma ORM
- STUN/TURN support
- Socket.IO signaling
- Future-ready cloud storage fallback architecture

---

# 🧠 How DropLink Works

## Standard WebRTC Transfer

The actual file is transferred directly between the sender and receiver using a WebRTC DataChannel.

```text
                       Transfer Metadata
                              │
                              ▼
Sender ───────────────► Express API
                              │
                              ▼
                         Prisma ORM
                              │
                              ▼
                   PostgreSQL / Supabase


Sender
   │
   │ WebRTC DataChannel
   │
   ▼
Receiver
```

The database stores transfer metadata, not the actual file contents.

The file itself is transferred directly between peers using WebRTC whenever a direct connection can be established.

### 🔌 WebRTC Signaling

Socket.IO is used for signaling and coordinating the WebRTC connection.

```text
Sender
   │
   ├──── SDP Offer ────────────────┐
   ├──── ICE Candidates ───────────┤
   │                               ▼
   │                           Socket.IO
   │                               │
   │                               ▼
   │                            Receiver
   │
   └──────── WebRTC DataChannel ─────────► Receiver
```

Socket.IO does not carry the file chunks.

After the peer connection is established, the actual file data travels through the WebRTC DataChannel.

---

# 🗄️ Database Architecture

DropLink uses PostgreSQL hosted on Supabase and accessed through Prisma ORM.

## Main Tables

```text
                    PostgreSQL
                        │
        ┌───────────────┼────────────────┐
        │               │                │
        ▼               ▼                ▼
     senders         transfers      bulk_sessions
        │
        │ 1 ─────── N
        │
        ▼
     transfers


bulk_sessions
      │
      │ 1 ─────── N
      ▼
bulk_participants
```

### senders

Stores sender/session identity information.

Important fields include:
- `id`
- `sender_code`
- `sender_name`
- `created_at`
- `updated_at`

A sender can be associated with multiple transfers.

**Relationship:**
```text
senders
   │
   │ 1 → many
   ▼
transfers
```

### transfers

Stores metadata for file transfers.

Important fields include:
- `id`
- `sender_id`
- `token`
- `share_id`
- `drive_file_id`
- `original_name`
- `stored_name`
- `mime_type`
- `size`
- `status`
- `download_count`
- `max_downloads`
- `receiver_limit_enabled`
- `receiver_limit`
- `expires_at`
- `last_accessed_at`
- `download_started_at`
- `download_completed_at`
- `transfer_type`
- `drive_metadata`
- `created_at`
- `updated_at`

The `sender_id` field creates a relational connection to the `senders` table.

### bulk_sessions

Stores information about bulk distribution rooms.

Important fields include:
- `id`
- `session_id`
- `bulk_code`
- `status`
- `host_socket_id`
- `last_host_heartbeat`
- `closed_at`
- `participant_count`
- `max_participants`
- `settings`
- `created_at`
- `updated_at`

### bulk_participants

Stores participants belonging to a bulk session.

Important fields include:
- `id`
- `participant_id`
- `session_id`
- `display_name`
- `socket_id`
- `joined_at`
- `last_seen_at`
- `status`
- `files_uploaded`
- `total_bytes_uploaded`
- `created_at`
- `updated_at`

**Relationship:**
```text
bulk_sessions
      │
      │ 1 → many
      ▼
bulk_participants
```

The `session_id` field is enforced using a PostgreSQL foreign key.

---

# 🔗 Database Relationships

## Sender → Transfers
```text
senders.id
     │
     │
     ▼
transfers.sender_id
```
One sender can have multiple transfers.

## Bulk Session → Participants
```text
bulk_sessions.session_id
          │
          │
          ▼
bulk_participants.session_id
```
One bulk session can contain multiple participants.

---

# 📦 File Storage

DropLink separates file data from database metadata.

**PostgreSQL stores:**
- Sender information
- Transfer metadata
- File name
- File size
- MIME type
- Transfer status
- Download counters
- Expiration information
- Bulk session information
- Participant information

**WebRTC handles:**
- Actual file bytes
- File chunk transmission
- Peer-to-peer transfer

The application does not store large file contents inside PostgreSQL.

---

# 🔄 Transfer Flow

## Normal P2P Transfer
1. Sender selects file
   $$\downarrow$$
2. DropLink creates transfer metadata
   $$\downarrow$$
3. Sender information is stored in PostgreSQL
   $$\downarrow$$
4. Transfer metadata is stored in PostgreSQL
   $$\downarrow$$
5. Share code/session is generated
   $$\downarrow$$
6. Socket.IO performs WebRTC signaling
   $$\downarrow$$
7. WebRTC connection is established
   $$\downarrow$$
8. File is divided into chunks
   $$\downarrow$$
9. Chunks are transferred through WebRTC DataChannel
   $$\downarrow$$
10. Receiver reconstructs the original file

---

## 👥 Bulk Transfer Flow

DropLink also supports multi-participant bulk distribution.

```text
Host
 │
 │ Create session
 ▼
bulk_sessions
 │
 ├──────── Participant 1
 ├──────── Participant 2
 ├──────── Participant 3
 │
 ▼
bulk_participants
```

Bulk sessions use:
- PostgreSQL for persistent session metadata
- Socket.IO for realtime coordination
- WebRTC for peer-to-peer transfer

---

# 🌐 WebRTC Networking

WebRTC uses ICE to determine how peers can connect.

Possible candidate types include:
- **HOST:** A local network candidate.
- **SRFLX:** A server-reflexive candidate discovered using STUN.
- **RELAY:** A TURN relay candidate used when a direct peer-to-peer connection cannot be established.

---

# 🔥 STUN / TURN Architecture

```text
                WebRTC
                   │
          ┌────────┴────────┐
          │                 │
       Direct             TURN
      connection           relay
          │                 │
          ▼                 ▼
      Receiver          Receiver
```

Direct WebRTC connections are preferred.
TURN is used when NAT/firewall restrictions prevent a direct connection.

---

# 🔐 Security

DropLink includes several security and abuse-protection mechanisms:
- Secure transfer tokens
- Server-side request validation
- Zod validation
- Helmet security middleware
- CORS configuration
- Rate limiting
- Expiring transfers
- Download limits
- Receiver limits
- Server-generated transfer identifiers
- Environment-based secret management

### Never commit secrets
The following must remain private:
- `.env`
- `.env.local`
- `.env.production`
- `DATABASE_URL`
- Database passwords
- API keys
- TURN credentials
- Private secrets

Use `.env.example` as the public configuration template.

---

# 🧹 Expiration and Cleanup

DropLink supports automatic expiry for transfers and sessions.

The backend periodically checks stale/expired records.

For the current WebRTC transfer architecture:
```text
WebRTC
   ↓
File transferred directly
```
Google Drive is not required for normal P2P transfers.
Future cloud-storage cleanup logic remains isolated from the active WebRTC transfer flow.

---

# ☁️ Future Cloud Storage

DropLink contains architecture for future cloud-storage fallback functionality.

A future cloud-transfer path can be:
```text
Sender
   ↓
Backend
   ↓
Cloud Storage
   ↓
Receiver
```

The current primary transfer mechanism remains **WebRTC P2P**.
Cloud storage can be enabled independently without making PostgreSQL responsible for storing the actual file bytes.

---

# 🧰 Technology Stack

### Frontend
- Next.js
- React
- TypeScript
- Tailwind CSS
- Axios
- TanStack Query
- React Hook Form
- Zod
- QR Code support
- JSZip

### Backend
- Node.js
- Express
- TypeScript
- Socket.IO
- Prisma
- PostgreSQL
- Multer
- Archiver
- Zod
- Helmet
- CORS
- Express Rate Limit
- Compression
- node-cron

### Realtime / Networking
- WebRTC
- WebRTC DataChannel
- Socket.IO
- STUN
- TURN
- ICE

### Infrastructure
- Vercel — Frontend
- Render — Backend
- Supabase — PostgreSQL

---

# 📁 Project Structure

```text
DropLink/
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── services/
│   │   ├── hooks/
│   │   └── ...
│   │
│   ├── public/
│   ├── package.json
│   └── ...
│
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   │
│   ├── src/
│   │   ├── config/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── modules/
│   │   │   ├── transfer/
│   │   │   ├── bulk/
│   │   │   └── cleanup/
│   │   ├── routes/
│   │   ├── services/
│   │   └── ...
│   │
│   ├── package.json
│   ├── tsconfig.json
│   └── ...
│
├── coturn/
│   └── ...
│
├── docs/
│
├── package.json
└── README.md
```

---

# 🛠️ Local Development

## Prerequisites
Install:
- Node.js LTS
- Git
- npm
- A Supabase PostgreSQL project

## 📥 Installation

1. **Clone the repository**
   ```bash
   git clone <YOUR_GITHUB_REPOSITORY_URL>
   cd Project-DropLink
   ```

2. **Install frontend dependencies**
   ```bash
   cd frontend
   npm install
   ```

3. **Install backend dependencies**
   ```bash
   cd ../backend
   npm install
   ```

---

## ⚙️ Environment Configuration

Create `backend/.env` using `.env.example` as a reference.

Example:
```env
NODE_ENV=development
PORT=5000
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/postgres"
CLIENT_URL=http://localhost:3000
WEBRTC_STUN_URL=stun:stun.l.google.com:19302
LOG_LEVEL=info
```

*Do not commit the real `.env` file.*

---

## 🗄️ Prisma Setup

From the `backend/` directory:

- Validate schema:
  ```bash
  npx prisma validate
  ```
- Generate Prisma Client:
  ```bash
  npx prisma generate
  ```
- Check migration status:
  ```bash
  npx prisma migrate status
  ```
- Apply existing migrations:
  ```bash
  npx prisma migrate deploy
  ```

---

## ▶️ Running the Application

### Start Backend
From `backend/`:
```bash
npm run dev
```
Backend will run at: `http://localhost:5000`

### Start Frontend
From `frontend/`:
```bash
npm run dev
```
Frontend will run at: `http://localhost:3000`

---

## 🧪 Development Commands

### Backend
```bash
npm run dev
npm run build
npm run lint
```

### Prisma
```bash
npx prisma validate
npx prisma generate
npx prisma migrate status
npx prisma migrate deploy
```

---

# 📊 Database Demonstration

DropLink can demonstrate several important DBMS concepts:

### Primary Keys
Each table has a primary key:
- `senders.id`
- `transfers.id`
- `bulk_sessions.id`
- `bulk_participants.id`

### Foreign Keys
- `transfers.sender_id` $$\rightarrow$$ `senders.id`
- `bulk_participants.session_id` $$\rightarrow$$ `bulk_sessions.session_id`

### Unique Constraints
- `transfers.token`
- `transfers.share_id`
- `senders.sender_code`
- `bulk_sessions.session_id`
- `bulk_sessions.bulk_code`
- `bulk_participants.participant_id`

### Indexes
Indexes are used for common operations such as:
- Transfer lookup by token
- Transfer lookup by share ID
- Expiration checks
- Transfer status lookup
- Bulk session lookup
- Host session lookup
- Participant lookup

### Relational Integrity
PostgreSQL foreign keys ensure that referenced records remain consistent. For example, `bulk_participants.session_id` must reference an existing `bulk_sessions.session_id`.

---

# 🧮 Large File Size Handling

File sizes are stored using PostgreSQL `BIGINT` where required.

This allows the database to safely represent large file sizes and byte counters beyond the range of a standard 32-bit integer.

---

# 🚀 Production Architecture

```text
                       ┌─────────────────┐
                       │     Vercel      │
                       │   Next.js App   │
                       └────────┬────────┘
                                │
                                │ HTTPS
                                ▼
                       ┌─────────────────┐
                       │     Render      │
                       │ Node / Express  │
                       │    Socket.IO    │
                       │     Prisma      │
                       └────────┬────────┘
                                │
                                │ PostgreSQL
                                ▼
                       ┌─────────────────┐
                       │    Supabase     │
                       │   PostgreSQL    │
                       └─────────────────┘


Sender ─────── WebRTC DataChannel ───────► Receiver
                     │
                 STUN / TURN
```

---

# 📡 API Overview

Main API areas include:
- `/api/v1/transfers`
- `/api/v1/upload`
- `/api/v1/download`
- `/api/v1/cleanup`
- `/api/v1/bulk`
- `/api/v1/webrtc/config`

### Transfer APIs
Used for transfer metadata creation, verification, lookup, status, and download-related operations.

### Bulk APIs
Used for:
- Bulk session creation
- Session lookup
- Participant joining
- Session status
- Session closing

### WebRTC API
Used for retrieving STUN/TURN configuration required to establish peer connections.

---

# 🔄 Transfer Lifecycle

Transfers use the following states:
```text
UPLOADING
     ↓
READY
     ↓
DOWNLOADING
     ↓
EXPIRED / COMPLETED
     ↓
DELETED
```
Failures can transition into `FAILED`.

---

# 🧩 Design Principles

### Separation of Concerns
```text
Frontend ──► API / Signaling ──► Database / WebRTC
```
Each part has a clearly defined responsibility.

### Database for Metadata
PostgreSQL stores application metadata and relational information.

### WebRTC for File Transfer
WebRTC handles the actual transfer of file bytes.

### Socket.IO for Signaling
Socket.IO coordinates the WebRTC handshake but does not carry the file itself.

---

# 📈 Project Status

### ✅ Completed
- WebRTC peer-to-peer file transfer
- Socket.IO signaling
- Real-time transfer progress
- Real-time transfer speed
- Bulk file distribution
- Multi-participant sessions
- PostgreSQL database migration
- Prisma ORM integration
- Supabase PostgreSQL integration
- Sender → Transfer relational mapping
- PostgreSQL foreign keys
- PostgreSQL indexes
- Transfer metadata persistence
- Bulk session persistence
- Participant persistence
- Connection-pool protection
- Automatic session/transfer expiry handling

### 🔮 Future Improvements
- Self-hosted TURN infrastructure
- Improved network diagnostics
- Additional cloud-storage fallback providers
- Advanced monitoring
- Additional security hardening
- More detailed transfer analytics
- Improved large-file optimization

---

# 🧪 Testing

Before deploying changes, verify:
- [x] Prisma schema validation
- [x] TypeScript compilation
- [x] ESLint/type checks
- [x] Backend build
- [x] Transfer creation
- [x] Sender creation
- [x] Transfer metadata persistence
- [x] WebRTC connection
- [x] File transfer
- [x] Download flow
- [x] Bulk session creation
- [x] Bulk participant joining
- [x] Session closing
- [x] Expiration handling

---

# 🤝 Contributing

1. Create a feature branch:
   ```bash
   git checkout -b feature/my-feature
   ```
2. Make your changes.
3. Run linting & build checks:
   ```bash
   npm run lint
   npm run build
   ```
4. Commit your changes:
   ```bash
   git commit -m "feat: add my feature"
   ```
5. Push the branch and create a pull request.

---

# 📄 License

This project is currently developed as an academic/personal project. A formal open-source license can be added when the project's licensing terms are finalized.

---

# 👨‍💻 Author

**Om Deshmukh**  
*DropLink — browser-based peer-to-peer file transfer.*

---

### ⭐ Project Summary

DropLink combines modern browser networking and relational database technology:

```text
                DropLink
                   │
        ┌──────────┴──────────┐
        │                     │
   PostgreSQL              WebRTC
   / Supabase              P2P Transfer
        │                     │
        ▼                     ▼
  Metadata &              Actual File
  Relationships              Bytes
```
