"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.actionButtonStyles = void 0;
/**
 * Shared class strings for queue/workbench action buttons.
 * Frontend apps should consume this from @queueplatform/shared.
 */
exports.actionButtonStyles = {
    /** Primary positive CTA (activate flow, open line, save, etc.) */
    success: 'inline-flex items-center justify-center gap-1.5 rounded-md bg-emerald-600 text-white shadow-sm transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
    successSm: 'px-3 py-1.5 text-xs font-medium',
    successMd: 'rounded-lg px-4 py-2 text-sm font-semibold',
    successLg: 'h-9 rounded-lg px-3 text-xs font-semibold',
    serve: 'inline-flex items-center justify-center gap-1.5 rounded-md bg-[hsl(var(--action-serve))] text-white shadow-sm transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
    serveSm: 'px-3 py-1.5 text-xs font-semibold',
    serveMd: 'rounded-lg px-4 py-2 text-sm font-semibold',
    complete: 'inline-flex items-center justify-center gap-1.5 rounded-md bg-[hsl(var(--action-complete))] text-white shadow-sm transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
    completeSm: 'px-3 py-1.5 text-xs font-semibold',
    completeMd: 'rounded-lg px-4 py-2 text-sm font-semibold',
    ready: 'inline-flex items-center justify-center gap-1.5 rounded-md bg-[hsl(var(--action-ready))] text-white shadow-sm transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
    readySm: 'px-2.5 py-1.5 text-xs font-medium',
    /** Soft mark-ready outline variant for low-risk transitions. */
    readyOutline: 'inline-flex items-center justify-center gap-1.5 rounded-md border-2 border-emerald-500 bg-emerald-50 font-bold text-emerald-700 shadow-sm transition-colors hover:bg-emerald-100 dark:border-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 dark:hover:bg-emerald-950/40 disabled:pointer-events-none disabled:opacity-50',
    readyOutlineMd: 'flex-1 px-4 py-2.5 text-xs',
};
//# sourceMappingURL=action-button-styles.js.map