import { createZodDto } from 'nestjs-zod';
import { createReviewSchema, moderateReviewSchema } from '@queueplatform/shared';

export class CreateReviewDto extends createZodDto(createReviewSchema) {}
export class ModerateReviewDto extends createZodDto(moderateReviewSchema) {}
