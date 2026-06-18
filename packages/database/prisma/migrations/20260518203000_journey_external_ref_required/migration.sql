-- Journey transaction refs: canonical visit column + DB enforcement on terminal tickets.
-- Backfill lives in 20260518203100_backfill_journey_external_ref (separate migration so
-- PostgreSQL plans UPDATEs only after external_ref columns exist on both tables).

ALTER TABLE "visits" ADD COLUMN IF NOT EXISTS "external_ref" VARCHAR(100);
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "external_ref" VARCHAR(100);

-- Keep visits.external_ref in sync when a journey ticket stores a receipt.
CREATE OR REPLACE FUNCTION sync_visit_external_ref_from_ticket()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.visit_id IS NOT NULL
       AND NEW.external_ref IS NOT NULL
       AND btrim(NEW.external_ref) <> '' THEN
        UPDATE "visits"
        SET "external_ref" = btrim(NEW.external_ref)
        WHERE id = NEW.visit_id
          AND ("external_ref" IS NULL OR btrim("external_ref") = '');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tickets_sync_visit_external_ref ON "tickets";
CREATE TRIGGER tickets_sync_visit_external_ref
    AFTER INSERT OR UPDATE OF external_ref ON "tickets"
    FOR EACH ROW
    EXECUTE FUNCTION sync_visit_external_ref_from_ticket();

-- Enforce receipt on terminal journey tickets (service/pickup lanes or step_index >= 1).
CREATE OR REPLACE FUNCTION enforce_journey_ticket_external_ref()
RETURNS TRIGGER AS $$
DECLARE
    queue_role VARCHAR(30);
BEGIN
    IF NEW.visit_id IS NULL OR NEW.status <> 'completed' THEN
        RETURN NEW;
    END IF;

    IF NEW.external_ref IS NOT NULL AND btrim(NEW.external_ref) <> '' THEN
        RETURN NEW;
    END IF;

    SELECT q.step_role INTO queue_role
    FROM "queues" q
    WHERE q.id = NEW.queue_id;

    IF queue_role IN ('service', 'pickup')
       OR (NEW.step_index IS NOT NULL AND NEW.step_index >= 1) THEN
        RAISE EXCEPTION
            'Transaction number (external_ref) is required for journey tickets on terminal status %',
            NEW.status
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tickets_enforce_journey_external_ref ON "tickets";
CREATE TRIGGER tickets_enforce_journey_external_ref
    BEFORE INSERT OR UPDATE OF status, external_ref, visit_id, queue_id, step_index ON "tickets"
    FOR EACH ROW
    EXECUTE FUNCTION enforce_journey_ticket_external_ref();
