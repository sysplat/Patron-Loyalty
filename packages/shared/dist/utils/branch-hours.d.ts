export interface BranchHoursWindow {
    openTime: string;
    closeTime: string;
    isClosed: boolean;
    breakStart: string | null;
    breakEnd: string | null;
}
export type BranchAvailabilityReason = 'open' | 'closed_day' | 'outside_hours' | 'break' | 'no_schedule';
export interface BranchAvailabilityEvaluation {
    isOpen: boolean;
    reason: BranchAvailabilityReason;
    localDate: string;
    window: BranchHoursWindow | null;
    openAtUtc: Date | null;
    closeAtUtc: Date | null;
    breakStartUtc: Date | null;
    breakEndUtc: Date | null;
}
export declare function isoDateToUtcDate(date: string): Date;
export declare function getIsoDateFromUtcDate(date: Date): string;
/** Mon=0 … Sun=6 (matches Prisma working_hours.day_of_week). */
export declare function toSchemaDayOfWeekFromIsoDate(date: string): number;
export declare function normalizeIsoDateKey(date: string): string;
export declare function getDateKeyInTimeZone(date: Date, timeZone: string): string;
export declare function zonedDateTimeToUtc(date: string, time: string, timeZone: string): Date;
export declare function getUtcRangeForZonedDate(date: string, timeZone: string): {
    start: Date;
    end: Date;
};
export declare function intervalsOverlap(startA: Date, endA: Date, startB: Date, endB: Date): boolean;
export declare function resolveWindowUtcBounds(localDate: string, window: BranchHoursWindow, timeZone: string): Pick<BranchAvailabilityEvaluation, 'openAtUtc' | 'closeAtUtc' | 'breakStartUtc' | 'breakEndUtc'>;
export declare function evaluateBranchAvailabilityAtInstant(at: Date, timeZone: string, window: BranchHoursWindow | null, localDate: string): BranchAvailabilityEvaluation;
export declare function evaluateAppointmentSlotAgainstWindow(scheduledAt: Date, durationMinutes: number, timeZone: string, window: BranchHoursWindow | null, localDate: string): BranchAvailabilityReason | 'open';
export declare function branchAvailabilityMessage(reason: BranchAvailabilityReason, actionLabel?: string, window?: BranchHoursWindow | null): string;
//# sourceMappingURL=branch-hours.d.ts.map