import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendTelegramMessage } from '../../src/lib/telegram.js';
import {
  defaultNotificationEvents,
  isNotificationEnabled,
  type NotificationSettings,
} from '../../src/lib/notification-settings.js';

const settings = { botToken: '123456789:AAH_test-token_123', chatId: '987654321' };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Telegram-Benachrichtigungen', () => {
  it('sendet eine Nachricht über die Bot-API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(sendTelegramMessage('Testnachricht', settings)).resolves.toEqual({ delivered: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.telegram.org/bot${settings.botToken}/sendMessage`);
    const body = JSON.parse(String(init.body)) as { chat_id: string; text: string };
    expect(body.chat_id).toBe(settings.chatId);
    expect(body.text).toBe('Testnachricht');
  });

  it('meldet Fehler der Telegram-API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: false, description: 'Bad Request: chat not found' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    await expect(sendTelegramMessage('Test', settings)).rejects.toThrow('chat not found');
  });

  it('verlangt Token und Chat-ID', async () => {
    await expect(sendTelegramMessage('Test', { botToken: '', chatId: '' })).rejects.toThrow(
      'nicht konfiguriert',
    );
  });

  it('lehnt einen offensichtlich falschen Token ab', async () => {
    await expect(sendTelegramMessage('Test', { botToken: '../falsch', chatId: '1' })).rejects.toThrow(
      'ungültiges Format',
    );
  });
});

describe('Benachrichtigungen pro Ereignis', () => {
  const base: NotificationSettings = {
    channel: 'mail',
    copyCustomerMails: false,
    events: { ...defaultNotificationEvents, contact_review: false },
    smtp: { host: '', port: 587, secure: false, user: '', pass: '', from: '', to: '' },
    telegram: { botToken: '', chatId: '' },
  };

  it('respektiert ausgeschaltete Ereignisse', () => {
    expect(isNotificationEnabled('contact_review', base)).toBe(false);
    expect(isNotificationEnabled('order_new', base)).toBe(true);
  });

  it('schaltet standardmäßig alle Ereignisse ein', () => {
    for (const enabled of Object.values(defaultNotificationEvents)) {
      expect(enabled).toBe(true);
    }
  });
});
