ALTER TABLE "queues"
ADD COLUMN "next_ticket_seq" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "session_opened_at" TIMESTAMP(3),
ADD COLUMN "session_closes_at" TIMESTAMP(3);
