export declare const SYSTEM_ROLES: {
    readonly OWNER: "owner";
    readonly ADMIN: "admin";
    readonly MANAGER: "manager";
    readonly STAFF: "staff";
    readonly VIEWER: "viewer";
};
export type SystemRole = (typeof SYSTEM_ROLES)[keyof typeof SYSTEM_ROLES];
export declare const RESOURCES: {
    readonly ORGANIZATION: "organization";
    readonly BRANCH: "branch";
    readonly SERVICE: "service";
    readonly QUEUE: "queue";
    readonly TICKET: "ticket";
    readonly APPOINTMENT: "appointment";
    readonly DESK: "desk";
    readonly ANNOUNCEMENT: "announcement";
    readonly USER: "user";
    readonly ROLE: "role";
    readonly REPORT: "report";
    readonly BILLING: "billing";
    readonly DISPLAY: "display";
    readonly NOTIFICATION: "notification";
    readonly SETTINGS: "settings";
    readonly REVIEW: "review";
    readonly CUSTOMER: "customer";
    readonly STATION_PROFILE: "station_profile";
};
export type Resource = (typeof RESOURCES)[keyof typeof RESOURCES];
export declare const ACTIONS: {
    readonly CREATE: "create";
    readonly READ: "read";
    readonly UPDATE: "update";
    readonly DELETE: "delete";
    readonly MANAGE: "manage";
};
export type Action = (typeof ACTIONS)[keyof typeof ACTIONS];
export type PermissionScope = 'own' | 'branch' | 'org';
export declare const SYSTEM_ROLE_DESCRIPTIONS: Record<SystemRole, string>;
export declare const DEFAULT_ROLE_PERMISSIONS: Record<SystemRole, Array<{
    resource: Resource;
    action: Action;
    scope: PermissionScope;
}>>;
//# sourceMappingURL=roles.d.ts.map