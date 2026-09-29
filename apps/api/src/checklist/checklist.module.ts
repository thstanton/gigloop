import { Module } from '@nestjs/common';
import { ChecklistEvaluatorService } from './checklist-evaluator.service';
import { ChecklistReevaluator } from './checklist-reevaluator.service';
import { ChecklistRepository } from './checklist.repository';
import { ChecklistSoloController } from './checklist-solo.controller';
import { ChecklistSoloService } from './checklist-solo.service';

@Module({
  controllers: [ChecklistSoloController],
  providers: [ChecklistEvaluatorService, ChecklistReevaluator, ChecklistRepository, ChecklistSoloService],
  exports: [ChecklistEvaluatorService, ChecklistReevaluator, ChecklistRepository],
})
export class ChecklistModule {}
