import '../css/main.css';
import '../css/admin.css';

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
