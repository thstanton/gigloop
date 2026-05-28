import { Module } from '@nestjs/common';
import { ChecklistEvaluatorService } from './checklist-evaluator.service';
import { ChecklistRepository } from './checklist.repository';

@Module({
  providers: [ChecklistEvaluatorService, ChecklistRepository],
  exports: [ChecklistEvaluatorService],
})
export class ChecklistModule {}
