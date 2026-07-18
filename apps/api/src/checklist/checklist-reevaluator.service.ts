import { Injectable, Logger } from '@nestjs/common';
import { ChecklistEvaluatorService } from './checklist-evaluator.service';

/**
 * The single seam a mutating service calls after a business event changes a
 * booking, to re-derive that booking's checklist Goals (ADR-0062). Callers
 * announce *what happened* — "this booking changed" — they do not drive the
 * derivation or own the error policy.
 *
 * The checklist is a *derived view* of the booking: its re-derivation failing
 * must never fail the caller's primary mutation, so this method swallows. It
 * logs the swallowed error with the `bookingId` (previously the 23 hand-rolled
 * `.catch(() => {})` sites swallowed *silently*), so a failure is diagnosable.
 *
 * Today it wraps the full-sweep {@link ChecklistEvaluatorService.evaluate}. It
 * is also the correct future home for targeted containment (the dormant
 * inverted-index path) and for a `@OnEvent('booking.changed')` listener once a
 * second consumer — e.g. band-member support — justifies an event bus; the call
 * sites do not change when that arrives.
 */
@Injectable()
export class ChecklistReevaluator {
  private readonly logger = new Logger(ChecklistReevaluator.name);

  constructor(private readonly evaluator: ChecklistEvaluatorService) {}

  async onBookingChanged(bookingId: string): Promise<void> {
    try {
      await this.evaluator.evaluate(bookingId);
    } catch (err) {
      this.logger.warn(
        `Checklist re-evaluation failed for booking ${bookingId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
