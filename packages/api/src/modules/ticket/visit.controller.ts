import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  MessageEvent,
  Param,
  Post,
  Sse,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { TicketService } from './ticket.service';
import { CreateVisitStepDto } from './dto/ticket.dto';
import { VisitTrackSseService } from './visit-track-sse.service';

@ApiTags('Visits')
@ApiBearerAuth()
@Controller('visits')
export class VisitController {
  constructor(
    private readonly ticketService: TicketService,
    private readonly visitTrackSse: VisitTrackSseService,
  ) {}

  private static readonly PUBLIC_VISIT_THROTTLE = { medium: { limit: 30, ttl: 60_000 } };
  // Long-lived SSE that legitimately reconnects; keep parity with the ticket
  // track stream (20/min) so brief network blips don't trip the rate limiter.
  private static readonly PUBLIC_VISIT_STREAM_THROTTLE = { short: { limit: 20, ttl: 60_000 } };

  @Get(':id/track')
  @Public()
  @Throttle(VisitController.PUBLIC_VISIT_THROTTLE)
  @ApiOperation({ summary: 'Public visit tracking for multi-step customer journeys' })
  getTrack(@Param('id') id: string) {
    return this.ticketService.getVisitPublic(id);
  }

  /**
   * Server-Sent Events: emits when this visit's journey changes (Redis `track:visit:{visitId}`).
   * Clients should refetch `GET /visits/:id/track` on each message (payload is a lightweight hint).
   */
  @Sse(':id/track/stream')
  @Public()
  @Throttle(VisitController.PUBLIC_VISIT_STREAM_THROTTLE)
  @ApiOperation({
    summary:
      'Public SSE stream — nudges the visit track page to refetch when journey state changes',
  })
  trackStream(@Param('id') id: string): Observable<MessageEvent> {
    return this.visitTrackSse.observeVisitStream(id);
  }

  @Post(':id/steps')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions({ resource: 'ticket', action: 'create' })
  @ApiOperation({ summary: 'Create another ticket step for an existing visit' })
  createStep(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: CreateVisitStepDto,
  ) {
    return this.ticketService.createVisitStep(user.orgId, id, body);
  }
}
