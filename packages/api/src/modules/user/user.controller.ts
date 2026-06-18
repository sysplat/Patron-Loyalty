import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UserService } from './user.service';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import {
  AllowBranchScopedListRead,
  RequirePermissions,
} from '../../common/decorators/permissions.decorator';
import { InviteUserDto, SetUserPasswordDto, UpdateUserDto } from './dto/user.dto';
import { ListUsersQueryDto } from './dto/user-query.dto';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @AllowBranchScopedListRead()
  @ApiOperation({ summary: 'List users' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @RequirePermissions({ resource: 'user', action: 'read' })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListUsersQueryDto) {
    return this.userService.listForPrincipal(user.orgId, user.userId, query);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.userService.getById(user.orgId, user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @RequirePermissions({ resource: 'user', action: 'read' })
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.userService.getById(user.orgId, id);
  }

  @Post('invite')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new assigned user (owner/admin sets initial password)' })
  @RequirePermissions({ resource: 'user', action: 'create' })
  invite(@CurrentUser() user: AuthenticatedUser, @Body() body: InviteUserDto) {
    return this.userService.invite(user.orgId, user.userId, body);
  }

  @Post(':id/reset-two-factor')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset two-factor authentication for another user',
    description:
      'Clears TOTP enrollment and backup codes, and revokes the user’s sessions. Use when a team member lost their authenticator and backup codes. Cannot be used on your own account.',
  })
  @RequirePermissions({ resource: 'user', action: 'update' })
  resetTwoFactor(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.userService.resetTwoFactorForUser(user.orgId, id, user.userId);
  }

  @Post(':id/set-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Set a new password for another user (owner/admin recovery)',
    description:
      'Sets a compliant password chosen by an owner or admin, clears two-factor authentication, and revokes all sessions. The user signs in with the new password and must complete 2FA setup again. Cannot target your own account; only an owner may use this for another owner.',
  })
  @RequirePermissions({ resource: 'user', action: 'update' })
  setPasswordForUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: SetUserPasswordDto,
  ) {
    return this.userService.setPasswordForUser(user.orgId, id, user.userId, body.password);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user' })
  @RequirePermissions({ resource: 'user', action: 'update' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateUserDto,
  ) {
    return this.userService.update(user.orgId, id, user.userId, body);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate user' })
  @RequirePermissions({ resource: 'user', action: 'update' })
  deactivate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.userService.deactivate(user.orgId, id, user.userId);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate user' })
  @RequirePermissions({ resource: 'user', action: 'update' })
  activate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.userService.activate(user.orgId, id, user.userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete user' })
  @RequirePermissions({ resource: 'user', action: 'delete' })
  async delete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.userService.delete(user.orgId, id, user.userId);
  }
}
