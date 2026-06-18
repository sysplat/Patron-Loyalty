import { Module } from '@nestjs/common';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';
import { CustomerSegmentService } from './customer-segment.service';

@Module({
  controllers: [CustomerController],
  providers: [CustomerService, CustomerSegmentService],
  exports: [CustomerService, CustomerSegmentService],
})
export class CustomerModule {}
