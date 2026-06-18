import { Module } from '@nestjs/common';
import { WorkflowService } from './workflow.service';

/** HTTP routes live on FlowTemplateController (queue module). This module only exports WorkflowService for journey advance. */
@Module({
  providers: [WorkflowService],
  exports: [WorkflowService],
})
export class WorkflowModule {}
