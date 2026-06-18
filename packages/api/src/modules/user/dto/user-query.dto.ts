import { createZodDto } from 'nestjs-zod';
import { listUsersQuerySchema } from '@queueplatform/shared';

export class ListUsersQueryDto extends createZodDto(listUsersQuerySchema) {}
