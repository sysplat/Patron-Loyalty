import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { AuthUserCacheService } from './auth-user-cache.service';
import { RedisModule } from '../../redis/redis.module';
import { NotificationModule } from '../notification/notification.module';
import { TwoFactorService } from './two-factor.service';
import { AuthTokenService } from './auth-token.service';
import { AuthRegistrationService } from './auth-registration.service';
import { AuthLoginService } from './auth-login.service';
import { AuthPasswordService } from './auth-password.service';
import { AuthVerificationService } from './auth-verification.service';
import { AuthImpersonationService } from './auth-impersonation.service';
import { AuthSessionService } from './auth-session.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('app.jwt.secret'),
        signOptions: {
          expiresIn: `${config.get<number>('app.jwt.accessTtl') || 900}s`,
        },
      }),
      inject: [ConfigService],
    }),
    RedisModule,
    NotificationModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthTokenService,
    AuthRegistrationService,
    AuthLoginService,
    AuthPasswordService,
    AuthVerificationService,
    AuthImpersonationService,
    AuthSessionService,
    AuthService,
    JwtStrategy,
    AuthUserCacheService,
    TwoFactorService,
  ],
  exports: [
    AuthTokenService,
    AuthRegistrationService,
    AuthLoginService,
    AuthPasswordService,
    AuthVerificationService,
    AuthImpersonationService,
    AuthSessionService,
    AuthService,
    AuthUserCacheService,
    TwoFactorService,
  ],
})
export class AuthModule {}
