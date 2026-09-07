-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('UPLOADING', 'READY', 'DOWNLOADING', 'EXPIRED', 'DELETED', 'FAILED');

-- CreateEnum
CREATE TYPE "TransferType" AS ENUM ('single', 'zip');

-- CreateEnum
CREATE TYPE "BulkSessionStatus" AS ENUM ('CREATING', 'ACTIVE', 'ENDING', 'CLOSED', 'FAILED');

-- CreateEnum
CREATE TYPE "BulkParticipantStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'LEFT');

-- CreateTable
CREATE TABLE "transfers" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "share_id" TEXT NOT NULL,
    "drive_file_id" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "stored_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" BIGINT NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'UPLOADING',
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "max_downloads" INTEGER NOT NULL DEFAULT 1,
    "receiver_limit_enabled" BOOLEAN NOT NULL DEFAULT false,
    "receiver_limit" INTEGER,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "last_accessed_at" TIMESTAMP(3),
    "download_started_at" TIMESTAMP(3),
    "download_completed_at" TIMESTAMP(3),
    "transfer_type" "TransferType" NOT NULL DEFAULT 'single',
    "drive_metadata" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bulk_sessions" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "bulk_code" TEXT NOT NULL,
    "status" "BulkSessionStatus" NOT NULL DEFAULT 'CREATING',
    "host_socket_id" TEXT,
    "last_host_heartbeat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "participant_count" INTEGER NOT NULL DEFAULT 0,
    "max_participants" INTEGER NOT NULL DEFAULT 50,
    "settings" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bulk_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bulk_participants" (
    "id" TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "socket_id" TEXT,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "BulkParticipantStatus" NOT NULL DEFAULT 'CONNECTED',
    "files_uploaded" INTEGER NOT NULL DEFAULT 0,
    "total_bytes_uploaded" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bulk_participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transfers_token_key" ON "transfers"("token");

-- CreateIndex
CREATE UNIQUE INDEX "transfers_share_id_key" ON "transfers"("share_id");

-- CreateIndex
CREATE INDEX "transfers_status_idx" ON "transfers"("status");

-- CreateIndex
CREATE INDEX "transfers_expires_at_idx" ON "transfers"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "bulk_sessions_session_id_key" ON "bulk_sessions"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "bulk_sessions_bulk_code_key" ON "bulk_sessions"("bulk_code");

-- CreateIndex
CREATE INDEX "bulk_sessions_status_idx" ON "bulk_sessions"("status");

-- CreateIndex
CREATE INDEX "bulk_sessions_host_socket_id_idx" ON "bulk_sessions"("host_socket_id");

-- CreateIndex
CREATE INDEX "bulk_sessions_last_host_heartbeat_idx" ON "bulk_sessions"("last_host_heartbeat");

-- CreateIndex
CREATE UNIQUE INDEX "bulk_participants_participant_id_key" ON "bulk_participants"("participant_id");

-- CreateIndex
CREATE INDEX "bulk_participants_session_id_idx" ON "bulk_participants"("session_id");

-- AddForeignKey
ALTER TABLE "bulk_participants" ADD CONSTRAINT "bulk_participants_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "bulk_sessions"("session_id") ON DELETE CASCADE ON UPDATE CASCADE;
