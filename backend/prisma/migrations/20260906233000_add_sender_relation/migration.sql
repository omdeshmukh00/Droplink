-- CreateTable
CREATE TABLE "senders" (
    "id" TEXT NOT NULL,
    "sender_code" TEXT NOT NULL,
    "sender_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "senders_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "transfers" ADD COLUMN "sender_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "senders_sender_code_key" ON "senders"("sender_code");

-- CreateIndex
CREATE INDEX "transfers_sender_id_idx" ON "transfers"("sender_id");

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "senders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
