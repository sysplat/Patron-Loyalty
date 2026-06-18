import { Injectable } from '@nestjs/common';
import type { ProductSku } from '@queueplatform/shared';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { PlatformAuditService } from '../../common/audit/platform-audit.service';
import { AuditService } from '../../common/audit/audit.service';
import { RedisService } from '../../redis/redis.service';
import { AuthTokenService } from './auth-token.service';
import { AuthRegistrationService } from './auth-registration.service';
import { AuthLoginService } from './auth-login.service';
import { AuthPasswordService } from './auth-password.service';
import { AuthVerificationService } from './auth-verification.service';
import {
  AuthImpersonationService,
  type ImpersonationStartOptions,
  type ImpersonationStartResult,
} from './auth-impersonation.service';
import { AuthSessionService } from './auth-session.service';

/**
 * Facade for authentication and authorization operations.
 * Delegates to bounded services for registration, login, tokens, password reset, and sessions.
 */
@Injectable()
export class AuthService {
  private readonly tokenService: AuthTokenService;
  private readonly registrationService: AuthRegistrationService;
  private readonly loginService: AuthLoginService;
  private readonly passwordService: AuthPasswordService;
  private readonly verificationService: AuthVerificationService;
  private readonly impersonationService: AuthImpersonationService;
  private readonly sessionService: AuthSessionService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly notificationService: NotificationService,
    private readonly requestContext: RequestContextService,
    private readonly platformAudit: PlatformAuditService,
    private readonly audit: AuditService,
    private readonly redis: RedisService,
    authTokenService?: AuthTokenService,
    authRegistrationService?: AuthRegistrationService,
    authLoginService?: AuthLoginService,
    authPasswordService?: AuthPasswordService,
    authVerificationService?: AuthVerificationService,
    authImpersonationService?: AuthImpersonationService,
    authSessionService?: AuthSessionService,
  ) {
    this.tokenService =
      authTokenService ??
      new AuthTokenService(this.prisma, this.jwtService, this.configService, this.requestContext);
    this.registrationService =
      authRegistrationService ??
      new AuthRegistrationService(
        this.prisma,
        this.configService,
        this.notificationService,
        this.requestContext,
        this.audit,
      );
    this.loginService =
      authLoginService ??
      new AuthLoginService(this.prisma, this.jwtService, this.configService, this.tokenService);
    this.passwordService =
      authPasswordService ??
      new AuthPasswordService(
        this.prisma,
        this.configService,
        this.notificationService,
        this.audit,
      );
    this.verificationService = authVerificationService ?? new AuthVerificationService(this.prisma);
    this.impersonationService =
      authImpersonationService ??
      new AuthImpersonationService(
        this.prisma,
        this.jwtService,
        this.configService,
        this.platformAudit,
        this.redis,
      );
    this.sessionService = authSessionService ?? new AuthSessionService(this.prisma);
  }

  register(input: {
    businessName: string;
    firstName?: string;
    lastName?: string;
    email: string;
    password: string;
    phone?: string;
    acceptLegal: boolean;
    productSku?: ProductSku;
  }) {
    return this.registrationService.register(input);
  }

  login(email: string, password: string, orgId?: string, options?: { platformAdmin?: boolean }) {
    return this.loginService.login(email, password, orgId, options);
  }

  completeTwoFactorLogin(twoFactorToken: string, code: string) {
    return this.loginService.completeTwoFactorLogin(twoFactorToken, code);
  }

  verifyEmail(token: string) {
    return this.verificationService.verifyEmail(token);
  }

  forgotPassword(email: string) {
    return this.passwordService.forgotPassword(email);
  }

  resetPassword(token: string, newPassword: string) {
    return this.passwordService.resetPassword(token, newPassword);
  }

  refreshTokens(refreshToken: string) {
    return this.tokenService.refreshTokens(refreshToken);
  }

  getSessionProfile(userId: string) {
    return this.sessionService.getSessionProfile(userId);
  }

  startImpersonation(
    actor: { userId: string; email: string },
    targetOrgId: string,
    options?: ImpersonationStartOptions,
  ): Promise<ImpersonationStartResult> {
    return this.impersonationService.startImpersonation(actor, targetOrgId, options);
  }

  endImpersonationAudit(
    actor: { userId: string; email: string },
    actedOrgId: string,
    jti?: string,
  ): Promise<void> {
    return this.impersonationService.endImpersonationAudit(actor, actedOrgId, jti);
  }

  logout(userId: string) {
    return this.sessionService.logout(userId);
  }
}
