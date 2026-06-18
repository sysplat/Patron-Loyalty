"use strict";
// ─── Branch schedule / operating-hours utilities ─────────────────────────────
// Shared between API enforcement and web UI hints. Timezone math matches
// appointment slot generation (IANA zones, date overrides beat weekly hours).
Object.defineProperty(exports, "__esModule", { value: true });
exports.isoDateToUtcDate = isoDateToUtcDate;
exports.getIsoDateFromUtcDate = getIsoDateFromUtcDate;
exports.toSchemaDayOfWeekFromIsoDate = toSchemaDayOfWeekFromIsoDate;
exports.normalizeIsoDateKey = normalizeIsoDateKey;
exports.getDateKeyInTimeZone = getDateKeyInTimeZone;
exports.zonedDateTimeToUtc = zonedDateTimeToUtc;
exports.getUtcRangeForZonedDate = getUtcRangeForZonedDate;
exports.intervalsOverlap = intervalsOverlap;
exports.resolveWindowUtcBounds = resolveWindowUtcBounds;
exports.evaluateBranchAvailabilityAtInstant = evaluateBranchAvailabilityAtInstant;
exports.evaluateAppointmentSlotAgainstWindow = evaluateAppointmentSlotAgainstWindow;
exports.branchAvailabilityMessage = branchAvailabilityMessage;
function isoDateToUtcDate(date) {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
}
function getIsoDateFromUtcDate(date) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}
/** Mon=0 … Sun=6 (matches Prisma working_hours.day_of_week). */
function toSchemaDayOfWeekFromIsoDate(date) {
    const jsDay = isoDateToUtcDate(date).getUTCDay();
    return jsDay === 0 ? 6 : jsDay - 1;
}
function normalizeIsoDateKey(date) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (!match) {
        throw new Error('Invalid ISO date');
    }
    const normalized = `${match[1]}-${match[2]}-${match[3]}`;
    const utcDate = isoDateToUtcDate(normalized);
    if (Number.isNaN(utcDate.getTime()) || getIsoDateFromUtcDate(utcDate) !== normalized) {
        throw new Error('Invalid ISO date');
    }
    return normalized;
}
function getDateKeyInTimeZone(date, timeZone) {
    const parts = getTimeZoneParts(date, timeZone);
    return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}
function zonedDateTimeToUtc(date, time, timeZone) {
    const [year, month, day] = date.split('-').map(Number);
    const [hours, minutes] = time.split(':').map(Number);
    const baseUtc = Date.UTC(year, (month ?? 1) - 1, day ?? 1, hours ?? 0, minutes ?? 0, 0, 0);
    let candidate = new Date(baseUtc);
    for (let index = 0; index < 2; index += 1) {
        const offsetMinutes = getTimeZoneOffsetMinutes(candidate, timeZone);
        candidate = new Date(baseUtc - offsetMinutes * 60 * 1000);
    }
    return candidate;
}
function getUtcRangeForZonedDate(date, timeZone) {
    const start = zonedDateTimeToUtc(date, '00:00', timeZone);
    const [year, month, day] = date.split('-').map(Number);
    const nextDay = new Date(Date.UTC(year, (month ?? 1) - 1, (day ?? 1) + 1));
    const nextDate = getIsoDateFromUtcDate(nextDay);
    const nextStart = zonedDateTimeToUtc(nextDate, '00:00', timeZone);
    return {
        start,
        end: new Date(nextStart.getTime() - 1),
    };
}
function intervalsOverlap(startA, endA, startB, endB) {
    return startA < endB && startB < endA;
}
function resolveWindowUtcBounds(localDate, window, timeZone) {
    const openAtUtc = zonedDateTimeToUtc(localDate, window.openTime, timeZone);
    const closeAtUtc = zonedDateTimeToUtc(localDate, window.closeTime, timeZone);
    const breakStartUtc = window.breakStart
        ? zonedDateTimeToUtc(localDate, window.breakStart, timeZone)
        : null;
    const breakEndUtc = window.breakEnd
        ? zonedDateTimeToUtc(localDate, window.breakEnd, timeZone)
        : null;
    return { openAtUtc, closeAtUtc, breakStartUtc, breakEndUtc };
}
function evaluateBranchAvailabilityAtInstant(at, timeZone, window, localDate) {
    if (!window || window.isClosed || !window.openTime || !window.closeTime) {
        return {
            isOpen: false,
            reason: 'closed_day',
            localDate,
            window: null,
            openAtUtc: null,
            closeAtUtc: null,
            breakStartUtc: null,
            breakEndUtc: null,
        };
    }
    const bounds = resolveWindowUtcBounds(localDate, window, timeZone);
    const { openAtUtc, closeAtUtc, breakStartUtc, breakEndUtc } = bounds;
    if (at < openAtUtc || at >= closeAtUtc) {
        return {
            isOpen: false,
            reason: 'outside_hours',
            localDate,
            window,
            ...bounds,
        };
    }
    if (breakStartUtc && breakEndUtc && at >= breakStartUtc && at < breakEndUtc) {
        return {
            isOpen: false,
            reason: 'break',
            localDate,
            window,
            ...bounds,
        };
    }
    return {
        isOpen: true,
        reason: 'open',
        localDate,
        window,
        ...bounds,
    };
}
function evaluateAppointmentSlotAgainstWindow(scheduledAt, durationMinutes, timeZone, window, localDate) {
    if (!window || window.isClosed || !window.openTime || !window.closeTime) {
        return 'closed_day';
    }
    const start = scheduledAt;
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
    const bounds = resolveWindowUtcBounds(localDate, window, timeZone);
    const { openAtUtc, closeAtUtc, breakStartUtc, breakEndUtc } = bounds;
    if (start < openAtUtc || end > closeAtUtc) {
        return 'outside_hours';
    }
    if (breakStartUtc && breakEndUtc && intervalsOverlap(start, end, breakStartUtc, breakEndUtc)) {
        return 'break';
    }
    return 'open';
}
function branchAvailabilityMessage(reason, actionLabel, window) {
    const action = actionLabel ? ` before ${actionLabel}` : '';
    switch (reason) {
        case 'open':
            return 'Branch is open.';
        case 'closed_day':
            return `This branch is closed on this day. Operations are unavailable${action}.`;
        case 'outside_hours':
            if (window?.openTime && window.closeTime) {
                return `This branch is outside operating hours (${window.openTime}–${window.closeTime} local time). Operations are unavailable${action}.`;
            }
            return `This branch is outside operating hours. Operations are unavailable${action}.`;
        case 'break':
            if (window?.breakStart && window.breakEnd) {
                return `This branch is on a scheduled break (${window.breakStart}–${window.breakEnd} local time). Operations are unavailable${action}.`;
            }
            return `This branch is on a scheduled break. Operations are unavailable${action}.`;
        case 'no_schedule':
            return `No operating schedule is configured for this branch. Operations are unavailable${action}.`;
        default: {
            const _exhaustive = reason;
            return _exhaustive;
        }
    }
}
function getTimeZoneOffsetMinutes(date, timeZone) {
    const parts = getTimeZoneParts(date, timeZone);
    const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    return Math.round((asUtc - date.getTime()) / (60 * 1000));
}
function getTimeZoneParts(date, timeZone) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour12: false,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
    const parts = formatter.formatToParts(date);
    const readPart = (type) => Number(parts.find((part) => part.type === type)?.value ?? '0');
    return {
        year: readPart('year'),
        month: readPart('month'),
        day: readPart('day'),
        hour: readPart('hour'),
        minute: readPart('minute'),
        second: readPart('second'),
    };
}
//# sourceMappingURL=branch-hours.js.map