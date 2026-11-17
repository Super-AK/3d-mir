import crypto from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config.js';

/**
 * Warenkorb im signierten Cookie.
 *
 * Gespeichert werden nur Produkt-/Varianten-IDs, Farbe, Personalisierung und
 * Menge – niemals Preise. Preise und Verfügbarkeit werden bei jeder Anzeige
 * und bei der Bestellung erneut aus der Datenbank gelesen.
 *
 * Produkte ohne Varianten haben variantId = null. Farbe und Personalisierung
 * sind optional und werden serverseitig gegen das Produkt geprüft.
 */
export type CartItem = {
  productId: number;
  variantId: number | null;
  color: string;
  personalization: string;
  quantity: number;
};
export type Cart = { items: CartItem[] };

export const CART_COOKIE = 'warenkorb';
const MAX_ITEMS = 50;
const MAX_COLOR_LENGTH = 60;
const MAX_PERSONALIZATION_LENGTH = 500;

function clampQuantity(value: unknown): number {
  const quantity = Math.trunc(Number(value));
  if (!Number.isFinite(quantity)) return 1;
  return Math.min(config.shop.maxQuantityPerItem, Math.max(1, quantity));
}

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

/** Stabile Zeilenkennung für Aktualisieren und Entfernen. */
export function cartLineKey(item: Pick<CartItem, 'productId' | 'variantId' | 'color' | 'personalization'>): string {
  return crypto
    .createHash('sha256')
    .update(`${item.productId}\u0000${item.variantId ?? ''}\u0000${item.color}\u0000${item.personalization}`)
    .digest('hex')
    .slice(0, 16);
}

function normaliseItem(raw: unknown): CartItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  const productId = Math.trunc(Number(source.productId));
  if (!Number.isFinite(productId) || productId <= 0) return null;
  const variantId = source.variantId == null || source.variantId === '' ? null : Math.trunc(Number(source.variantId));
  const validVariant = variantId !== null && Number.isFinite(variantId) && variantId > 0 ? variantId : null;
  return {
    productId,
    variantId: validVariant,
    color: cleanText(source.color, MAX_COLOR_LENGTH),
    personalization: cleanText(source.personalization, MAX_PERSONALIZATION_LENGTH),
    quantity: clampQuantity(source.quantity),
  };
}

function normalise(value: unknown): Cart {
  if (!value || typeof value !== 'object') return { items: [] };
  const rawItems = (value as { items?: unknown }).items;
  if (!Array.isArray(rawItems)) return { items: [] };

  const merged = new Map<string, CartItem>();
  for (const raw of rawItems.slice(0, MAX_ITEMS)) {
    const item = normaliseItem(raw);
    if (!item) continue;
    const key = cartLineKey(item);
    const existing = merged.get(key);
    if (existing) {
      existing.quantity = Math.min(config.shop.maxQuantityPerItem, existing.quantity + item.quantity);
    } else {
      merged.set(key, item);
    }
  }

  return { items: [...merged.values()] };
}

/** Liest den Warenkorb aus dem signierten Cookie. Ungültige Cookies ergeben einen leeren Warenkorb. */
export function readCart(request: FastifyRequest): Cart {
  const raw = request.cookies?.[CART_COOKIE];
  if (!raw) return { items: [] };
  try {
    const unsigned = request.unsignCookie(raw);
    if (!unsigned.valid || !unsigned.value) return { items: [] };
    return normalise(JSON.parse(unsigned.value));
  } catch {
    return { items: [] };
  }
}

/** Schreibt den Warenkorb als signiertes, httpOnly-Cookie. */
export function writeCart(reply: FastifyReply, cart: Cart, secure: boolean): void {
  const value = JSON.stringify(normalise(cart));
  reply.setCookie(CART_COOKIE, value, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure,
    signed: true,
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearCart(reply: FastifyReply): void {
  reply.clearCookie(CART_COOKIE, { path: '/' });
}

export function cartCount(cart: Cart): number {
  return cart.items.reduce((sum, item) => sum + item.quantity, 0);
}
