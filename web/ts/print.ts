import '../css/main.css';
import '../css/print.css';

/** Druckansichten: Knopf ruft den Browser-Druckdialog auf. Ohne JS bleibt Strg+P. */
document.querySelector<HTMLButtonElement>('[data-print-button]')?.addEventListener('click', () => {
  window.print();
});
