import { config } from '../config.js';
import { getDb } from '../db/index.js';
import { notifyAdmin } from './notifications.js';

export class CustomerNumberExhaustedError extends Error {
  constructor() {
    super('Der Kundennummernbereich ist erschöpft.');
    this.name = 'CustomerNumberExhaustedError';
  }
}

type CustomerNumberConfig = {
  prefix: string;
  digits: number;
  rangeStart: number;
  rangeEnd: number;
  warningPercent: number;
};

export function customerNumberConfig(): CustomerNumberConfig {
  const value = config.site.customerNumber;
  const prefix = typeof value?.prefix === 'string' && /^[A-Z]+$/.test(value.prefix) ? value.prefix : 'KD';
  const digits = Number.isInteger(value?.digits) && value.digits >= 4 && value.digits <= 10 ? value.digits : 6;
  const rangeStart = Number.isInteger(value?.rangeStart) ? value.rangeStart : 900001;
  const rangeEnd = Number.isInteger(value?.rangeEnd) ? value.rangeEnd : 999999;
  const warningPercent =
    Number.isInteger(value?.warningPercent) && value.warningPercent > 0 && value.warningPercent <= 100
      ? value.warningPercent
      : 90;
  return { prefix, digits, rangeStart, rangeEnd, warningPercent };
}

export function formatCustomerNumber(value: number): string {
  const { prefix, digits } = customerNumberConfig();
  return `${prefix}${String(value).padStart(digits, '0')}`;
}

export function isValidCustomerNumber(value: string): boolean {
  const { prefix, digits } = customerNumberConfig();
  return new RegExp(`^${prefix}\\d{${digits}}$`).test(value);
}

function usagePercent(): number {
  const { rangeStart, rangeEnd } = customerNumberConfig();
  const row = getDb().prepare('SELECT last_value FROM customer_number_counter WHERE id = 1').get() as
    | { last_value: number }
    | undefined;
  const last = row?.last_value ?? rangeStart - 1;
  const total = Math.max(1, rangeEnd - rangeStart + 1);
  return Math.round(((last - rangeStart + 1) / total) * 100);
}

/** Vergibt die nächste Nummer atomar; nie zweimal, auch nicht nach Anonymisierung. */
export function assignCustomerNumber(): string {
  const { rangeEnd, warningPercent } = customerNumberConfig();
  const run = getDb().transaction(() => {
    const row = getDb().prepare('SELECT last_value FROM customer_number_counter WHERE id = 1').get() as
      | { last_value: number }
      | undefined;
    const next = (row?.last_value ?? rangeEnd) + 1;
    if (next > rangeEnd) throw new CustomerNumberExhaustedError();
    getDb().prepare('UPDATE customer_number_counter SET last_value = ? WHERE id = 1').run(next);
    return formatCustomerNumber(next);
  });
  const number = run.immediate();
  if (usagePercent() >= warningPercent) {
    void notifyAdmin({
      subject: 'Kundennummernkreis fast voll',
      event: 'monitoring',
      text: `${usagePercent()} % des Kundennummernbereichs sind vergeben. Bitte Bereich prüfen.`,
    }).catch(() => {
      // Warnung darf die Bestellung nicht blockieren.
    });
  }
  return number;
}

/** Nur Anzeige für /meta und Admin – der Zähler ist nicht editierbar. */
export function customerNumberStats(): Record<string, unknown> {
  const { prefix, digits, rangeStart, rangeEnd, warningPercent } = customerNumberConfig();
  const row = getDb().prepare('SELECT last_value FROM customer_number_counter WHERE id = 1').get() as
    | { last_value: number }
    | undefined;
  const last = row?.last_value ?? rangeStart - 1;
  return {
    pattern: `^${prefix}\\d{${digits}}$`,
    range_start: formatCustomerNumber(rangeStart),
    range_end: formatCustomerNumber(rangeEnd),
    last_assigned: last >= rangeStart ? formatCustomerNumber(last) : null,
    warning_percent: warningPercent,
    usage_percent: usagePercent(),
  };
}
