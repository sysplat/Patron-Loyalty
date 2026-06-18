"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadMetadataSchema = void 0;
const zod_1 = require("zod");
exports.uploadMetadataSchema = zod_1.z.object({
    entityType: zod_1.z.string().max(50).optional(),
    entityId: zod_1.z.string().uuid().optional(),
});
//# sourceMappingURL=upload.validators.js.map