/** Static canned replies for platform support operators (no DB yet). */
export const SUPPORT_CANNED_REPLIES = [
  {
    id: 'ack',
    label: 'Acknowledge',
    body: 'Thanks for reaching out — we’ve received your request and are looking into it. We’ll follow up shortly.',
  },
  {
    id: 'need-info',
    label: 'Need more info',
    body: 'Thanks for the report. Could you share: (1) org slug / branch, (2) approximate time of the issue, and (3) a screenshot or ticket number if available?',
  },
  {
    id: 'billing',
    label: 'Billing follow-up',
    body: 'We’ve reviewed the billing details on your account. If anything still looks off after your next invoice cycle, reply here and we’ll dig in further.',
  },
  {
    id: 'sms',
    label: 'SMS delivery',
    body: 'We’re checking SMS delivery for your account (Twilio Messaging Service / credits). We’ll update this ticket once we confirm status on our side.',
  },
  {
    id: 'resolved',
    label: 'Resolved',
    body: 'This should now be resolved on our side. Please reply if you still see the issue and we’ll reopen immediately.',
  },
] as const;

export function formatSlaCountdown(dueAt: string | Date | null | undefined): {
  label: string;
  overdue: boolean;
  minutesRemaining: number | null;
} {
  if (!dueAt) return { label: 'No SLA', overdue: false, minutesRemaining: null };
  const due = new Date(dueAt).getTime();
  if (Number.isNaN(due)) return { label: 'No SLA', overdue: false, minutesRemaining: null };
  const minutesRemaining = Math.round((due - Date.now()) / 60_000);
  if (minutesRemaining < 0) {
    const mins = Math.abs(minutesRemaining);
    if (mins < 60) return { label: `${mins}m overdue`, overdue: true, minutesRemaining };
    const hrs = Math.floor(mins / 60);
    return { label: `${hrs}h overdue`, overdue: true, minutesRemaining };
  }
  if (minutesRemaining < 60) {
    return { label: `${minutesRemaining}m left`, overdue: false, minutesRemaining };
  }
  const hrs = Math.floor(minutesRemaining / 60);
  return { label: `${hrs}h left`, overdue: false, minutesRemaining };
}
