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

// Produktgalerie: Miniaturen wechseln das große Bild, Klick öffnet die Vergrößerung.
const gallery = document.querySelector<HTMLElement>('[data-gallery]');
if (gallery) {
  const slides = Array.from(gallery.querySelectorAll<HTMLElement>('[data-gallery-slide]'));
  const thumbs = Array.from(gallery.querySelectorAll<HTMLAnchorElement>('[data-gallery-thumb]'));
  const dialog = document.querySelector<HTMLDialogElement>('[data-gallery-dialog]');
  const dialogImage = dialog?.querySelector<HTMLImageElement>('[data-gallery-dialog-image]');
  const dialogCounter = dialog?.querySelector<HTMLElement>('[data-gallery-counter]');
  const links = slides.map((slide) => slide.querySelector<HTMLAnchorElement>('[data-gallery-open]'));
  let active = 0;
  let dialogIndex = 0;

  const show = (index: number): void => {
    if (index < 0 || index >= slides.length) return;
    active = index;
    slides.forEach((slide, position) => slide.classList.toggle('is-active', position === index));
    thumbs.forEach((thumb, position) => {
      const selected = position === index;
      thumb.classList.toggle('is-active', selected);
      if (selected) thumb.setAttribute('aria-current', 'true');
      else thumb.removeAttribute('aria-current');
    });
  };

  const renderDialog = (index: number): void => {
    const link = links[index];
    if (!link || !dialogImage) return;
    dialogIndex = index;
    dialogImage.src = link.href;
    dialogImage.alt = link.querySelector('img')?.alt ?? '';
    if (dialogCounter) dialogCounter.textContent = `${index + 1} / ${slides.length}`;
  };

  const openDialog = (index: number): void => {
    if (!dialog || !dialogImage || dialog.open) return;
    renderDialog(index);
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>('[data-gallery-close]')?.focus();
  };

  const step = (direction: number): void => {
    if (slides.length < 2) return;
    const next = (dialogIndex + direction + slides.length) % slides.length;
    show(next);
    renderDialog(next);
  };

  thumbs.forEach((thumb, index) => {
    thumb.addEventListener('click', (event) => {
      event.preventDefault();
      show(index);
    });
  });

  links.forEach((link, index) => {
    link?.addEventListener('click', (event) => {
      if (!dialog || !dialogImage) return;
      event.preventDefault();
      openDialog(index);
    });
  });

  gallery.addEventListener('keydown', (event) => {
    if (thumbs.length < 2) return;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      const next = (active + 1) % slides.length;
      show(next);
      thumbs[next]?.focus();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      const previous = (active - 1 + slides.length) % slides.length;
      show(previous);
      thumbs[previous]?.focus();
    }
  });

  dialog?.querySelector<HTMLButtonElement>('[data-gallery-prev]')?.addEventListener('click', () => step(-1));
  dialog?.querySelector<HTMLButtonElement>('[data-gallery-next]')?.addEventListener('click', () => step(1));
  dialog?.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      step(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      step(1);
    }
  });
  dialog?.querySelector<HTMLButtonElement>('[data-gallery-close]')?.addEventListener('click', () => dialog.close());
  dialog?.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
}
