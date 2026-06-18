import { readFileSync } from 'node:fs';

function assertContains(content, needle, message) {
  if (!content.includes(needle)) {
    throw new Error(message);
  }
}

const ticketController = readFileSync(
  new URL('../../packages/api/src/modules/ticket/ticket.controller.ts', import.meta.url),
  'utf8',
);
const publicQueueController = readFileSync(
  new URL('../../packages/api/src/modules/ticket/public-queue.controller.ts', import.meta.url),
  'utf8',
);
const visitController = readFileSync(
  new URL('../../packages/api/src/modules/ticket/visit.controller.ts', import.meta.url),
  'utf8',
);
const ticketService = readFileSync(
  new URL('../../packages/api/src/modules/ticket/ticket.service.ts', import.meta.url),
  'utf8',
);
const ticketPublicService = readFileSync(
  new URL('../../packages/api/src/modules/ticket/ticket-public.service.ts', import.meta.url),
  'utf8',
);
const publicTicketCode = `${ticketService}\n${ticketPublicService}`;

assertContains(
  ticketController,
  '@Throttle(TicketController.PUBLIC_LOOKUP_THROTTLE)',
  'Missing public lookup throttle on ticket controller.',
);
assertContains(
  ticketController,
  '@Throttle(TicketController.PUBLIC_ISSUE_THROTTLE)',
  'Missing public issue throttle on ticket controller.',
);
assertContains(
  publicQueueController,
  '@Throttle(PUBLIC_QUEUE_THROTTLE)',
  'Missing public queue throttles.',
);
assertContains(
  visitController,
  '@Throttle(VisitController.PUBLIC_VISIT_THROTTLE)',
  'Missing visit track throttle.',
);
assertContains(
  publicTicketCode,
  'customerPhoneMasked',
  'Public ticket responses are missing masked phone handling.',
);
assertContains(
  publicTicketCode,
  'customerNameMasked',
  'Public ticket responses are missing masked customer name handling.',
);
assertContains(
  publicTicketCode,
  'customerName: _omitName',
  'Public ticket responses must omit raw customerName before returning payload.',
);
assertContains(
  publicTicketCode,
  'customerNameMasked = deps.maskCustomerName(visit.customerName)',
  'Public visit responses must return masked customer names.',
);

console.log('Public safeguard checks passed.');
