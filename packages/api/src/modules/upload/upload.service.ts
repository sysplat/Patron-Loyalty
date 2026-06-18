import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { randomBytes } from 'crypto';
import { join, extname } from 'path';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';

const UPLOAD_DIR = process.env.STORAGE_LOCAL_PATH || './uploads';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'text/csv',
];

/**
 * Manages file uploads with local storage.
 * Files are stored in configurable local directory and tracked in the database.
 */
@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(orgId: string, entityType?: string, entityId?: string) {
    const where: any = { orgId };
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;

    return this.prisma.withTenant(orgId, (tx) =>
      tx.fileUpload.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async upload(
    orgId: string,
    userId: string,
    file: { originalname: string; buffer: Buffer; mimetype: string; size: number },
    entityType?: string,
    entityId?: string,
  ) {
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(`File type ${file.mimetype} is not allowed.`);
    }

    const ext = extname(file.originalname) || '.bin';
    const uniqueName = `${Date.now()}-${randomBytes(8).toString('hex')}${ext}`;
    const subDir = join(UPLOAD_DIR, orgId);
    const filePath = join(subDir, uniqueName);

    // Ensure directory exists
    if (!existsSync(subDir)) {
      await mkdir(subDir, { recursive: true });
    }

    await writeFile(filePath, file.buffer);

    const record = await this.prisma.withTenant(orgId, (tx) =>
      tx.fileUpload.create({
        data: {
          orgId,
          userId,
          filename: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          storagePath: filePath,
          entityType,
          entityId,
        },
      }),
    );

    this.logger.log(`File uploaded: ${record.id} (${file.originalname}, ${file.size} bytes)`);
    return record;
  }

  async delete(orgId: string, fileId: string) {
    const file = await this.prisma.withTenant(orgId, (tx) =>
      tx.fileUpload.findFirst({ where: { id: fileId, orgId } }),
    );
    if (!file) throw new NotFoundException('File not found');

    // Delete from filesystem
    try {
      await unlink(file.storagePath);
    } catch {
      this.logger.warn(`Could not delete file from disk: ${file.storagePath}`);
    }

    await this.prisma.withTenant(orgId, (tx) => tx.fileUpload.delete({ where: { id: fileId } }));
  }
}
