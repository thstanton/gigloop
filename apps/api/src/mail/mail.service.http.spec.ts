/**
 * Feedback loop for the "email arrives, no attachment" bug.
 *
 * The existing mail.service.spec.ts mocks the entire `resend` module, so it
 * only checks what we pass to resend.emails.send() — it never exercises the
 * SDK's parseEmailToApiOptions → JSON.stringify path.
 *
 * This spec lets the REAL Resend SDK run and intercepts the outgoing fetch
 * call to capture the exact HTTP body sent to api.resend.com. If the
 * attachment reaches the wire in the wrong shape, this test will catch it.
 */

import { MailService } from './mail.service';
import { PrismaService } from '../prisma/prisma.service';

// Do NOT mock 'resend' here — we need the real SDK to run.

const mockPrisma = {} as unknown as PrismaService;

describe('MailService — wire-level attachment encoding', () => {
  let service: MailService;
  let fetchSpy: jest.SpyInstance;
  let capturedBody: unknown;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 'test-key';
    process.env.RESEND_FROM = 'test@example.com';

    service = new MailService(mockPrisma);

    // Intercept fetch so nothing reaches api.resend.com
    fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (_url, init) => {
      capturedBody = JSON.parse((init?.body as string) ?? '{}');
      return new Response(JSON.stringify({ id: 'test-email-id' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    capturedBody = undefined;
  });

  it('throws when Resend returns an error response', async () => {
    fetchSpy.mockImplementationOnce(async () =>
      new Response(JSON.stringify({ name: 'invalid_attachment', message: 'Bad attachment' }), {
        status: 422,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(
      service.send({ to: 'c@example.com', subject: 'Test', body: '<p>Hi</p>' }),
    ).rejects.toThrow('Resend rejected the email: invalid_attachment');
  });

  it('serialises attachment content as a plain base64 string in the HTTP body', async () => {
    const pdfBuffer = Buffer.from('%PDF-test-content');

    await service.send({
      to: 'client@example.com',
      subject: 'Your invoice',
      body: '<p>Please find attached</p>',
      attachments: [{ filename: 'INV-001.pdf', content: pdfBuffer }],
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const body = capturedBody as Record<string, unknown>;
    const attachments = body['attachments'] as Array<Record<string, unknown>>;

    expect(Array.isArray(attachments)).toBe(true);
    expect(attachments).toHaveLength(1);
    expect(attachments[0]['filename']).toBe('INV-001.pdf');

    // content must be a plain string (base64), not a Buffer-shaped object
    const content = attachments[0]['content'];
    expect(typeof content).toBe('string');
    expect(content).toBe(pdfBuffer.toString('base64'));

    // Decoded content must recover the original bytes
    expect(Buffer.from(content as string, 'base64').toString()).toBe('%PDF-test-content');
  });
});
