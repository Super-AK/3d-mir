import '../css/main.css';
import '../css/admin.css';
import './admin-images';
import './admin-passkeys';

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
 * Produktvarianten: mehrere neue Zeilen nacheinander erfassen und erst gemeinsam
 * speichern. Die erste Zeile (`new_*`) bleibt auch ohne JavaScript nutzbar.
 */
const variantForm = document.querySelector<HTMLFormElement>('[data-variant-form]');
if (variantForm) {
  const tbody = variantForm.querySelector<HTMLTableSectionElement>('tbody');
  const template = variantForm.querySelector<HTMLTemplateElement>('[data-variant-template]');
  const addButton = variantForm.querySelector<HTMLButtonElement>('[data-add-variant]');
  let nextIndex = 1;

  addButton?.addEventListener('click', () => {
    if (!tbody || !template) return;
    const fragment = template.content.cloneNode(true) as DocumentFragment;
    const row = fragment.querySelector('tr');
    if (!row) return;
    row.querySelectorAll<HTMLInputElement>('input[name]').forEach((input) => {
      input.name = input.name.replace('_1', `_${nextIndex}`);
    });
    nextIndex += 1;
    tbody.appendChild(fragment);
    row.querySelector<HTMLInputElement>('input[type="text"]')?.focus();
  });

  variantForm.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-remove-variant]');
    if (!button) return;
    button.closest('tr')?.remove();
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

// Produktliste: „Alle auswählen“ für die Massenlöschung. Die Liste wird bei der
// Live-Suche ausgetauscht, deshalb wird die Auswahl danach neu gebunden.
function initProductSelection(): void {
  const selectAllBoxes = Array.from(document.querySelectorAll<HTMLInputElement>('[data-select-all]'));
  const productBoxes = Array.from(document.querySelectorAll<HTMLInputElement>('[data-select-product]'));
  if (selectAllBoxes.length === 0 || productBoxes.length === 0) return;

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
initProductSelection();
document.addEventListener('admin:filter-updated', initProductSelection);

/**
 * Produktliste: Sortierung per Drag & Drop. Die Pfeile in jeder Zeile
 * funktionieren auch ohne JavaScript; hier wird nur das Ziehen ergänzt.
 */
function initProductSorting(): void {
  const table = document.querySelector<HTMLTableElement>('[data-product-order-table]');
  const tbody = table?.querySelector<HTMLTableSectionElement>('tbody');
  const csrf = table?.dataset.csrf;
  if (!tbody || !csrf || tbody.dataset.sortingBound === '1') return;
  tbody.dataset.sortingBound = '1';

  let dragged: HTMLTableRowElement | null = null;
  const rows = (): HTMLTableRowElement[] =>
    Array.from(tbody.querySelectorAll<HTMLTableRowElement>('tr[data-product-id]'));
  const clearMarks = (): void => {
    rows().forEach((row) => row.classList.remove('is-dragging', 'is-dragover'));
  };

  const save = (): void => {
    const ids = rows()
      .map((row) => row.dataset.productId)
      .filter((id): id is string => Boolean(id));
    if (ids.length < 2) return;

    const form = document.createElement('form');
    form.method = 'post';
    form.action = '/admin/produkte/sortierung/';
    const hidden = (name: string, value: string): void => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      form.append(input);
    };
    hidden('_csrf', csrf);
    ids.forEach((id) => hidden('ids', id));
    document.body.append(form);
    form.submit();
  };

  tbody.addEventListener('dragstart', (event) => {
    const target = event.target as HTMLElement;
    if (target.closest('button, input, a, form')) {
      event.preventDefault();
      return;
    }
    const row = target.closest<HTMLTableRowElement>('tr[data-product-id]');
    if (!row) return;
    dragged = row;
    row.classList.add('is-dragging');
    event.dataTransfer?.setData('text/plain', row.dataset.productId ?? '');
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  });

  tbody.addEventListener('dragover', (event) => {
    const row = (event.target as HTMLElement).closest<HTMLTableRowElement>('tr[data-product-id]');
    if (!dragged || !row) return;
    // Das Drop muss auch dann erlaubt bleiben, wenn die gezogene Zeile nach
    // dem Verschieben selbst unter dem Cursor liegt.
    event.preventDefault();
    if (row === dragged) return;
    rows().forEach((item) => item.classList.remove('is-dragover'));
    row.classList.add('is-dragover');
    const bounds = row.getBoundingClientRect();
    const insertAfter = event.clientY > bounds.top + bounds.height / 2;
    tbody.insertBefore(dragged, insertAfter ? row.nextSibling : row);
  });

  tbody.addEventListener('drop', (event) => {
    if (!dragged) return;
    event.preventDefault();
    clearMarks();
    save();
  });

  tbody.addEventListener('dragend', () => {
    dragged = null;
    clearMarks();
  });
}

initProductSorting();
document.addEventListener('admin:filter-updated', initProductSorting);

// Bestätigungsdialoge ohne Inline-JS (die CSP erlaubt keine Event-Handler im HTML).
document.querySelectorAll<HTMLFormElement>('[data-confirm]').forEach((form) => {
  form.addEventListener('submit', (event) => {
    if (!window.confirm(form.dataset.confirm ?? 'Wirklich ausführen?')) event.preventDefault();
  });
});

// To-do-Liste: Abhaken übernimmt die Änderung sofort; ohne JS bleibt der Button.
document.querySelectorAll<HTMLInputElement>('[data-checklist-toggle]').forEach((input) => {
  input.addEventListener('change', () => input.form?.requestSubmit());
});

/**
 * Produktbilder: Sortierung per Drag & Drop. Die Pfeile in den Karten
 * funktionieren auch ohne JavaScript; hier wird nur das Ziehen ergänzt.
 */
function initProductImageSorting(): void {
  const list = document.querySelector<HTMLElement>('[data-image-order-list]');
  const csrf = list?.dataset.csrf;
  const productId = list?.dataset.productId;
  if (!list || !csrf || !productId || list.dataset.sortingBound === '1') return;
  list.dataset.sortingBound = '1';

  let dragged: HTMLElement | null = null;
  const cards = (): HTMLElement[] =>
    Array.from(list.querySelectorAll<HTMLElement>('.admin-image-card[data-image-id]'));
  const clearMarks = (): void => {
    cards().forEach((card) => card.classList.remove('is-dragging', 'is-dragover'));
  };

  const save = (): void => {
    const ids = cards()
      .map((card) => card.dataset.imageId)
      .filter((id): id is string => Boolean(id));
    if (ids.length < 2) return;

    const form = document.createElement('form');
    form.method = 'post';
    form.action = `/admin/produkte/${productId}/bilder/sortierung/`;
    const hidden = (name: string, value: string): void => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      form.append(input);
    };
    hidden('_csrf', csrf);
    ids.forEach((id) => hidden('ids', id));
    document.body.append(form);
    form.submit();
  };

  list.addEventListener('dragstart', (event) => {
    const target = event.target as HTMLElement;
    if (target.closest('button, input, textarea, a, form')) {
      event.preventDefault();
      return;
    }
    const card = target.closest<HTMLElement>('.admin-image-card[data-image-id]');
    if (!card) return;
    dragged = card;
    card.classList.add('is-dragging');
    event.dataTransfer?.setData('text/plain', card.dataset.imageId ?? '');
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  });

  list.addEventListener('dragover', (event) => {
    const card = (event.target as HTMLElement).closest<HTMLElement>('.admin-image-card[data-image-id]');
    if (!dragged || !card) return;
    // Auch über der gezogenen Karte muss das Drop erlaubt bleiben.
    event.preventDefault();
    if (card === dragged) return;
    cards().forEach((item) => item.classList.remove('is-dragover'));
    card.classList.add('is-dragover');
    const bounds = card.getBoundingClientRect();
    const after = event.clientY > bounds.top + bounds.height / 2
      || event.clientX > bounds.left + bounds.width / 2;
    list.insertBefore(dragged, after ? card.nextSibling : card);
  });

  list.addEventListener('drop', (event) => {
    if (!dragged) return;
    event.preventDefault();
    clearMarks();
    save();
  });

  list.addEventListener('dragend', () => {
    dragged = null;
    clearMarks();
  });
}

initProductImageSorting();

// Filterformulare: Auswahl im Dropdown lädt die Ansicht sofort neu.
document.querySelectorAll<HTMLSelectElement>('[data-auto-submit]').forEach((select) => {
  select.addEventListener('change', () => {
    select.form?.requestSubmit();
  });
});

// Live-Suche: Ergebnisse nach kurzer Pause laden, ohne den Fokus zu verlieren.
document.querySelectorAll<HTMLInputElement>('[data-live-search]').forEach((input) => {
  const form = input.form;
  const results = document.querySelector<HTMLElement>('[data-filter-results]');
  if (!form || !results) return;

  let timer: number | undefined;
  let controller: AbortController | undefined;

  const load = async (): Promise<void> => {
    controller?.abort();
    controller = new AbortController();
    const url = new URL(form.action, window.location.origin);
    const params = new URLSearchParams();
    new FormData(form).forEach((value, key) => {
      if (typeof value === 'string' && value !== '') params.set(key, value);
    });
    url.search = params.toString();

    try {
      const response = await fetch(url, {
        headers: { 'X-Requested-With': 'fetch' },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const next = doc.querySelector<HTMLElement>('[data-filter-results]');
      if (!next) throw new Error('Ergebnisbereich fehlt');
      results.replaceChildren(...Array.from(next.childNodes));
      document.dispatchEvent(new CustomEvent('admin:filter-updated'));
      window.history.replaceState(null, '', `${url.pathname}${url.search}`);
    } catch (error) {
      if ((error as DOMException).name === 'AbortError') return;
      form.requestSubmit();
    }
  };

  input.addEventListener('input', () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(load, 300);
  });
});

// Nachrichtenliste: Massenauswahl und Klick auf die Zeile.
const messageBoxes = Array.from(document.querySelectorAll<HTMLInputElement>('[data-select-message]'));
const messageSelectAll = document.querySelector<HTMLInputElement>('[data-select-all-messages]');
const messageCount = document.querySelector<HTMLElement>('[data-bulk-count]');
if (messageBoxes.length > 0) {
  const updateMessageSelection = (): void => {
    const selected = messageBoxes.filter((box) => box.checked).length;
    if (messageCount) messageCount.textContent = `${selected} ausgewählt`;
    if (messageSelectAll) {
      messageSelectAll.checked = selected === messageBoxes.length;
      messageSelectAll.indeterminate = selected > 0 && selected < messageBoxes.length;
    }
  };
  if (messageSelectAll) {
    messageSelectAll.addEventListener('change', () => {
      messageBoxes.forEach((box) => {
        box.checked = messageSelectAll.checked;
      });
      updateMessageSelection();
    });
  }
  messageBoxes.forEach((box) => box.addEventListener('change', updateMessageSelection));
  updateMessageSelection();
}

document.querySelectorAll<HTMLElement>('[data-message-row]').forEach((row) => {
  const openMessage = (): void => {
    const href = row.dataset.href;
    if (href) window.location.href = href;
  };
  row.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (target.closest('a, button, input, label, form, select, textarea')) return;
    openMessage();
  });
  row.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.target !== row) return;
    event.preventDefault();
    openMessage();
  });
});

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
