import { Module } from '@nestjs/common';
import { ChecklistEvaluatorService } from './checklist-evaluator.service';
import { ChecklistReevaluator } from './checklist-reevaluator.service';
import { ChecklistRepository } from './checklist.repository';

@Module({
  providers: [ChecklistEvaluatorService, ChecklistReevaluator, ChecklistRepository],
  exports: [ChecklistEvaluatorService, ChecklistReevaluator, ChecklistRepository],
})
export class ChecklistModule {}
