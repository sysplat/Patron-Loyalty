-- CreateIndex
CREATE INDEX "tickets_org_id_queue_id_status_booked_at_idx" ON "tickets"("org_id", "queue_id", "status", "booked_at");
