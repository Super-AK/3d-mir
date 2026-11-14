import '../css/main.css';
import '../css/admin.css';

/**
 * Admin-Navigation: Auf kleinen Bildschirmen als ausklappbares Menü.
 * Ohne JavaScript bleibt die Navigation geöffnet und ist per CSS sichtbar;
 * der Umschalter erscheint deshalb erst, wenn dieses Skript geladen ist.
 */
document.documentElement.classList.add('js');

const navToggle = document.querySelector<HTMLButtonElement>('[data-admin-nav-toggle]');
const navSidebar = document.querySelector<HTMLElement>('[data-admin-sidebar]');
if (navToggle && navSidebar) {
  const mobile = window.matchMedia('(max-width: 999px)');
  const setOpen = (open: boolean): void => {
    navSidebar.classList.toggle('is-open', open);
    navToggle.setAttribute('aria-expanded', String(open));
  };

  setOpen(!mobile.matches);
  navToggle.addEventListener('click', () => {
    setOpen(!navSidebar.classList.contains('is-open'));
  });
  mobile.addEventListener('change', (event) => setOpen(!event.matches));
  navSidebar.addEventListener('click', (event) => {
    if (mobile.matches && (event.target as HTMLElement).closest('a')) setOpen(false);
  });
}

/**
 * Admin-Bereich: Komfortfunktionen. Alle Formulare funktionieren auch ohne JavaScript.
 * Der Bild-Upload zeigt mit XMLHttpRequest einen echten Übertragungsfortschritt an
 * und fällt bei Fehlern auf die normale Formularübermittlung zurück.
 */
const uploadForm = document.querySelector<HTMLFormElement>('[data-upload-form]');
if (uploadForm) {
  const fileInput = uploadForm.querySelector<HTMLInputElement>('input[type="file"]');
  const progressBox = uploadForm.querySelector<HTMLElement>('[data-upload-progress]');
  const progressBar = uploadForm.querySelector<HTMLProgressElement>('[data-upload-bar]');
  const statusText = uploadForm.querySelector<HTMLElement>('[data-upload-status]');
  const submitButton = uploadForm.querySelector<HTMLButtonElement>('button[type="submit"]');

  const setStatus = (message: string): void => {
    if (statusText) statusText.textContent = message;
  };

  const fail = (message: string): void => {
    setStatus(message);
    if (submitButton) submitButton.disabled = false;
  };

  uploadForm.addEventListener('submit', (event) => {
    if (!fileInput?.files || fileInput.files.length === 0) return;
    if (!window.FormData || !window.XMLHttpRequest) return;

    event.preventDefault();
    if (submitButton?.disabled) return;

    const data = new FormData(uploadForm);
    const request = new XMLHttpRequest();
    request.open('POST', uploadForm.action);
    request.setRequestHeader('Accept', 'application/json');
    request.setRequestHeader('X-Requested-With', 'XMLHttpRequest');

    if (progressBox) progressBox.hidden = false;
    if (progressBar) progressBar.value = 0;
    if (submitButton) submitButton.disabled = true;
    setStatus(`${fileInput.files.length} Bild(er) werden hochgeladen …`);

    request.upload.addEventListener('progress', (uploadEvent) => {
      if (!uploadEvent.lengthComputable) return;
      const percent = Math.round((uploadEvent.loaded / uploadEvent.total) * 100);
      if (progressBar) progressBar.value = percent;
      setStatus(`${percent} % übertragen …`);
    });

    request.addEventListener('load', () => {
      if (progressBar) progressBar.value = 100;
      let payload: { ok?: boolean; redirect?: string; error?: string } = {};
      try {
        payload = JSON.parse(request.responseText) as typeof payload;
      } catch {
        fail('Der Upload ist fehlgeschlagen. Bitte laden Sie die Seite neu und versuchen Sie es erneut.');
        return;
      }
      if (request.status >= 200 && request.status < 300 && payload.ok && payload.redirect) {
        setStatus('Bilder werden verarbeitet …');
        window.location.assign(payload.redirect);
        return;
      }
      fail(payload.error || 'Der Upload ist fehlgeschlagen.');
    });

    request.addEventListener('error', () => {
      fail('Die Verbindung wurde unterbrochen. Bitte erneut versuchen.');
    });

    request.send(data);
  });
}

// Produktliste: „Alle auswählen“ für die Massenlöschung.
const selectAllBoxes = document.querySelectorAll<HTMLInputElement>('[data-select-all]');
const productBoxes = Array.from(document.querySelectorAll<HTMLInputElement>('[data-select-product]'));
if (selectAllBoxes.length > 0 && productBoxes.length > 0) {
  selectAllBoxes.forEach((selectAll) => {
    selectAll.addEventListener('change', () => {
      productBoxes.forEach((box) => {
        box.checked = selectAll.checked;
      });
      selectAllBoxes.forEach((other) => {
        other.checked = selectAll.checked;
      });
    });
  });
  productBoxes.forEach((box) => {
    box.addEventListener('change', () => {
      const allChecked = productBoxes.every((item) => item.checked);
      selectAllBoxes.forEach((selectAll) => {
        selectAll.checked = allChecked;
      });
    });
  });
}

// Preis-Admin: weitere Neu-Zeilen per Add-Button einfügen.
// Ohne JavaScript bleibt die jeweils erste Neu-Zeile (Index 0) nutzbar.
const ADD_ATTRIBUTES = ['name', 'id', 'for', 'data-row-index'] as const;

document.querySelectorAll<HTMLButtonElement>('[data-add-row]').forEach((button) => {
  const group = button.dataset.addRow;
  if (!group) return;
  const template = document.querySelector<HTMLTemplateElement>(`template[data-new-rows="${group}"]`);
  const target = document.querySelector<HTMLElement>(`[data-add-target="${group}"]`);
  if (!template || !target) return;

  button.addEventListener('click', () => {
    const index = Number(target.dataset.nextIndex ?? '1');
    target.dataset.nextIndex = String(index + 1);

    const fragment = template.content.cloneNode(true) as DocumentFragment;
    fragment.querySelectorAll<HTMLElement>('[data-new-row]').forEach((row) => {
      ADD_ATTRIBUTES.forEach((attribute) => {
        const current = row.getAttribute(attribute);
        if (current?.includes('__INDEX__')) {
          row.setAttribute(attribute, current.replaceAll('__INDEX__', String(index)));
        }
      });
      row.querySelectorAll<HTMLElement>('[name], [id], [for]').forEach((field) => {
        ADD_ATTRIBUTES.forEach((attribute) => {
          const current = field.getAttribute(attribute);
          if (current?.includes('__INDEX__')) {
            field.setAttribute(attribute, current.replaceAll('__INDEX__', String(index)));
          }
        });
      });
    });

    target.append(fragment);
    target.querySelector<HTMLInputElement>(`[data-row-index="${index}"] input`)?.focus();
  });
});

// Etsy-Import: Status abfragen, bis der Hintergrundprozess fertig ist.
const etsyImport = document.querySelector<HTMLElement>('[data-etsy-import]');
if (etsyImport) {
  const statusUrl = etsyImport.dataset.statusUrl;
  const log = document.getElementById('etsy-import-log');
  if (statusUrl) {
    const poll = async (): Promise<void> => {
      try {
        const response = await fetch(statusUrl, {
          headers: { accept: 'application/json' },
          cache: 'no-store',
        });
        if (!response.ok) {
          window.setTimeout(poll, 4000);
          return;
        }
        const data = (await response.json()) as { running: boolean; ok: boolean; output: string };
        if (log) log.textContent = data.output;
        if (!data.running) {
          etsyImport.classList.remove('alert-info');
          etsyImport.classList.add(data.ok ? 'alert-success' : 'alert-danger');
          const paragraph = etsyImport.querySelector('p');
          if (paragraph) {
            paragraph.textContent = data.ok ? 'Import abgeschlossen.' : 'Import mit Fehlern beendet.';
          }
          return;
        }
        window.setTimeout(poll, 2000);
      } catch {
        window.setTimeout(poll, 4000);
      }
    };
    window.setTimeout(poll, 800);
  }
}
