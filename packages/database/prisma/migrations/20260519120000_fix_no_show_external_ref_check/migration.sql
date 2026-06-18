-- Fix: Enforce receipt number (external_ref) ONLY on 'completed' journey tickets.
-- Customers marked as 'no_show' are not served and thus cannot have transaction references.

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
