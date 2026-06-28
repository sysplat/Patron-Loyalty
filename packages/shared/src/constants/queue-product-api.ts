/** First URI segment after `/api/v1/` for queue-management (QMS) routes. */
export const QUEUE_PRODUCT_API_PREFIXES = [
  'branches',
  'services',
  'queues',
  'flow-templates',
  'guided-setup',
  'tickets',
  'service-queue',
  'visits',
  'desks',
  'display',
  'appointments',
  'announcements',
  'reviews',
  'workbench',
  'station-profiles',
  'agent-sessions',
  'reports',
  'realtime',
] as const;

export type QueueProductApiPrefix = (typeof QUEUE_PRODUCT_API_PREFIXES)[number];

export function isQueueProductApiPath(path: string): boolean {
  const normalized = path.toLowerCase();
  const match = normalized.match(/\/api\/v\d+\/([^/?]+)/);
  if (!match) return false;
  return (QUEUE_PRODUCT_API_PREFIXES as readonly string[]).includes(match[1]);
}
