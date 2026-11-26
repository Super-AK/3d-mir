type TurnstileOptions = {
  sitekey: string;
  size?: string;
  appearance?: string;
  callback: (token: string) => void;
  'expired-callback'?: () => void;
  'error-callback'?: () => void;
};

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileOptions) => string;
  reset: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
    onTurnstileLoad?: () => void;
  }
}

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

function renderWidgets(): void {
  if (!window.turnstile) return;
  document.querySelectorAll<HTMLElement>('.cf-turnstile').forEach((widget) => {
    const form = widget.closest('form');
    if (!form || widget.dataset.rendered === 'true') return;
    const input = form.querySelector<HTMLInputElement>('input[name="cf-turnstile-response"]');
    const buttons = Array.from(form.querySelectorAll<HTMLButtonElement>('button[type="submit"]'));
    const key = widget.dataset.sitekey ?? '';
    if (!key || !input) return;

    buttons.forEach((button) => {
      button.disabled = true;
    });

    const reset = (widgetId: string): void => {
      input.value = '';
      window.turnstile?.reset(widgetId);
      buttons.forEach((button) => {
        button.disabled = true;
      });
    };

    const widgetId = window.turnstile.render(widget, {
      sitekey: key,
      size: 'invisible',
      appearance: 'interaction-only',
      callback: (token) => {
        input.value = token;
        buttons.forEach((button) => {
          button.disabled = false;
        });
      },
      'expired-callback': () => reset(widgetId),
      'error-callback': () => reset(widgetId),
    });
    widget.dataset.rendered = 'true';

    form.addEventListener('submit', () => {
      // Nach abgeschlossenem Versand zurücksetzen (z. B. bei AJAX-Formularen).
      window.setTimeout(() => reset(widgetId), 2000);
    });
  });
}

export function initTurnstile(): void {
  const widgets = document.querySelectorAll<HTMLElement>('.cf-turnstile');
  if (widgets.length === 0) return;
  if (window.turnstile) {
    renderWidgets();
    return;
  }
  window.onTurnstileLoad = renderWidgets;
  if (document.querySelector('script[data-turnstile]')) return;
  const script = document.createElement('script');
  script.src = SCRIPT_URL;
  script.async = true;
  script.defer = true;
  script.dataset.turnstile = 'true';
  document.head.appendChild(script);
}

initTurnstile();
