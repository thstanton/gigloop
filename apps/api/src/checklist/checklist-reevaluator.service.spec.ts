import { Logger } from '@nestjs/common';
import { ChecklistReevaluator } from './checklist-reevaluator.service';
import { ChecklistEvaluatorService } from './checklist-evaluator.service';

describe('ChecklistReevaluator', () => {
  let evaluate: jest.Mock;
  let resetBandGoal: jest.Mock;
  let reeval: ChecklistReevaluator;

  beforeEach(() => {
    evaluate = jest.fn().mockResolvedValue(undefined);
    resetBandGoal = jest.fn().mockResolvedValue(undefined);
    const evaluator = { evaluate, resetBandGoalForRosterChange: resetBandGoal } as unknown as ChecklistEvaluatorService;
    reeval = new ChecklistReevaluator(evaluator);
  });

  it('delegates to the full-sweep evaluator for the given booking', async () => {
    await reeval.onBookingChanged('booking-1');
    expect(evaluate).toHaveBeenCalledWith('booking-1');
  });

  it('swallows evaluator failures so the caller\'s mutation is never affected', async () => {
    evaluate.mockRejectedValue(new Error('boom'));
    await expect(reeval.onBookingChanged('booking-1')).resolves.toBeUndefined();
  });

  it('logs the swallowed failure with the bookingId (no longer silent)', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    evaluate.mockRejectedValue(new Error('boom'));

    await reeval.onBookingChanged('booking-42');

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('booking-42'),
      expect.anything(),
    );
    warn.mockRestore();
  });

  it('resets band goal facts before evaluating a roster mutation', async () => {
    const events: string[] = [];
    resetBandGoal.mockImplementation(async () => { events.push('reset'); });
    evaluate.mockImplementation(async () => { events.push('evaluate'); });

    await reeval.onBandRosterChanged('user-1', 'booking-1', 'member-1');

    expect(resetBandGoal).toHaveBeenCalledWith('user-1', 'booking-1', 'member-1');
    expect(events).toEqual(['reset', 'evaluate']);
  });
});
