import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { VisitTrackSseService } from './visit-track-sse.service';

describe('VisitTrackSseService', () => {
  const mockPrisma = {
    withBypassRls: vi.fn(),
    visit: { findFirst: vi.fn() },
  };
  const mockPubSub = {
    subscribe: vi.fn(),
  };

  let service: VisitTrackSseService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.withBypassRls.mockImplementation(async (cb: (tx: typeof mockPrisma) => unknown) =>
      cb(mockPrisma),
    );
    service = new VisitTrackSseService(mockPrisma as never, mockPubSub as never);
  });

  it('resolves visit id via withBypassRls (public tracking token)', async () => {
    mockPrisma.visit.findFirst.mockResolvedValue({ id: 'visit-1' });
    mockPubSub.subscribe.mockResolvedValue(() => {});

    await new Promise<void>((resolve, reject) => {
      const sub = service.observeVisitStream('tracking-token-abc').subscribe({
        next: (ev) => {
          if (String(ev.data).includes('"type":"connected"')) {
            expect(mockPrisma.withBypassRls).toHaveBeenCalled();
            expect(mockPrisma.visit.findFirst).toHaveBeenCalledWith(
              expect.objectContaining({
                where: {
                  OR: [{ id: 'tracking-token-abc' }, { trackingToken: 'tracking-token-abc' }],
                },
              }),
            );
            expect(String(ev.data)).toContain('visit-1');
            sub.unsubscribe();
            resolve();
          }
        },
        error: reject,
      });
    });
  });

  it('throws NotFoundException when visit is missing', async () => {
    mockPrisma.visit.findFirst.mockResolvedValue(null);

    await expect(firstValueFrom(service.observeVisitStream('missing'))).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
