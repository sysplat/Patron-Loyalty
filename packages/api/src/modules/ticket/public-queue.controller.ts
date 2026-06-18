import { Controller, Get, Post, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { TicketService } from './ticket.service';
import { Public } from '../../common/decorators/public.decorator';
import { PublicJoinQueueDto } from './dto/ticket.dto';

const resolvePublicQueueThrottle = () => {
  const isProd = process.env.NODE_ENV === 'production';
  const raw = Number.parseInt(process.env.LOAD_TEST_PUBLIC_JOIN_LIMIT ?? '', 10);
  const limit = !isProd && Number.isFinite(raw) && raw > 0 ? raw : 20;
  return { medium: { limit, ttl: 60_000 } };
};
const PUBLIC_QUEUE_THROTTLE = resolvePublicQueueThrottle();

@ApiTags('Public Queue API')
@Controller('service-queue')
export class PublicQueueController {
  constructor(private readonly ticketService: TicketService) {}

  @Post('join')
  @Public()
  @Throttle(PUBLIC_QUEUE_THROTTLE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Public join queue' })
  async join(@Body() body: PublicJoinQueueDto) {
    const ticket = (await this.ticketService.issueTicket(
      body.orgId,
      {
        ...body,
        source: 'public',
      },
      'public',
    )) as any;

    // Return exact format requested by spec
    return {
      ticket_number: ticket.displayNumber,
      token: ticket.id,
      visit_token: ticket.visit?.trackingToken ?? null,
      position: ticket.position,
      wait: ticket.visit?.trackingToken
        ? null
        : {
            min: ticket.estimatedWaitMins,
            max: ticket.estimatedWaitMax,
          },
    };
  }

  @Get('status/:token')
  @Public()
  @Throttle(PUBLIC_QUEUE_THROTTLE)
  @ApiOperation({ summary: 'Public ticket status' })
  async status(@Param('token') token: string) {
    const ticket = (await this.ticketService.getTicketPublic(token)) as any;

    return {
      ticket_number: ticket.displayNumber,
      status: ticket.status,
      position: ticket.position,
      desk_name: ticket.deskNumber ? `Desk ${ticket.deskNumber}` : null,
      wait:
        ticket.status === 'waiting'
          ? {
              min: ticket.estimatedWaitMins,
              max: ticket.estimatedWaitMax,
            }
          : null,
    };
  }
}
