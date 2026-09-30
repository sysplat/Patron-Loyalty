import { Module, forwardRef } from '@nestjs/common';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';
import { CustomerSegmentService } from './customer-segment.service';
import { CustomerImportService } from './customer-import.service';

@Module({
  imports: [forwardRef(() => LoyaltyModule)],
  controllers: [CustomerController],
  providers: [CustomerService, CustomerSegmentService, CustomerImportService],
  exports: [CustomerService, CustomerSegmentService],
})
export class CustomerModule {}
