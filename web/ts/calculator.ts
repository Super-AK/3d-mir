import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  calculatePrice,
  choosePrinter,
  type PriceMaterial,
  type PriceMetrics,
  type PriceOptions,
  type PricingData,
} from '../../src/lib/pricing';

type CalculatorConfig = PricingData & {
  materials: (PriceMaterial & { colors: string[] })[];
  infillOptions: number[];
  layerHeightOptions: number[];
};

type AnalyseResponse = {
  ok: boolean;
  error?: string;
  format?: 'stl' | 'obj' | '3mf';
  metrics?: PriceMetrics;
  suggestedPrinterId?: string | null;
  filename?: string;
  size?: number;
};

const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const number = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });

function formatEuro(cents: number): string {
  return euro.format(cents / 100);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${number.format(bytes / 1024)} KB`;
  return `${number.format(bytes / 1024 / 1024)} MB`;
}

function element<T extends HTMLElement>(root: ParentNode, selector: string): T | null {
  return root.querySelector<T>(selector);
}

function init(root: HTMLElement): void {
  const config = JSON.parse(root.dataset.config ?? '{}') as CalculatorConfig;
  const maxUploadMb = Number(root.dataset.maxUploadMb ?? 50);

  const form = element<HTMLFormElement>(root, '#calc-form');
  const fileInput = element<HTMLInputElement>(root, '#model');
  const dropzone = element<HTMLElement>(root, '[data-dropzone]');
  const fileMeta = element<HTMLElement>(root, '[data-file-meta]');
  const previewCanvas = element<HTMLCanvasElement>(root, '#model-preview');
  const previewEmpty = element<HTMLElement>(root, '[data-preview-empty]');
  const previewStatus = element<HTMLElement>(root, '[data-preview-status]');
  const metricsBox = element<HTMLElement>(root, '[data-metrics]');
  const metricDimensions = element<HTMLElement>(root, '[data-metric-dimensions]');
  const metricVolume = element<HTMLElement>(root, '[data-metric-volume]');
  const metricSurface = element<HTMLElement>(root, '[data-metric-surface]');
  const metricTriangles = element<HTMLElement>(root, '[data-metric-triangles]');
  const priceEl = element<HTMLElement>(root, '[data-price]');
  const priceSub = element<HTMLElement>(root, '[data-price-sub]');
  const breakdownEl = element<HTMLElement>(root, '[data-breakdown]');
  const weightEl = element<HTMLElement>(root, '[data-weight]');
  const hoursEl = element<HTMLElement>(root, '[data-hours]');
  const warningsEl = element<HTMLElement>(root, '[data-warnings]');
  const submitButton = element<HTMLButtonElement>(root, '[data-submit]');
  const formError = element<HTMLElement>(root, '[data-form-error]');
  const materialSelect = element<HTMLSelectElement>(root, '#materialId');
  const printerSelect = element<HTMLSelectElement>(root, '#printerId');
  const colorSelect = element<HTMLSelectElement>(root, '#color');
  const unitSelect = element<HTMLSelectElement>(root, '#unit');

  if (
    !form ||
    !fileInput ||
    !dropzone ||
    !previewCanvas ||
    !metricsBox ||
    !priceEl ||
    !breakdownEl ||
    !submitButton ||
    !materialSelect ||
    !printerSelect ||
    !colorSelect
  ) {
    return;
  }

  let file: File | null = null;
  let metrics: PriceMetrics | null = null;
  let analyseToken = 0;
  let submitting = false;
  let previewReady = false;

  // -------------------------------------------------------------------------
  // Preis und Anzeige
  // -------------------------------------------------------------------------

  function currentOptions(): PriceOptions {
    return {
      materialId: materialSelect.value,
      printerId: printerSelect.value,
      infill: Number(element<HTMLSelectElement>(root, '#infill')?.value ?? 20),
      layerHeight: Number(element<HTMLSelectElement>(root, '#layerHeight')?.value ?? 0.2),
      quantity: Number(element<HTMLInputElement>(root, '#quantity')?.value ?? 1),
      coatingId: element<HTMLSelectElement>(root, '#coating')?.value ?? 'none',
      scalePercent: Number(element<HTMLInputElement>(root, '#scalePercent')?.value ?? 100),
    };
  }

  function showError(message: string): void {
    if (!formError) return;
    formError.textContent = message;
    formError.hidden = false;
  }

  function clearError(): void {
    if (!formError) return;
    formError.textContent = '';
    formError.hidden = true;
  }

  function renderWarnings(warnings: string[]): void {
    if (!warningsEl) return;
    warningsEl.replaceChildren();
    warningsEl.hidden = warnings.length === 0;
    for (const warning of warnings) {
      const p = document.createElement('p');
      p.textContent = warning;
      warningsEl.append(p);
    }
  }

  function updateMetricsDisplay(scalePercent: number, dimensions: { x: number; y: number; z: number }): void {
    if (!metrics) return;
    const scale = scalePercent / 100;
    const unit = unitSelect?.value === 'inch' ? 'in' : 'mm';
    const factor = unit === 'inch' ? 1 / 25.4 : 1;
    const dims = [dimensions.x, dimensions.y, dimensions.z].map((value) => number.format(value * factor));
    if (metricDimensions) metricDimensions.textContent = `${dims.join(' × ')} ${unit}`;
    if (metricVolume) metricVolume.textContent = `${number.format(metrics.volumeCm3 * scale ** 3)} cm³`;
    if (metricSurface) metricSurface.textContent = `${number.format(metrics.surfaceCm2 * scale ** 2)} cm²`;
    if (metricTriangles) metricTriangles.textContent = number.format(metrics.triangles);
  }

  function renderPrice(): void {
    if (!metrics) {
      priceEl.textContent = '–';
      if (priceSub) priceSub.textContent = 'Modell hochladen, um den Preis zu berechnen.';
      breakdownEl.replaceChildren();
      if (weightEl) weightEl.textContent = '–';
      if (hoursEl) hoursEl.textContent = '–';
      renderWarnings([]);
      submitButton.disabled = true;
      return;
    }

    const options = currentOptions();
    const material = config.materials.find((item) => item.id === options.materialId);
    const printer = config.printers.find((item) => item.id === options.printerId);
    if (!material || !printer) return;

    try {
      const result = calculatePrice(metrics, options, config);
      priceEl.textContent = formatEuro(result.totalCents);
      if (priceSub) {
        priceSub.textContent = `${options.quantity} × ${material.label} · ${printer.label}`;
      }
      breakdownEl.replaceChildren();
      for (const item of result.breakdown) {
        const li = document.createElement('li');
        const label = document.createElement('span');
        label.textContent = item.label;
        const value = document.createElement('span');
        value.textContent = formatEuro(item.cents);
        li.append(label, value);
        breakdownEl.append(li);
      }
      if (weightEl) weightEl.textContent = `${number.format(result.weightG)} g`;
      if (hoursEl) hoursEl.textContent = `${number.format(result.printHours)} h`;
      renderWarnings(result.warnings);
      updateMetricsDisplay(options.scalePercent, result.dimensionsMm);
      submitButton.disabled = submitting;
    } catch (error) {
      priceEl.textContent = '–';
      if (priceSub) priceSub.textContent = 'Bitte prüfen Sie die Einstellungen.';
      renderWarnings([error instanceof Error ? error.message : 'Die Preisschätzung ist fehlgeschlagen.']);
    }
  }

  function syncColors(): void {
    const material = config.materials.find((item) => item.id === materialSelect.value);
    const previous = colorSelect.value;
    colorSelect.replaceChildren();
    const fallback = document.createElement('option');
    fallback.value = '';
    fallback.textContent = 'Farbe nach Absprache';
    colorSelect.append(fallback);
    for (const color of material?.colors ?? []) {
      const option = document.createElement('option');
      option.value = color;
      option.textContent = color;
      colorSelect.append(option);
    }
    colorSelect.value = (material?.colors ?? []).includes(previous) ? previous : (material?.colors[0] ?? '');
  }

  function syncPrinter(): void {
    if (!metrics) return;
    const material = config.materials.find((item) => item.id === materialSelect.value);
    const printer = config.printers.find((item) => item.id === printerSelect.value);
    const supports = printer && material ? printer.materialIds.includes(material.id) : true;
    if (supports) return;
    const suggestion = choosePrinter(
      metrics.dimensionsMm,
      materialSelect.value,
      config.printers,
      Number(element<HTMLInputElement>(root, '#scalePercent')?.value ?? 100),
    );
    if (suggestion) printerSelect.value = suggestion;
  }

  // -------------------------------------------------------------------------
  // 3D-Vorschau
  // -------------------------------------------------------------------------

  const preview = {
    renderer: null as THREE.WebGLRenderer | null,
    scene: null as THREE.Scene | null,
    camera: null as THREE.PerspectiveCamera | null,
    controls: null as OrbitControls | null,
    grid: null as THREE.GridHelper | null,
    object: null as THREE.Object3D | null,
    resizeObserver: null as ResizeObserver | null,
  };

  function renderPreview(): void {
    if (!preview.renderer || !preview.scene || !preview.camera) return;
    preview.renderer.render(preview.scene, preview.camera);
  }

  function resizePreview(): void {
    if (!preview.renderer || !preview.camera || !previewCanvas) return;
    const width = previewCanvas.clientWidth || 720;
    const height = previewCanvas.clientHeight || 420;
    preview.renderer.setSize(width, height, false);
    preview.camera.aspect = width / height;
    preview.camera.updateProjectionMatrix();
    renderPreview();
  }

  function setupPreview(): void {
    if (previewReady || !previewCanvas) return;
    previewReady = true;
    try {
      const renderer = new THREE.WebGLRenderer({ canvas: previewCanvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100000);
      camera.position.set(140, 100, 180);

      scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 2.2));
      const key = new THREE.DirectionalLight(0xffffff, 2.4);
      key.position.set(1, 2, 1.5);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0x88aaff, 0.8);
      fill.position.set(-1.5, -0.5, -1);
      scene.add(fill);

      const controls = new OrbitControls(camera, previewCanvas);
      controls.enableDamping = false;
      controls.enablePan = false;
      controls.minDistance = 10;
      controls.maxDistance = 20000;
      controls.addEventListener('change', renderPreview);

      preview.renderer = renderer;
      preview.scene = scene;
      preview.camera = camera;
      preview.controls = controls;
      preview.resizeObserver = new ResizeObserver(resizePreview);
      preview.resizeObserver.observe(previewCanvas);
      resizePreview();
    } catch {
      if (previewEmpty) previewEmpty.textContent = 'Die 3D-Vorschau ist in diesem Browser nicht verfügbar.';
      if (previewStatus) previewStatus.textContent = 'Die Datei kann trotzdem analysiert und angefragt werden.';
    }
  }

  function disposeObject(object: THREE.Object3D): void {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const material of materials) material.dispose();
      }
    });
  }

  function normalizeObject(object: THREE.Object3D): THREE.Object3D {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (!child.geometry.getAttribute('normal')) child.geometry.computeVertexNormals();
        child.material = new THREE.MeshStandardMaterial({
          color: 0x2f6fb0,
          metalness: 0.05,
          roughness: 0.55,
          flatShading: false,
        });
      }
    });
    return object;
  }

  async function parsePreviewFile(selected: File): Promise<THREE.Object3D> {
    const extension = selected.name.toLowerCase().split('.').pop();
    const buffer = await selected.arrayBuffer();

    if (extension === 'stl') {
      const geometry = new STLLoader().parse(buffer);
      return new THREE.Mesh(geometry);
    }
    if (extension === 'obj') {
      return new OBJLoader().parse(new TextDecoder().decode(buffer));
    }
    if (extension === '3mf') {
      return new ThreeMFLoader().parse(buffer);
    }
    throw new Error('Unbekanntes Dateiformat für die Vorschau.');
  }

  async function showPreview(selected: File): Promise<void> {
    setupPreview();
    if (!preview.scene || !preview.camera || !preview.controls) return;
    if (previewStatus) previewStatus.textContent = '3D-Vorschau wird geladen …';
    try {
      const object = normalizeObject(await parsePreviewFile(selected));
      // STL/OBJ/3MF sind in der 3D-Druck-Praxis Z-up; three.js ist Y-up.
      // Ohne diese Drehung liegen Modelle flach auf der Vorschau.
      object.rotation.x = -Math.PI / 2;
      object.updateMatrixWorld(true);
      if (preview.object) {
        preview.scene.remove(preview.object);
        disposeObject(preview.object);
      }
      if (preview.grid) {
        preview.scene.remove(preview.grid);
        preview.grid.geometry.dispose();
      }

      const box = new THREE.Box3().setFromObject(object);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      object.position.sub(center);
      preview.scene.add(object);
      preview.object = object;

      const maxDimension = Math.max(size.x, size.y, size.z, 1);
      const grid = new THREE.GridHelper(maxDimension * 4, 20, 0x9fb2c8, 0xdbe3ee);
      grid.position.y = -size.y / 2;
      preview.scene.add(grid);
      preview.grid = grid;

      preview.camera.near = maxDimension / 1000;
      preview.camera.far = maxDimension * 100;
      preview.camera.position.set(maxDimension * 1.15, maxDimension * 0.85, maxDimension * 1.55);
      preview.camera.updateProjectionMatrix();
      preview.controls.target.set(0, 0, 0);
      preview.controls.minDistance = maxDimension * 0.35;
      preview.controls.maxDistance = maxDimension * 12;
      preview.controls.update();
      if (previewEmpty) previewEmpty.hidden = true;
      if (previewStatus) previewStatus.textContent = 'Vorschau mit Maus oder Finger drehen und zoomen.';
      resizePreview();
      renderPreview();
    } catch {
      if (previewStatus) previewStatus.textContent = 'Für diese Datei ist keine Vorschau möglich. Die Analyse funktioniert trotzdem.';
    }
  }

  // -------------------------------------------------------------------------
  // Analyse und Anfrage
  // -------------------------------------------------------------------------

  async function analyse(selected: File): Promise<void> {
    const token = ++analyseToken;
    clearError();
    metrics = null;
    metricsBox.hidden = true;
    renderPrice();
    submitButton.disabled = true;
    if (previewStatus) previewStatus.textContent = 'Modell wird analysiert …';

    const data = new FormData();
    data.append('model', selected);
    data.append('materialId', materialSelect.value);
    data.append('scalePercent', element<HTMLInputElement>(root, '#scalePercent')?.value ?? '100');

    try {
      const response = await fetch('/3d-druck-rechner/analyse/', { method: 'POST', body: data });
      const result = (await response.json().catch(() => ({}))) as AnalyseResponse;
      if (token !== analyseToken) return;
      if (!response.ok || !result.ok || !result.metrics) {
        throw new Error(result.error || 'Das Modell konnte nicht analysiert werden.');
      }

      metrics = result.metrics;
      metricsBox.hidden = false;
      if (result.suggestedPrinterId) {
        const current = config.printers.find((item) => item.id === printerSelect.value);
        const material = config.materials.find((item) => item.id === materialSelect.value);
        const currentFits =
          current &&
          result.metrics.dimensionsMm.x <= current.buildVolume.x + 0.5 &&
          result.metrics.dimensionsMm.y <= current.buildVolume.y + 0.5 &&
          result.metrics.dimensionsMm.z <= current.buildVolume.z + 0.5 &&
          (!material || current.materialIds.includes(material.id));
        if (!currentFits) printerSelect.value = result.suggestedPrinterId;
      }
      if (fileMeta && result.filename) {
        fileMeta.hidden = false;
        fileMeta.textContent = `${result.filename} · ${formatBytes(result.size ?? selected.size)} · ${(result.format ?? '').toUpperCase()}`;
      }
      renderPrice();
      if (previewStatus) previewStatus.textContent = 'Analyse abgeschlossen.';
    } catch (error) {
      if (token !== analyseToken) return;
      const message = error instanceof Error ? error.message : 'Das Modell konnte nicht analysiert werden.';
      if (previewStatus) previewStatus.textContent = message;
      showError(message);
      renderPrice();
    }
  }

  async function submitForm(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    clearError();

    if (!file) {
      showError('Bitte wählen Sie zuerst eine Modell-Datei aus.');
      return;
    }
    if (!metrics) {
      showError('Bitte warten Sie, bis das Modell analysiert wurde.');
      return;
    }
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    submitting = true;
    submitButton.disabled = true;
    submitButton.textContent = 'Anfrage wird gesendet …';

    try {
      const response = await fetch('/3d-druck-rechner/anfrage/', {
        method: 'POST',
        body: new FormData(form),
      });
      const result = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string; reference?: string };
      if (!response.ok || !result.ok || !result.reference) {
        throw new Error(result.error || 'Die Anfrage konnte nicht gesendet werden.');
      }
      window.location.href = `/3d-druck-rechner/danke/?reference=${encodeURIComponent(result.reference)}`;
    } catch (error) {
      submitting = false;
      submitButton.disabled = false;
      submitButton.textContent = 'Unverbindliches Angebot anfragen';
      showError(error instanceof Error ? error.message : 'Die Anfrage konnte nicht gesendet werden.');
    }
  }

  // -------------------------------------------------------------------------
  // Ereignisse
  // -------------------------------------------------------------------------

  fileInput.addEventListener('change', () => {
    const selected = fileInput.files?.[0] ?? null;
    file = selected;
    if (fileMeta) fileMeta.hidden = true;
    if (!selected) {
      metrics = null;
      metricsBox.hidden = true;
      renderPrice();
      return;
    }
    if (selected.size > maxUploadMb * 1024 * 1024) {
      showError(`Die Datei ist zu groß (maximal ${maxUploadMb} MB).`);
      fileInput.value = '';
      file = null;
      return;
    }
    const extension = selected.name.toLowerCase().split('.').pop();
    if (!['stl', '3mf', 'obj'].includes(extension ?? '')) {
      showError('Bitte wählen Sie eine STL-, 3MF- oder OBJ-Datei aus.');
      fileInput.value = '';
      file = null;
      return;
    }
    void analyse(selected);
    void showPreview(selected);
  });

  dropzone.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropzone.classList.add('is-dragging');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-dragging'));
  dropzone.addEventListener('drop', (event) => {
    event.preventDefault();
    dropzone.classList.remove('is-dragging');
    const dropped = event.dataTransfer?.files?.[0];
    if (!dropped) return;
    const transfer = new DataTransfer();
    transfer.items.add(dropped);
    fileInput.files = transfer.files;
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  });

  form.addEventListener('submit', (event) => void submitForm(event));
  form.addEventListener('input', () => renderPrice());
  form.addEventListener('change', (event) => {
    const target = event.target as HTMLElement;
    if (target === materialSelect) {
      syncColors();
      syncPrinter();
    }
    renderPrice();
  });

  syncColors();
  renderPrice();
}

const root = document.querySelector<HTMLElement>('[data-calculator]');
if (root) init(root);
