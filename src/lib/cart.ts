import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config.js';

/**
 * Warenkorb im signierten Cookie.
 *
 * Es werden nur Varianten-IDs und Mengen gespeichert – niemals Preise. Preise
 * und Verfügbarkeit werden bei jeder Anzeige und bei der Bestellung erneut aus
 * der Datenbank gelesen.
 */
export type CartItem = { variantId: number; quantity: number };
export type Cart = { items: CartItem[] };

export const CART_COOKIE = 'warenkorb';
const MAX_ITEMS = 50;

function clampQuantity(value: unknown): number {
  const quantity = Math.trunc(Number(value));
  if (!Number.isFinite(quantity)) return 1;
  return Math.min(config.shop.maxQuantityPerItem, Math.max(1, quantity));
}

function normalise(value: unknown): Cart {
  if (!value || typeof value !== 'object') return { items: [] };
  const rawItems = (value as { items?: unknown }).items;
  if (!Array.isArray(rawItems)) return { items: [] };

  const merged = new Map<number, number>();
  for (const raw of rawItems.slice(0, MAX_ITEMS)) {
    if (!raw || typeof raw !== 'object') continue;
    const variantId = Math.trunc(Number((raw as { variantId?: unknown }).variantId));
    if (!Number.isFinite(variantId) || variantId <= 0) continue;
    const quantity = clampQuantity((raw as { quantity?: unknown }).quantity);
    merged.set(variantId, Math.min(config.shop.maxQuantityPerItem, (merged.get(variantId) ?? 0) + quantity));
  }

  return { items: [...merged].map(([variantId, quantity]) => ({ variantId, quantity })) };
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
