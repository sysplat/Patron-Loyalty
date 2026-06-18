import { SetMetadata, applyDecorators, UseGuards } from '@nestjs/common';
import { DisplayAuthGuard } from '../guards/display-auth.guard';

export const IS_DISPLAY_AUTH_KEY = 'isDisplayAuth';

/**
 * Mark a route as requiring display-device authentication.
 * The route is still @Public() (no user JWT), but requires a valid X-Display-Token header.
 *
 * Usage: @DisplayAuth() on a controller method
 */
export const DisplayAuth = () =>
  applyDecorators(SetMetadata(IS_DISPLAY_AUTH_KEY, true), UseGuards(DisplayAuthGuard));
