import { canRespondToBandInvite } from './band-member-status';

describe('canRespondToBandInvite', () => {
  it('allows a response from ADDED', () => {
    expect(canRespondToBandInvite('ADDED')).toBe(true);
  });

  it('allows a response from INVITED', () => {
    expect(canRespondToBandInvite('INVITED')).toBe(true);
  });

  it('rejects a second response once CONFIRMED', () => {
    expect(canRespondToBandInvite('CONFIRMED')).toBe(false);
  });

  it('rejects a second response once DECLINED', () => {
    expect(canRespondToBandInvite('DECLINED')).toBe(false);
  });
});
