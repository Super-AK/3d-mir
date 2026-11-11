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

// Warenkorb-Anzahl aus dem technisch notwendigen Cookie anzeigen (ohne externen Request).
const cartCount = document.querySelector<HTMLElement>('[data-cart-count]');
if (cartCount) {
  const match = document.cookie.match(/(?:^|;\s*)cart=([^;]*)/);
  if (match?.[1]) {
    try {
      const items = JSON.parse(decodeURIComponent(match[1])) as Record<string, number>;
      const count = Object.values(items).reduce((sum, qty) => sum + Number(qty || 0), 0);
      if (count > 0) {
        cartCount.textContent = String(count);
        cartCount.hidden = false;
      }
    } catch {
      /* ungültiges Cookie ignorieren */
    }
  }
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
