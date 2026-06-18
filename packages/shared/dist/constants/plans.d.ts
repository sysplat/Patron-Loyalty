import type { PlanLimits } from '../types/api.types';
export interface PlanDefinition {
    name: string;
    slug: string;
    priceMonthly: number;
    priceYearly: number;
    description: string;
    features: Record<string, boolean>;
    limits: PlanLimits;
}
export declare const PLANS: Record<string, PlanDefinition>;
/** Standalone Patron Loyalty (LMS) — sold without QlessQ queue. */
export declare const LOYALTY_STARTER: PlanDefinition;
export declare const PLAN_SLUGS: string[];
export declare const ALL_PLAN_SLUGS: string[];
//# sourceMappingURL=plans.d.ts.map