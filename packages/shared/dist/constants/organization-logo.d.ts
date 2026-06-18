/** Tenant organization logo upload limits (Settings → Organization). */
export declare const ORGANIZATION_LOGO_MAX_UPLOAD_BYTES: number;
export declare const ORGANIZATION_LOGO_MAX_UPLOAD_LABEL = "2 MB";
/** Max stored data URL length (~base64 expansion of a 2 MB file). */
export declare const ORGANIZATION_LOGO_MAX_DATA_URL_LENGTH = 2900000;
export declare const ORGANIZATION_LOGO_MAX_DIMENSION_PX = 512;
export declare function organizationLogoFileTooLargeMessage(fileSizeBytes: number): string;
export declare const ORGANIZATION_LOGO_UPLOAD_HINT = "PNG or JPEG recommended, square or wide. Max 2 MB. We resize to 512px for kiosk and booking pages.";
//# sourceMappingURL=organization-logo.d.ts.map