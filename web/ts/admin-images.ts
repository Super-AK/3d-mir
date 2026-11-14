/**
 * Bildverwaltung im Admin-Bereich.
 *
 * Jedes Bild der Stammdaten lässt sich über ein Modalfenster ersetzen.
 * Dateien können ausgewählt oder in die Ablagefläche gezogen werden.
 * Hochgeladen wird erst nach „Speichern“; der Fortschritt wird während
 * der Übertragung angezeigt. Ohne JavaScript greift das Formular im
 * <noscript>-Bereich.
 */

type UploadPayload = { ok?: boolean; redirect?: string; error?: string };

const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/avif';
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

const parseAccept = (value: string): string[] =>
  value.split(',').map((part) => part.trim()).filter(Boolean);

const formatMegabytes = (bytes: number): string => `${Math.round(bytes / (1024 * 1024))} MB`;

const fileMatchesAccept = (file: File, accepted: string[]): boolean =>
  accepted.includes(file.type) || (file.type.startsWith('image/') && accepted.includes('image/*'));

const showError = (box: HTMLElement, message: string): void => {
  const paragraph = box.querySelector('p');
  if (paragraph) paragraph.textContent = message;
  box.hidden = false;
};

const hideError = (box: HTMLElement): void => {
  box.hidden = true;
};

const openDialog = (dialog: HTMLDialogElement): void => {
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
};

const closeDialog = (dialog: HTMLDialogElement): void => {
  if (typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
};

/**
 * Prüft ausgewählte Dateien auf Format und Größe und begrenzt die Anzahl.
 * Fehlerhafte Dateien werden übersprungen und gemeldet.
 */
function validFiles(
  incoming: File[],
  accepted: string[],
  maxBytes: number,
  limit: number,
  reject: (message: string) => void,
): File[] {
  const result: File[] = [];
  for (const file of incoming) {
    if (!fileMatchesAccept(file, accepted)) {
      reject(`„${file.name}“ hat ein nicht unterstütztes Format.`);
      continue;
    }
    if (file.size > maxBytes) {
      reject(`„${file.name}“ ist zu groß. Erlaubt sind bis zu ${formatMegabytes(maxBytes)}.`);
      continue;
    }
    result.push(file);
  }
  if (result.length > limit) {
    reject(`Es sind maximal ${limit} Bild(er) auswählbar.`);
  }
  return result.slice(0, limit);
}

/** Verbindet eine Ablagefläche mit Dateiauswahl, Klick und Drag & Drop. */
function bindDropzone(options: {
  zone: HTMLElement;
  input: HTMLInputElement;
  onFiles: (files: File[]) => void;
}): void {
  const pick = (): void => options.input.click();

  options.zone.addEventListener('click', pick);
  options.zone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      pick();
    }
  });
  options.zone.addEventListener('dragover', (event) => {
    event.preventDefault();
    options.zone.classList.add('is-dragover');
  });
  options.zone.addEventListener('dragleave', () => {
    options.zone.classList.remove('is-dragover');
  });
  options.zone.addEventListener('drop', (event) => {
    event.preventDefault();
    options.zone.classList.remove('is-dragover');
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length > 0) options.onFiles(files);
  });
  options.input.addEventListener('change', () => {
    const files = Array.from(options.input.files ?? []);
    // Zurücksetzen, damit dieselbe Datei erneut gewählt werden kann.
    options.input.value = '';
    if (files.length > 0) options.onFiles(files);
  });
}

/** Sendet die Dateien per XHR und zeigt dabei den Übertragungsfortschritt. */
function uploadFiles(options: {
  form: HTMLFormElement;
  data: FormData;
  progress: HTMLElement;
  bar: HTMLProgressElement;
  status: HTMLElement;
  save: HTMLButtonElement;
  errorBox: HTMLElement;
}): void {
  const { form, data, progress, bar, status, save, errorBox } = options;
  const request = new XMLHttpRequest();
  request.open('POST', form.action);
  request.setRequestHeader('Accept', 'application/json');
  request.setRequestHeader('X-Requested-With', 'XMLHttpRequest');

  hideError(errorBox);
  progress.hidden = false;
  bar.value = 0;
  status.textContent = 'Wird hochgeladen …';
  save.disabled = true;

  request.upload.addEventListener('progress', (event) => {
    if (!event.lengthComputable) return;
    const percent = Math.round((event.loaded / event.total) * 100);
    bar.value = percent;
    status.textContent = `${percent} % übertragen …`;
  });
  request.upload.addEventListener('load', () => {
    bar.value = 100;
    status.textContent = 'Wird verarbeitet …';
  });
  request.addEventListener('load', () => {
    let payload: UploadPayload = {};
    try {
      payload = JSON.parse(request.responseText) as UploadPayload;
    } catch {
      // Die Antwort war kein JSON; unten wird ein allgemeiner Fehler gezeigt.
    }
    if (request.status >= 200 && request.status < 300 && payload.ok) {
      bar.value = 100;
      status.textContent = 'Gespeichert – Seite wird neu geladen …';
      window.location.assign(payload.redirect ?? '/admin/stammdaten/?gespeichert=1');
      return;
    }
    save.disabled = false;
    progress.hidden = true;
    showError(errorBox, payload.error ?? 'Der Upload ist fehlgeschlagen. Bitte versuchen Sie es erneut.');
  });
  request.addEventListener('error', () => {
    save.disabled = false;
    progress.hidden = true;
    showError(errorBox, 'Netzwerkfehler: Der Upload konnte nicht gesendet werden.');
  });

  request.send(data);
}

/** Modalfenster für ein einzelnes Bild (Logo, Hero, Service, Material, Rechner). */
function initImageModal(): void {
  const dialog = document.querySelector<HTMLDialogElement>('[data-image-modal]');
  if (!dialog) return;

  const form = dialog.querySelector<HTMLFormElement>('[data-image-modal-form]');
  const slotField = dialog.querySelector<HTMLInputElement>('[data-image-slot]');
  const title = dialog.querySelector<HTMLElement>('[data-image-modal-title]');
  const zone = dialog.querySelector<HTMLElement>('[data-dropzone]');
  const input = dialog.querySelector<HTMLInputElement>('[data-file-input]');
  const selection = dialog.querySelector<HTMLElement>('[data-selection]');
  const errorBox = dialog.querySelector<HTMLElement>('[data-modal-error]');
  const progress = dialog.querySelector<HTMLElement>('[data-upload-progress]');
  const bar = dialog.querySelector<HTMLProgressElement>('[data-upload-bar]');
  const status = dialog.querySelector<HTMLElement>('[data-upload-status]');
  const save = dialog.querySelector<HTMLButtonElement>('[data-modal-save]');
  const acceptLabel = dialog.querySelector<HTMLElement>('[data-accept-label]');
  const maxLabel = dialog.querySelector<HTMLElement>('[data-max-label]');
  const csrf = form?.querySelector<HTMLInputElement>('input[name="_csrf"]');

  if (!form || !slotField || !title || !zone || !input || !selection || !errorBox || !progress || !bar || !status || !save) {
    return;
  }

  let files: File[] = [];
  let accepted = parseAccept(IMAGE_ACCEPT);
  let maxBytes = MAX_IMAGE_BYTES;
  let objectUrls: string[] = [];

  const revokeUrls = (): void => {
    for (const url of objectUrls) URL.revokeObjectURL(url);
    objectUrls = [];
  };

  const reset = (): void => {
    files = [];
    revokeUrls();
    selection.replaceChildren();
    selection.hidden = true;
    zone.classList.remove('has-file');
    hideError(errorBox);
    progress.hidden = true;
    bar.value = 0;
    status.textContent = '';
    save.disabled = false;
  };

  const render = (): void => {
    revokeUrls();
    selection.replaceChildren();
    selection.hidden = files.length === 0;
    zone.classList.toggle('has-file', files.length > 0);
    for (const file of files) {
      const item = document.createElement('figure');
      item.className = 'admin-selection-item';

      const image = document.createElement('img');
      const url = URL.createObjectURL(file);
      objectUrls.push(url);
      image.src = url;
      image.alt = '';

      const caption = document.createElement('figcaption');
      caption.textContent = file.name;

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'admin-selection-remove';
      remove.setAttribute('aria-label', `${file.name} entfernen`);
      remove.textContent = '×';
      remove.addEventListener('click', () => {
        files = [];
        render();
      });

      item.append(image, caption, remove);
      selection.append(item);
    }
  };

  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-image-edit]')) {
    button.addEventListener('click', () => {
      const card = button.closest<HTMLElement>('[data-image-card]');
      if (!card) return;
      const slot = card.dataset.slot ?? '';
      const megabytes = Number(card.dataset.maxSize ?? '12');
      accepted = parseAccept(card.dataset.accept ?? IMAGE_ACCEPT);
      maxBytes = (Number.isFinite(megabytes) ? megabytes : 12) * 1024 * 1024;

      slotField.value = slot;
      title.textContent = `${card.dataset.label ?? 'Bild'} bearbeiten`;
      input.accept = card.dataset.accept ?? IMAGE_ACCEPT;
      if (acceptLabel) acceptLabel.textContent = card.dataset.typeLabel ?? 'JPG, PNG, WebP oder AVIF';
      if (maxLabel) maxLabel.textContent = formatMegabytes(maxBytes);

      reset();
      openDialog(dialog);
      zone.focus();
    });
  }

  bindDropzone({
    zone,
    input,
    onFiles: (incoming) => {
      hideError(errorBox);
      const picked = validFiles(incoming, accepted, maxBytes, 1, (message) => showError(errorBox, message));
      if (picked[0]) {
        files = [picked[0]];
        render();
      }
    },
  });

  for (const closer of dialog.querySelectorAll<HTMLElement>('[data-modal-close]')) {
    closer.addEventListener('click', () => closeDialog(dialog));
  }
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeDialog(dialog);
  });
  dialog.addEventListener('close', reset);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    hideError(errorBox);
    if (files.length === 0) {
      showError(errorBox, 'Bitte wählen Sie eine Bilddatei aus.');
      return;
    }
    const data = new FormData();
    if (csrf) data.append('_csrf', csrf.value);
    data.append('slot', slotField.value);
    for (const file of files) data.append(slotField.value, file, file.name);

    uploadFiles({ form, data, progress, bar, status, save, errorBox });
  });
}

/** Modalfenster für mehrere Galeriebilder. */
function initGalleryModal(): void {
  const dialog = document.querySelector<HTMLDialogElement>('[data-gallery-modal]');
  const opener = document.querySelector<HTMLButtonElement>('[data-gallery-edit]');
  if (!dialog || !opener) return;

  const form = dialog.querySelector<HTMLFormElement>('[data-gallery-form]');
  const zone = dialog.querySelector<HTMLElement>('[data-gallery-dropzone]');
  const input = dialog.querySelector<HTMLInputElement>('[data-gallery-input]');
  const selection = dialog.querySelector<HTMLElement>('[data-gallery-selection]');
  const selectionHead = dialog.querySelector<HTMLElement>('[data-selection-head]');
  const countLabel = dialog.querySelector<HTMLElement>('[data-selection-count]');
  const clearButton = dialog.querySelector<HTMLButtonElement>('[data-clear-selection]');
  const replace = dialog.querySelector<HTMLInputElement>('[data-replace-gallery]');
  const errorBox = dialog.querySelector<HTMLElement>('[data-modal-error]');
  const progress = dialog.querySelector<HTMLElement>('[data-upload-progress]');
  const bar = dialog.querySelector<HTMLProgressElement>('[data-upload-bar]');
  const status = dialog.querySelector<HTMLElement>('[data-upload-status]');
  const save = dialog.querySelector<HTMLButtonElement>('[data-modal-save]');
  const csrf = form?.querySelector<HTMLInputElement>('input[name="_csrf"]');

  if (!form || !zone || !input || !selection || !errorBox || !progress || !bar || !status || !save) {
    return;
  }

  const startingSlots = Math.max(0, Math.min(8, Number(opener.dataset.galleryRemaining ?? '8') || 0));
  let files: File[] = [];
  let objectUrls: string[] = [];

  const capacity = (): number => (replace?.checked ? 8 : startingSlots);

  const revokeUrls = (): void => {
    for (const url of objectUrls) URL.revokeObjectURL(url);
    objectUrls = [];
  };

  const reset = (): void => {
    files = [];
    revokeUrls();
    selection.replaceChildren();
    selection.hidden = true;
    if (selectionHead) selectionHead.hidden = true;
    if (replace) replace.checked = false;
    if (countLabel) countLabel.textContent = '';
    zone.classList.remove('has-file');
    hideError(errorBox);
    progress.hidden = true;
    bar.value = 0;
    status.textContent = '';
    save.disabled = false;
  };

  const render = (): void => {
    revokeUrls();
    selection.replaceChildren();
    selection.hidden = files.length === 0;
    if (selectionHead) selectionHead.hidden = files.length === 0;
    if (countLabel) countLabel.textContent = `${files.length} von ${capacity()} ausgewählt`;
    zone.classList.toggle('has-file', files.length > 0);

    for (const [index, file] of files.entries()) {
      const item = document.createElement('figure');
      item.className = 'admin-selection-item';

      const image = document.createElement('img');
      const url = URL.createObjectURL(file);
      objectUrls.push(url);
      image.src = url;
      image.alt = '';

      const caption = document.createElement('figcaption');
      caption.textContent = file.name;

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'admin-selection-remove';
      remove.setAttribute('aria-label', `${file.name} entfernen`);
      remove.textContent = '×';
      remove.addEventListener('click', () => {
        files.splice(index, 1);
        render();
      });

      item.append(image, caption, remove);
      selection.append(item);
    }
  };

  const addFiles = (incoming: File[]): void => {
    hideError(errorBox);
    const available = Math.max(0, capacity() - files.length);
    if (available === 0) {
      showError(
        errorBox,
        replace?.checked
          ? 'Es sind maximal 8 Galeriebilder möglich.'
          : 'Die Galerie ist voll. Bitte entfernen Sie zuerst Bilder oder aktivieren Sie „Vorhandene eigene Galerie ersetzen“.',
      );
      return;
    }
    const picked = validFiles(incoming, parseAccept(IMAGE_ACCEPT), MAX_IMAGE_BYTES, available, (message) =>
      showError(errorBox, message),
    );
    if (picked.length > 0) {
      files = [...files, ...picked];
      render();
    }
  };

  opener.addEventListener('click', () => {
    reset();
    openDialog(dialog);
    zone.focus();
  });

  bindDropzone({ zone, input, onFiles: addFiles });

  clearButton?.addEventListener('click', () => {
    files = [];
    render();
  });
  replace?.addEventListener('change', () => {
    hideError(errorBox);
    const max = capacity();
    if (files.length > max) {
      // Beim Abwählen von „Ersetzen“ kann das Limit sinken.
      files = files.slice(0, max);
      render();
    } else if (countLabel) {
      countLabel.textContent = `${files.length} von ${max} ausgewählt`;
    }
  });

  for (const closer of dialog.querySelectorAll<HTMLElement>('[data-modal-close]')) {
    closer.addEventListener('click', () => closeDialog(dialog));
  }
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeDialog(dialog);
  });
  dialog.addEventListener('close', reset);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    hideError(errorBox);
    if (files.length === 0) {
      showError(errorBox, 'Bitte wählen Sie mindestens ein Galeriebild aus.');
      return;
    }
    const data = new FormData();
    if (csrf) data.append('_csrf', csrf.value);
    data.append('slot', 'gallery');
    if (replace?.checked) data.append('replaceGallery', '1');
    for (const file of files) data.append('gallery', file, file.name);

    uploadFiles({ form, data, progress, bar, status, save, errorBox });
  });
}

initImageModal();
initGalleryModal();
