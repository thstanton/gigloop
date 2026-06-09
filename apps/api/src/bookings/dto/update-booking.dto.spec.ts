import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateBookingDto } from './update-booking.dto';

async function validateDto(plain: object) {
  const instance = plainToInstance(UpdateBookingDto, plain);
  return validate(instance);
}

describe('UpdateBookingDto – logistics', () => {
  it('accepts a valid logistics object', async () => {
    const errors = await validateDto({
      logistics: {
        arrivalTime: { value: '14:00', shareWithBand: true, shareWithClient: false },
      },
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts an empty logistics object', async () => {
    const errors = await validateDto({ logistics: {} });
    expect(errors).toHaveLength(0);
  });

  it('accepts when logistics is absent', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('rejects when logistics is a string (400)', async () => {
    const errors = await validateDto({ logistics: 'not-an-object' });
    expect(errors.some((e) => e.property === 'logistics')).toBe(true);
  });

  it('rejects when logistics is an array (400)', async () => {
    const errors = await validateDto({ logistics: [{ value: '14:00' }] });
    expect(errors.some((e) => e.property === 'logistics')).toBe(true);
  });
});
