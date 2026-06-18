-- Org-level toggle for multi-step visit issuance (see FEATURE_VISIT_JOURNEYS in .env.example).
ALTER TABLE "organizations" ADD COLUMN "visit_journeys_enabled" BOOLEAN NOT NULL DEFAULT false;
