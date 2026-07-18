import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateChecklistDefaultsDto } from './update-checklist-defaults.dto';

async function validateDto(plain: object) {
  return validate(plainToInstance(UpdateChecklistDefaultsDto, plain));
}

// #718: the due-date rule keeps full flexibility (both anchors × both directions) EXCEPT that a
// reminder anchored to booking creation cannot fall before the record exists — bookingCreation is
// after-only. The editor prevents the invalid combination; this proves the write-path backstop.
describe('UpdateChecklistDefaultsDto – bookingCreation after-only guard', () => {
  it('accepts a "before booking date" rule (both directions valid on bookingDate)', async () => {
    const errors = await validateDto({
      systemItemOverrides: [{ key: 'get_deposit_paid', dueDateRule: { basis: 'bookingDate', offsetDays: -30 } }],
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts an "after booking creation" rule', async () => {
    const errors = await validateDto({
      systemItemOverrides: [{ key: 'get_the_quote_accepted', dueDateRule: { basis: 'bookingCreation', offsetDays: 2 } }],
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts a zero-offset booking-creation rule (on creation)', async () => {
    const errors = await validateDto({
      systemItemOverrides: [{ key: 'x', dueDateRule: { basis: 'bookingCreation', offsetDays: 0 } }],
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a "before booking creation" system rule', async () => {
    const errors = await validateDto({
      systemItemOverrides: [{ key: 'x', dueDateRule: { basis: 'bookingCreation', offsetDays: -3 } }],
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a "before booking creation" custom rule', async () => {
    const errors = await validateDto({
      customItems: [
        { label: 'Chase deposit', completedBy: 'USER', dueDateRule: { basis: 'bookingCreation', offsetDays: -1 } },
      ],
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('admits PROVISIONAL as a custom requiredForStatus (the Enquiry bracket)', async () => {
    const errors = await validateDto({
      customItems: [{ label: 'Prep the quote', completedBy: 'USER', requiredForStatus: 'PROVISIONAL' }],
    });
    expect(errors).toHaveLength(0);
  });
});
