import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { UploadService } from './upload.service';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { UploadMetadataDto } from './dto/upload.dto';

@ApiTags('Uploads')
@ApiBearerAuth()
@Controller('uploads')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Get()
  @ApiOperation({ summary: 'List uploaded files' })
  @ApiQuery({ name: 'entityType', required: false })
  @ApiQuery({ name: 'entityId', required: false })
  @RequirePermissions({ resource: 'settings', action: 'read' })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
  ) {
    const data = await this.uploadService.list(user.orgId, entityType, entityId);
    return { success: true, data };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload a file' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @RequirePermissions({ resource: 'settings', action: 'create' })
  async upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: any,
    @Body() body: UploadMetadataDto,
  ) {
    const data = await this.uploadService.upload(
      user.orgId,
      user.userId ?? user.id,
      file,
      body.entityType,
      body.entityId,
    );
    return { success: true, data };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an uploaded file' })
  @RequirePermissions({ resource: 'settings', action: 'delete' })
  async delete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.uploadService.delete(user.orgId, id);
  }
}
