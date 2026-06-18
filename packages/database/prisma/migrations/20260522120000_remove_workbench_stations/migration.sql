-- Journey sessions now use desks; workbench_stations is legacy.
ALTER TABLE "agent_sessions" DROP CONSTRAINT IF EXISTS "agent_sessions_workbench_station_id_fkey";
ALTER TABLE "agent_sessions" DROP COLUMN IF EXISTS "workbench_station_id";
DROP TABLE IF EXISTS "workbench_stations";
