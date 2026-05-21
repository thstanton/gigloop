import { encrypt, decrypt } from './crypto';

const VALID_KEY = 'a'.repeat(64);

describe('encrypt / decrypt', () => {
  beforeAll(() => {
    process.env.ENCRYPTION_KEY = VALID_KEY;
  });

  it('round-trips plaintext', () => {
    const plaintext = 'sort: 12-34-56, acc: 12345678';
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it('produces a different ciphertext on each call (random IV)', () => {
    const p = 'same input';
    expect(encrypt(p)).not.toBe(encrypt(p));
  });

  it('throws on tampered ciphertext (auth tag mismatch)', () => {
    const encrypted = encrypt('secret');
    const [iv, ct, tag] = encrypted.split(':');
    expect(() => decrypt(`${iv}:${ct}ff:${tag}`)).toThrow();
  });

  it('throws when ENCRYPTION_KEY is not set', () => {
    const saved = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
    expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY');
    process.env.ENCRYPTION_KEY = saved;
  });

  it('throws when ENCRYPTION_KEY is wrong length', () => {
    const saved = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = 'tooshort';
    expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY');
    process.env.ENCRYPTION_KEY = saved;
  });
});
