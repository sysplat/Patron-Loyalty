import { vi } from 'vitest';

export const mockRequestContext = {
  getRequestId: vi.fn().mockReturnValue('mock-req-id'),
  getOrgId: vi.fn(),
  getContext: vi.fn(),
  setTicketId: vi.fn(),
  setQueueId: vi.fn(),
  setOrgId: vi.fn(),
};
