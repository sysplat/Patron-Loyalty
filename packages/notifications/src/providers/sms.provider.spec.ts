import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SmsProvider } from './sms.provider';

describe('SmsProvider', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...envBackup };
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it('rejects invalid recipient numbers before calling the provider', async () => {
    process.env.SMS_PROVIDER = 'twilio';
    process.env.TWILIO_ACCOUNT_SID = 'ACtest';
    process.env.TWILIO_AUTH_TOKEN = 'secret';
    process.env.TWILIO_PHONE_NUMBER = '+15551234567';

    const provider = new SmsProvider();
    const result = await provider.send({ to: 'not-a-phone', body: 'hi' });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/E\.164/);
  });

  it('uses console provider without credentials', async () => {
    process.env.SMS_PROVIDER = 'console';
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const provider = new SmsProvider();
    const result = await provider.send({ to: '+14155552671', body: 'Ticket ready' });

    expect(result.success).toBe(true);
    expect(result.providerMessageId).toMatch(/^dev-/);
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('returns not configured when Twilio credentials are missing', async () => {
    process.env.SMS_PROVIDER = 'twilio';
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_API_KEY;
    delete process.env.TWILIO_API_SECRET;
    delete process.env.TWILIO_PHONE_NUMBER;

    const provider = new SmsProvider();
    const result = await provider.send({ to: '+14155552671', body: 'hi' });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not configured/i);
  });

  it('sends via Twilio and returns message sid on success', async () => {
    process.env.SMS_PROVIDER = 'twilio';
    process.env.TWILIO_ACCOUNT_SID = 'ACtest123';
    process.env.TWILIO_AUTH_TOKEN = 'auth-token';
    process.env.TWILIO_PHONE_NUMBER = '+15559876543';

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ sid: 'SM1234567890abcdef' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new SmsProvider();
    const result = await provider.send({
      to: '(415) 555-2671',
      body: 'Your turn',
      statusCallbackUrl: 'https://api.example.com/webhook/twilio-status',
    });

    expect(result).toEqual({ success: true, providerMessageId: 'SM1234567890abcdef' });
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.twilio.com/2010-04-01/Accounts/ACtest123/Messages.json');
    expect(init.method).toBe('POST');

    const authHeader = (init.headers as Record<string, string>).Authorization;
    expect(authHeader).toBe(`Basic ${Buffer.from('ACtest123:auth-token').toString('base64')}`);

    const body = init.body as URLSearchParams;
    expect(body.get('From')).toBe('+15559876543');
    expect(body.get('To')).toBe('+14155552671');
    expect(body.get('Body')).toBe('Your turn');
    expect(body.get('StatusCallback')).toBe('https://api.example.com/webhook/twilio-status');
  });

  it('prefers API key credentials over account auth token', async () => {
    process.env.SMS_PROVIDER = 'twilio';
    process.env.TWILIO_ACCOUNT_SID = 'ACtest123';
    process.env.TWILIO_AUTH_TOKEN = 'auth-token';
    process.env.TWILIO_API_KEY = 'SKtestkey';
    process.env.TWILIO_API_SECRET = 'api-secret';
    process.env.TWILIO_PHONE_NUMBER = '+15559876543';

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ sid: 'SMabc' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new SmsProvider();
    await provider.send({ to: '+14155552671', body: 'hi' });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const authHeader = (init.headers as Record<string, string>).Authorization;
    expect(authHeader).toBe(`Basic ${Buffer.from('SKtestkey:api-secret').toString('base64')}`);
  });

  it('surfaces Twilio trial unverified recipient guidance for error 21608', async () => {
    process.env.SMS_PROVIDER = 'twilio';
    process.env.TWILIO_ACCOUNT_SID = 'ACtest123';
    process.env.TWILIO_AUTH_TOKEN = 'auth-token';
    process.env.TWILIO_PHONE_NUMBER = '+15559876543';

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          code: 21608,
          message: 'The number +16043628826 is unverified.',
        }),
      }),
    );

    const provider = new SmsProvider();
    const result = await provider.send({ to: '+16043628826', body: 'hi' });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Twilio error/i);
    expect(result.error).toMatch(/trial accounts/i);
    expect(result.error).toMatch(/verified recipient/i);
  });
});
