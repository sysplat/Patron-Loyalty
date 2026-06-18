import { Centrifuge } from 'centrifuge';

let centrifuge: Centrifuge | null = null;
let currentToken: string | undefined;
const channelListeners = new Map<string, number>();

export function getCentrifuge(token?: string, wsUrlStr?: string): Centrifuge {
  // Recreate when token changes (e.g. anonymous display → authenticated agent)
  if (centrifuge && token !== currentToken) {
    centrifuge.disconnect();
    centrifuge = null;
    channelListeners.clear();
  }

  if (centrifuge) return centrifuge;

  currentToken = token;
  const wsUrl =
    wsUrlStr ??
    process.env.NEXT_PUBLIC_CENTRIFUGO_WS_URL ??
    'ws://localhost:8000/connection/websocket';

  centrifuge = new Centrifuge(wsUrl, {
    token: token,
    getToken: async () => {
      const res = await fetch('/api/centrifugo-token');
      const data = await res.json();
      return data.token;
    },
  });

  centrifuge.on('error', (err) => {
    console.error('[Centrifugo] connection error', err);
  });

  centrifuge.connect();
  return centrifuge;
}

export function disconnectCentrifuge() {
  if (centrifuge) {
    centrifuge.disconnect();
    centrifuge = null;
    channelListeners.clear();
  }
}

/**
 * Attach a publication listener without duplicating Centrifugo subscriptions.
 * Reuses an existing subscription when another surface shares a channel.
 */
export function listenChannel(
  centrifugeClient: Centrifuge,
  channel: string,
  onPublication: (ctx: { data: unknown }) => void,
): () => void {
  const count = channelListeners.get(channel) ?? 0;
  channelListeners.set(channel, count + 1);

  let sub = centrifugeClient.getSubscription(channel);
  if (!sub) {
    sub = centrifugeClient.newSubscription(channel);
    sub.subscribe();
  }
  sub.on('publication', onPublication);

  return () => {
    sub.off('publication', onPublication);
    const currentCount = channelListeners.get(channel) ?? 0;
    const newCount = currentCount - 1;
    if (newCount <= 0) {
      channelListeners.delete(channel);
      try {
        sub.unsubscribe();
        centrifugeClient.removeSubscription(sub);
      } catch {
        /* ignore */
      }
    } else {
      channelListeners.set(channel, newCount);
    }
  };
}

/** Org-wide events (dashboard, operations, queues list, announcements). */
export function listenOrgChannel(
  centrifugeClient: Centrifuge,
  orgId: string,
  onPublication: (ctx: { data: unknown }) => void,
): () => void {
  return listenChannel(centrifugeClient, `org:${orgId}`, onPublication);
}

/** Queue channel listener without duplicating subscriptions. */
export function listenQueueChannel(
  centrifugeClient: Centrifuge,
  queueId: string,
  onPublication: (ctx: { data: unknown }) => void,
): () => void {
  return listenChannel(centrifugeClient, `queue:${queueId}`, onPublication);
}
