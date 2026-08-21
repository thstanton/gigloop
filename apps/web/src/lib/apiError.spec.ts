import { describe, it, expect } from 'vitest';
import { ApiError, toApiError } from './apiError';

function jsonResponse(status: number, statusText: string, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, statusText });
}

describe('ApiError', () => {
  it('is a real Error with a readable .message', () => {
    const err = new ApiError(409, 'Booking has non-VOID invoices');
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('Booking has non-VOID invoices');
    expect(err.status).toBe(409);
  });
});

describe('toApiError', () => {
  it('uses the JSON body message when present', async () => {
    const err = await toApiError(jsonResponse(409, 'Conflict', { message: 'Publish the music form first' }));
    expect(err.status).toBe(409);
    expect(err.message).toBe('Publish the music form first');
    expect(err.body).toEqual({ message: 'Publish the music form first' });
  });

  it('joins a class-validator array message into a single string', async () => {
    const err = await toApiError(
      jsonResponse(400, 'Bad Request', { message: ['email must be an email', 'name should not be empty'] }),
    );
    expect(err.message).toBe('email must be an email, name should not be empty');
  });

  it('falls back to statusText when the body has no message field', async () => {
    const err = await toApiError(jsonResponse(500, 'Internal Server Error', { statusCode: 500 }));
    expect(err.message).toBe('Internal Server Error');
  });

  it('falls back to statusText when the body is not JSON', async () => {
    const res = new Response('<html>Bad Gateway</html>', { status: 502, statusText: 'Bad Gateway' });
    const err = await toApiError(res);
    expect(err.status).toBe(502);
    expect(err.message).toBe('Bad Gateway');
    expect(err.body).toBeNull();
  });

  it('falls back to a status-derived message when statusText is empty (HTTP/2 drops it)', async () => {
    const res = new Response('<html>Bad Gateway</html>', { status: 502, statusText: '' });
    const err = await toApiError(res);
    expect(err.message).toBe('Request failed (502)');
  });

  it('falls back to statusText when the message array is empty', async () => {
    const err = await toApiError(jsonResponse(400, 'Bad Request', { message: [] }));
    expect(err.message).toBe('Bad Request');
  });
});
