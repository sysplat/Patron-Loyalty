import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DisplayController } from './display.controller';
import { DisplayService } from './display.service';
import { DisplayAuthGuard } from '../../common/guards/display-auth.guard';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    BillingModule,
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
  ],
  controllers: [DisplayController],
  providers: [DisplayService, DisplayAuthGuard],
  exports: [DisplayService, DisplayAuthGuard, JwtModule],
})
export class DisplayModule {}
