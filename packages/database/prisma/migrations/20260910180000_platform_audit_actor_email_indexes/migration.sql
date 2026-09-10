-- Actor email prefix filters on Audit Trail (auth.* incidents).
CREATE INDEX IF NOT EXISTS "platform_audit_events_actor_email_created_at_idx"
  ON "platform_audit_events"("actor_email", "created_at" DESC);
