import { createZodDto } from 'nestjs-zod';
import { uploadMetadataSchema } from '@queueplatform/shared';

export class UploadMetadataDto extends createZodDto(uploadMetadataSchema) {}
