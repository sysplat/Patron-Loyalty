"use strict";
/** Tenant organization logo upload limits (Settings → Organization). */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ORGANIZATION_LOGO_UPLOAD_HINT = exports.ORGANIZATION_LOGO_MAX_DIMENSION_PX = exports.ORGANIZATION_LOGO_MAX_DATA_URL_LENGTH = exports.ORGANIZATION_LOGO_MAX_UPLOAD_LABEL = exports.ORGANIZATION_LOGO_MAX_UPLOAD_BYTES = void 0;
exports.organizationLogoFileTooLargeMessage = organizationLogoFileTooLargeMessage;
exports.ORGANIZATION_LOGO_MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
exports.ORGANIZATION_LOGO_MAX_UPLOAD_LABEL = '2 MB';
/** Max stored data URL length (~base64 expansion of a 2 MB file). */
exports.ORGANIZATION_LOGO_MAX_DATA_URL_LENGTH = 2_900_000;
exports.ORGANIZATION_LOGO_MAX_DIMENSION_PX = 512;
function organizationLogoFileTooLargeMessage(fileSizeBytes) {
    const fileMb = (fileSizeBytes / (1024 * 1024)).toFixed(1);
    return `This image is ${fileMb} MB. Logo uploads must be ${exports.ORGANIZATION_LOGO_MAX_UPLOAD_LABEL} or smaller. Try a smaller file or a compressed PNG/JPEG.`;
}
exports.ORGANIZATION_LOGO_UPLOAD_HINT = 'PNG or JPEG recommended, square or wide. Max 2 MB. We resize to 512px for kiosk and booking pages.';
//# sourceMappingURL=organization-logo.js.map