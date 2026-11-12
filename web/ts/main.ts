import '../css/main.css';
/**
 * Allgemeine Frontend-Interaktionen.
 * Die Seite funktioniert auch ohne JavaScript; hier werden nur Komfortfunktionen ergänzt.
 */

const header = document.querySelector<HTMLElement>('[data-header]');
const navToggle = document.querySelector<HTMLButtonElement>('[data-nav-toggle]');
const nav = document.querySelector<HTMLElement>('[data-nav]');

function closeNav(): void {
  if (!nav || !navToggle) return;
  nav.classList.remove('is-open');
  navToggle.setAttribute('aria-expanded', 'false');
}

navToggle?.addEventListener('click', () => {
  if (!nav) return;
  const open = nav.classList.toggle('is-open');
  navToggle.setAttribute('aria-expanded', String(open));
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeNav();
});

document.addEventListener('click', (event) => {
  if (!nav?.classList.contains('is-open')) return;
  const target = event.target as Node;
  if (!nav.contains(target) && !navToggle?.contains(target)) closeNav();
});

window.addEventListener(
  'scroll',
  () => {
    header?.classList.toggle('is-scrolled', window.scrollY > 8);
  },
  { passive: true },
);

// Versandkosten und Gesamtsumme an der Kasse aktualisieren.
const checkout = document.querySelector<HTMLFormElement>('[data-checkout]');
if (checkout) {
  const shipping = document.querySelector<HTMLElement>('[data-summary-shipping]');
  const total = document.querySelector<HTMLElement>('[data-summary-total]');
  const subtotal = Number(document.querySelector<HTMLElement>('[data-summary-subtotal]')?.dataset.summarySubtotal ?? 0);
  const formatter = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

  const updateTotals = (): void => {
    const selected = checkout.querySelector<HTMLInputElement>('input[name="shippingMethod"]:checked');
    const cents = Number(selected?.dataset.shippingCents ?? 0);
    if (shipping) {
      shipping.textContent = formatter.format(cents / 100);
      shipping.dataset.summaryShipping = String(cents);
    }
    if (total) {
      total.textContent = formatter.format((subtotal + cents) / 100);
      total.dataset.summaryTotal = String(subtotal + cents);
    }
  };

  checkout.querySelectorAll<HTMLInputElement>('input[name="shippingMethod"]').forEach((input) => {
    input.addEventListener('change', updateTotals);
  });
  updateTotals();
}

// Sanftes Einblenden, respektiert reduzierte Bewegung.
if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      }
    },
    { rootMargin: '0px 0px -8% 0px' },
  );
  document.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => observer.observe(el));
}
