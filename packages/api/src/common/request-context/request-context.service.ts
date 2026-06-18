import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContextData {
  requestId: string;
  ip?: string;
  userAgent?: string;
  userId?: string;
  orgId?: string;
  ticketId?: string;
  queueId?: string;
}

@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContextData>();

  run<T>(context: RequestContextData, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  getContext(): RequestContextData | undefined {
    return this.storage.getStore();
  }

  getRequestId(): string | undefined {
    return this.storage.getStore()?.requestId;
  }

  getOrgId(): string | undefined {
    return this.storage.getStore()?.orgId;
  }

  setUserId(userId: string): void {
    const store = this.storage.getStore();
    if (store) {
      store.userId = userId;
    }
  }

  setOrgId(orgId: string): void {
    const store = this.storage.getStore();
    if (store) {
      store.orgId = orgId;
    }
  }

  setTicketId(ticketId: string): void {
    const store = this.storage.getStore();
    if (store) {
      store.ticketId = ticketId;
    }
  }

  setQueueId(queueId: string): void {
    const store = this.storage.getStore();
    if (store) {
      store.queueId = queueId;
    }
  }
}
