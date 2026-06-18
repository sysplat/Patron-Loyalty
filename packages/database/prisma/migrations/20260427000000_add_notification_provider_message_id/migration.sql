-- AlterTable
ALTER TABLE "notifications" ADD COLUMN "provider_message_id" VARCHAR(100);

-- CreateIndex
CREATE INDEX "notifications_provider_message_id_idx" ON "notifications"("provider_message_id");
