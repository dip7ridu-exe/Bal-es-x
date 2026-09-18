import { calculateGuidedViewport, detectSpeechRegions, sortRegions } from "./guided.js?v=2-mobile";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const imagePattern = /\.(avif|bmp|gif|jpe?g|png|webp)$/i;
const archivePattern = /\.(cbr|cbz|rar|zip)$/i;
const HISTORY_KEY = "balao-reader-history-v1";
const PREFS_KEY = "balao-reader-prefs-v1";
const isMobileLayout = () => matchMedia("(max-width: 760px), (hover: none) and (pointer: coarse) and (max-width: 1024px)").matches;

const dom = {
  homeView: $("#homeView"),
  readerView: $("#readerView"),
  dropZone: $("#dropZone"),
  openButton: $("#openButton"),
  fileInput: $("#fileInput"),
  themeButton: $("#themeButton"),
  recentGrid: $("#recentGrid"),
  clearHistoryButton: $("#clearHistoryButton"),
  closeReaderButton: $("#closeReaderButton"),
  bookTitle: $("#bookTitle"),
  bookMeta: $("#bookMeta"),
  readerViewport: $("#readerViewport"),
  pageStage: $("#pageStage"),
  pageImage: $("#pageImage"),
  secondPageShell: $("#secondPageShell"),
  secondPageImage: $("#secondPageImage"),
  scrollPages: $("#scrollPages"),
  thumbnailRail: $("#thumbnailRail"),
  thumbnailList: $("#thumbnailList"),
  thumbnailToggle: $("#thumbnailToggle"),
  previousPageZone: $("#previousPageZone"),
  nextPageZone: $("#nextPageZone"),
  footerPreviousButton: $("#footerPreviousButton"),
  footerNextButton: $("#footerNextButton"),
  pageSlider: $("#pageSlider"),
  footerCurrentPage: $("#footerCurrentPage"),
  footerTotalPages: $("#footerTotalPages"),
  zoomOutButton: $("#zoomOutButton"),
  zoomInButton: $("#zoomInButton"),
  zoomValueButton: $("#zoomValueButton"),
  fitButton: $("#fitButton"),
  fitLabel: $("#fitLabel"),
  rotateButton: $("#rotateButton"),
  guidedButton: $("#guidedButton"),
  guidedButtonLabel: $("#guidedButtonLabel"),
  fullscreenButton: $("#fullscreenButton"),
  settingsButton: $("#settingsButton"),
  mobilePreviousButton: $("#mobilePreviousButton"),
  mobileNextButton: $("#mobileNextButton"),
  mobileGuidedButton: $("#mobileGuidedButton"),
  mobileThumbsButton: $("#mobileThumbsButton"),
  mobileSettingsButton: $("#mobileSettingsButton"),
  settingsSheet: $("#settingsSheet"),
  settingsBackdrop: $("#settingsBackdrop"),
  closeSettingsButton: $("#closeSettingsButton"),
  directionLtr: $("#directionLtr"),
  directionRtl: $("#directionRtl"),
  brightnessSlider: $("#brightnessSlider"),
  brightnessOutput: $("#brightnessOutput"),
  contrastSlider: $("#contrastSlider"),
  contrastOutput: $("#contrastOutput"),
  autoHideToggle: $("#autoHideToggle"),
  guidedLayer: $("#guidedLayer"),
  guidedCanvas: $("#guidedCanvas"),
  guidedCounter: $("#guidedCounter"),
  guidedHelp: $("#guidedHelp"),
  closeGuidedButton: $("#closeGuidedButton"),
  guidedPreviousButton: $("#guidedPreviousButton"),
  guidedNextButton: $("#guidedNextButton"),
  manualRegionButton: $("#manualRegionButton"),
  manualSelection: $("#manualSelection"),
  emptyDetection: $("#emptyDetection"),
  startManualButton: $("#startManualButton"),
  loadingOverlay: $("#loadingOverlay"),
  loadingTitle: $("#loadingTitle"),
  loadingDetail: $("#loadingDetail"),
  loadingBar: $("#loadingBar"),
  toastRegion: $("#toastRegion"),
};

const defaultPrefs = {
  theme: "dark",
  viewMode: "single",
  direction: "ltr",
  fit: "page",
  brightness: 100,
  contrast: 100,
  autoHide: true,
};

const state = {
  reader: null,
  fileKey: null,
  pageIndex: 0,
  pageCount: 0,
  viewMode: "single",
  direction: "ltr",
  fit: "page",
  zoom: 1,
  rotation: 0,
  brightness: 100,
  contrast: 100,
  autoHide: true,
  renderToken: 0,
  guidedActive: false,
  guidedRegions: [],
  guidedRegionIndex: 0,
  guidedCache: new Map(),
  manualMode: false,
  manualStart: null,
  pendingRecent: null,
  scrollObserver: null,
  scrollFrame: null,
  thumbnailObserver: null,
  controlsTimer: null,
  pageAspect: null,
  guidedView: null,
  guidedAnimationFrame: null,
  touch: { startX: 0, startY: 0, startTime: 0, pinchDistance: 0, pinchZoom: 1, lastTap: 0 },
};

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private browsing or a full quota should never block reading.
  }
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "arquivo local";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function extensionOf(name) {
  return name.includes(".") ? name.split(".").pop().toUpperCase() : "ARQUIVO";
}

function bookName(name) {
  return name.replace(/\.(cbr|cbz|rar|zip|pdf|avif|bmp|gif|jpe?g|png|webp)$/i, "");
}

function naturalCompare(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function fileIdentity(file) {
  return `${file.name}::${file.size}::${file.lastModified || 0}`;
}

function setLoading(visible, title = "Abrindo seu quadrinho…", detail = "Lendo as páginas no seu aparelho", progress = 15) {
  dom.loadingOverlay.hidden = !visible;
  dom.loadingTitle.textContent = title;
  dom.loadingDetail.textContent = detail;
  dom.loadingBar.style.width = `${Math.max(4, Math.min(100, progress))}%`;
}

function toast(message, type = "info") {
  const element = document.createElement("div");
  element.className = `toast ${type}`;
  element.textContent = message;
  dom.toastRegion.append(element);
  setTimeout(() => element.remove(), 4200);
}

function loadPrefs() {
  const prefs = { ...defaultPrefs, ...readJson(PREFS_KEY, {}) };
  state.viewMode = prefs.viewMode;
  state.direction = prefs.direction;
  state.fit = prefs.fit;
  state.brightness = prefs.brightness;
  state.contrast = prefs.contrast;
  state.autoHide = prefs.autoHide;
  document.documentElement.dataset.theme = prefs.theme;
  dom.brightnessSlider.value = prefs.brightness;
  dom.contrastSlider.value = prefs.contrast;
  dom.brightnessOutput.value = `${prefs.brightness}%`;
  dom.contrastOutput.value = `${prefs.contrast}%`;
  dom.autoHideToggle.classList.toggle("active", prefs.autoHide);
  dom.autoHideToggle.setAttribute("aria-checked", String(prefs.autoHide));
}

function persistPrefs() {
  saveJson(PREFS_KEY, {
    theme: document.documentElement.dataset.theme || "dark",
    viewMode: state.viewMode,
    direction: state.direction,
    fit: state.fit,
    brightness: state.brightness,
    contrast: state.contrast,
    autoHide: state.autoHide,
  });
}

function historyItems() {
  const items = readJson(HISTORY_KEY, []);
  return Array.isArray(items) ? items : [];
}

function updateHistory() {
  if (!state.reader || !state.fileKey) return;
  const items = historyItems().filter((item) => item.key !== state.fileKey);
  items.unshift({
    key: state.fileKey,
    name: state.reader.name,
    format: state.reader.format,
    size: state.reader.size,
    page: state.pageIndex,
    pages: state.pageCount,
    updatedAt: Date.now(),
  });
  saveJson(HISTORY_KEY, items.slice(0, 12));
  renderHistory();
}

function renderHistory() {
  const items = historyItems();
  dom.recentGrid.replaceChildren();
  dom.clearHistoryButton.hidden = items.length === 0;
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "recent-empty";
    empty.innerHTML = `
      <span class="recent-empty-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M8 20a3 3 0 0 1 0-6h11M9 8h6"/></svg>
      </span>
      <div><strong>Nenhuma leitura recente</strong><span>Seus arquivos nunca são enviados. O histórico fica apenas neste navegador.</span></div>`;
    dom.recentGrid.append(empty);
    return;
  }

  for (const item of items.slice(0, 8)) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "recent-card";
    card.dataset.key = item.key;
    const progress = item.pages ? Math.round(((item.page + 1) / item.pages) * 100) : 0;
    const top = document.createElement("div");
    top.className = "recent-card-top";
    const chip = document.createElement("span");
    chip.className = "format-chip";
    chip.textContent = item.format;
    const date = document.createElement("small");
    date.textContent = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(item.updatedAt);
    top.append(chip, date);
    const title = document.createElement("h3");
    title.textContent = bookName(item.name);
    const bottom = document.createElement("div");
    bottom.className = "recent-card-bottom";
    const bar = document.createElement("span");
    bar.className = "recent-progress";
    const fill = document.createElement("span");
    fill.style.width = `${progress}%`;
    bar.append(fill);
    const page = document.createElement("small");
    page.textContent = `${item.page + 1}/${item.pages}`;
    bottom.append(bar, page);
    card.append(top, title, bottom);
    card.addEventListener("click", () => {
      state.pendingRecent = item;
      dom.fileInput.multiple = false;
      dom.fileInput.click();
    });
    dom.recentGrid.append(card);
  }
}

function createPageCache(loader, disposer) {
  const cache = new Map();
  const pending = new Map();
  const limit = 16;

  async function getPage(index) {
    if (cache.has(index)) {
      const value = cache.get(index);
      cache.delete(index);
      cache.set(index, value);
      return value;
    }
    if (pending.has(index)) return pending.get(index);
    const promise = loader(index).then((value) => {
      pending.delete(index);
      cache.set(index, value);
      while (cache.size > limit) {
        const [oldIndex, oldValue] = cache.entries().next().value;
        cache.delete(oldIndex);
        if (oldIndex !== state.pageIndex && oldIndex !== state.pageIndex + 1) disposer?.(oldValue);
      }
      return value;
    }).catch((error) => {
      pending.delete(index);
      throw error;
    });
    pending.set(index, promise);
    return promise;
  }

  function dispose() {
    cache.forEach((value) => disposer?.(value));
    cache.clear();
    pending.clear();
  }

  return { getPage, dispose };
}

async function createArchiveReader(file) {
  if (!window.LocalUnarchiver) throw new Error("O módulo de arquivos compactados não foi carregado.");
  setLoading(true, "Abrindo o arquivo…", "Verificando o pacote de páginas", 24);
  const archive = await window.LocalUnarchiver.open(file);
  const entries = archive.entries
    .filter((entry) => entry.is_file && imagePattern.test(entry.name) && !/(^|\/)__MACOSX\//i.test(entry.name))
    .sort((a, b) => naturalCompare(a.name, b.name));
  if (!entries.length) {
    window.LocalUnarchiver.close(archive);
    throw new Error("Não encontrei imagens compatíveis dentro desse arquivo.");
  }
  if (entries.length > 2000) {
    window.LocalUnarchiver.close(archive);
    throw new Error("O arquivo tem mais de 2.000 páginas e foi bloqueado para proteger a memória do aparelho.");
  }

  const cache = createPageCache(async (index) => {
    const pageFile = await entries[index].read();
    return URL.createObjectURL(pageFile);
  }, (url) => URL.revokeObjectURL(url));

  return {
    name: file.name,
    format: extensionOf(file.name),
    size: file.size,
    pageCount: entries.length,
    getPage: cache.getPage,
    dispose() {
      cache.dispose();
      window.LocalUnarchiver.close(archive);
    },
  };
}

async function createPdfReader(file) {
  setLoading(true, "Preparando o PDF…", "Carregando o renderizador de páginas", 24);
  const pdfjs = await import("./vendor/pdfjs/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("./vendor/pdfjs/pdf.worker.mjs", import.meta.url).href;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({ data: bytes });
  let passwordRequested = false;
  task.onPassword = () => {
    passwordRequested = true;
    task.destroy();
  };
  let documentProxy;
  try {
    documentProxy = await task.promise;
  } catch (error) {
    if (passwordRequested) throw new Error("Este PDF é protegido por senha e não pode ser aberto nesta versão.");
    throw error;
  }
  if (!documentProxy.numPages) throw new Error("O PDF não contém páginas legíveis.");

  const cache = createPageCache(async (index) => {
    const page = await documentProxy.getPage(index + 1);
    const base = page.getViewport({ scale: 1 });
    const mobile = matchMedia("(max-width: 760px)").matches;
    const targetWidth = mobile ? 1500 : 2200;
    const scale = Math.min(2.6, Math.max(1.2, targetWidth / base.width));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d", { alpha: false });
    await page.render({ canvasContext: context, viewport }).promise;
    page.cleanup();
    const blob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Falha ao renderizar a página.")), "image/webp", 0.94));
    canvas.width = 1;
    canvas.height = 1;
    return URL.createObjectURL(blob);
  }, (url) => URL.revokeObjectURL(url));

  return {
    name: file.name,
    format: "PDF",
    size: file.size,
    pageCount: documentProxy.numPages,
    getPage: cache.getPage,
    dispose() {
      cache.dispose();
      task.destroy();
    },
  };
}

function createImageReader(files) {
  const pages = [...files].filter((file) => file.type.startsWith("image/") || imagePattern.test(file.name));
  pages.sort((a, b) => naturalCompare(a.name, b.name));
  if (!pages.length) throw new Error("Nenhuma imagem compatível foi escolhida.");
  const cache = createPageCache(async (index) => URL.createObjectURL(pages[index]), (url) => URL.revokeObjectURL(url));
  const first = pages[0];
  return {
    name: pages.length === 1 ? first.name : `Seleção com ${pages.length} imagens`,
    format: pages.length === 1 ? extensionOf(first.name) : "IMAGENS",
    size: pages.reduce((sum, file) => sum + file.size, 0),
    pageCount: pages.length,
    getPage: cache.getPage,
    dispose: cache.dispose,
  };
}

async function openFiles(fileList) {
  const files = [...fileList].filter(Boolean);
  if (!files.length) return;
  const first = files[0];
  const allImages = files.every((file) => file.type.startsWith("image/") || imagePattern.test(file.name));
  let reader;
  setLoading(true);

  try {
    state.reader?.dispose?.();
    state.reader = null;
    state.guidedCache.clear();
    if (allImages) {
      reader = createImageReader(files);
    } else if (/\.pdf$/i.test(first.name) || first.type === "application/pdf") {
      reader = await createPdfReader(first);
    } else if (archivePattern.test(first.name)) {
      reader = await createArchiveReader(first);
    } else {
      throw new Error("Formato não reconhecido. Use CBR, CBZ, ZIP, PDF, JPG, PNG, WEBP ou AVIF.");
    }

    state.reader = reader;
    state.fileKey = allImages && files.length > 1
      ? `images::${files.map(fileIdentity).join("|")}`
      : fileIdentity(first);
    state.pageCount = reader.pageCount;
    const saved = historyItems().find((item) => item.key === state.fileKey);
    const requested = state.pendingRecent?.key === state.fileKey ? state.pendingRecent : saved;
    state.pageIndex = Math.min(requested?.page || 0, reader.pageCount - 1);
    state.pendingRecent = null;
    state.zoom = 1;
    state.rotation = 0;
    state.pageAspect = null;
    setLoading(true, "Montando o leitor…", `${reader.pageCount} ${reader.pageCount === 1 ? "página encontrada" : "páginas encontradas"}`, 76);
    await showReader();
    setLoading(false);
  } catch (error) {
    console.error(error);
    reader?.dispose?.();
    state.pendingRecent = null;
    setLoading(false);
    const detail = error?.message || "Não foi possível abrir esse arquivo.";
    toast(detail, "error");
  } finally {
    dom.fileInput.value = "";
    dom.fileInput.multiple = true;
  }
}

async function showReader() {
  document.body.classList.add("reader-open");
  dom.homeView.hidden = true;
  dom.readerView.hidden = false;
  dom.bookTitle.textContent = bookName(state.reader.name);
  dom.bookMeta.textContent = `${state.reader.format} · ${formatBytes(state.reader.size)} · leitura local`;
  dom.pageSlider.max = String(state.pageCount);
  dom.footerTotalPages.textContent = String(state.pageCount);
  buildThumbnails();
  applyPreferencesToUi();
  await setViewMode(state.viewMode, false);
  await setPage(state.pageIndex, { save: false });
  updateHistory();
  resetControlsTimer();
}

function closeReader() {
  closeGuidedMode();
  closeSettings();
  updateHistory();
  state.reader?.dispose?.();
  state.reader = null;
  state.fileKey = null;
  state.pageCount = 0;
  state.guidedCache.clear();
  state.scrollObserver?.disconnect();
  cancelAnimationFrame(state.scrollFrame);
  state.thumbnailObserver?.disconnect();
  document.body.classList.remove("reader-open");
  dom.readerView.hidden = true;
  dom.homeView.hidden = false;
  renderHistory();
}

function imageLoaded(image) {
  if (image.complete && image.naturalWidth) return Promise.resolve();
  return new Promise((resolve, reject) => {
    image.addEventListener("load", resolve, { once: true });
    image.addEventListener("error", () => reject(new Error("Não foi possível mostrar esta página.")), { once: true });
  });
}

async function renderPagedView() {
  if (!state.reader) return;
  const token = ++state.renderToken;
  dom.pageStage.hidden = false;
  dom.scrollPages.hidden = true;
  const firstUrl = await state.reader.getPage(state.pageIndex);
  if (token !== state.renderToken) return;
  dom.pageImage.src = firstUrl;
  await imageLoaded(dom.pageImage);
  if (token !== state.renderToken) return;
  state.pageAspect = dom.pageImage.naturalWidth / dom.pageImage.naturalHeight;

  const showSecond = state.viewMode === "double" && state.pageIndex + 1 < state.pageCount;
  dom.secondPageShell.hidden = !showSecond;
  dom.pageStage.classList.toggle("double-mode", showSecond);
  if (showSecond) {
    const secondUrl = await state.reader.getPage(state.pageIndex + 1);
    if (token !== state.renderToken) return;
    dom.secondPageImage.src = secondUrl;
    await imageLoaded(dom.secondPageImage);
  } else {
    dom.secondPageImage.removeAttribute("src");
  }

  applyPageVisuals();
  preloadAround(state.pageIndex);
}

async function ensurePageAspect() {
  if (state.pageAspect || !state.reader) return;
  const url = await state.reader.getPage(state.pageIndex);
  const probe = new Image();
  probe.decoding = "async";
  probe.src = url;
  await imageLoaded(probe);
  state.pageAspect = probe.naturalWidth / probe.naturalHeight;
}

function loadScrollPage(shell) {
  const image = $("img", shell);
  const index = Number(shell.dataset.index);
  if (image.dataset.loading === "true" || image.dataset.loaded === "true") return;
  image.dataset.loading = "true";
  state.reader.getPage(index).then((url) => {
    if (!shell.isConnected || state.viewMode !== "scroll") return;
    image.src = url;
    image.dataset.loaded = "true";
  }).catch(() => {
    image.removeAttribute("src");
  }).finally(() => {
    image.dataset.loading = "false";
  });
}

function unloadDistantScrollPage(shell) {
  const index = Number(shell.dataset.index);
  if (Math.abs(index - state.pageIndex) <= 4) return;
  const image = $("img", shell);
  image.removeAttribute("src");
  delete image.dataset.loaded;
}

function updateScrollPosition() {
  state.scrollFrame = null;
  if (state.viewMode !== "scroll" || !state.reader) return;
  const viewportRect = dom.readerViewport.getBoundingClientRect();
  const readingLine = viewportRect.top + viewportRect.height * 0.42;
  let closest = null;
  let closestDistance = Infinity;

  for (const shell of $$(".scroll-page-shell", dom.scrollPages)) {
    const rect = shell.getBoundingClientRect();
    const containsLine = rect.top <= readingLine && rect.bottom >= readingLine;
    const distance = containsLine ? 0 : Math.min(Math.abs(rect.top - readingLine), Math.abs(rect.bottom - readingLine));
    if (distance < closestDistance) {
      closest = shell;
      closestDistance = distance;
      if (containsLine) break;
    }
  }

  if (!closest) return;
  const index = Number(closest.dataset.index);
  if (index === state.pageIndex) return;
  state.pageIndex = index;
  updatePageControls();
  scheduleHistorySave();
}

function scheduleScrollPositionUpdate() {
  if (state.scrollFrame || state.viewMode !== "scroll") return;
  state.scrollFrame = requestAnimationFrame(updateScrollPosition);
}

function scrollToPageShell(index, behavior = "auto") {
  const target = $(`.scroll-page-shell[data-index="${index}"]`, dom.scrollPages);
  if (!target) return;
  const viewportRect = dom.readerViewport.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const top = dom.readerViewport.scrollTop + targetRect.top - viewportRect.top;
  dom.readerViewport.scrollTo({ left: 0, top: Math.max(0, top), behavior });
}

function buildScrollView() {
  state.scrollObserver?.disconnect();
  dom.scrollPages.replaceChildren();
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < state.pageCount; index += 1) {
    const shell = document.createElement("div");
    shell.className = "scroll-page-shell";
    shell.dataset.index = String(index);
    shell.style.setProperty("--page-aspect", state.pageAspect || 2 / 3);
    const image = document.createElement("img");
    image.alt = `Página ${index + 1}`;
    image.loading = "lazy";
    image.decoding = "async";
    shell.append(image);
    fragment.append(shell);
  }
  dom.scrollPages.append(fragment);

  state.scrollObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) loadScrollPage(entry.target);
      else unloadDistantScrollPage(entry.target);
    }
  }, { root: dom.readerViewport, rootMargin: "160% 0px", threshold: 0.01 });
  $$(".scroll-page-shell", dom.scrollPages).forEach((shell) => state.scrollObserver.observe(shell));
}

async function renderScrollView() {
  dom.pageStage.hidden = true;
  dom.scrollPages.hidden = false;
  await ensurePageAspect();
  if (!dom.scrollPages.childElementCount) buildScrollView();
  [state.pageIndex - 1, state.pageIndex, state.pageIndex + 1]
    .filter((index) => index >= 0 && index < state.pageCount)
    .forEach((index) => {
      const shell = $(`.scroll-page-shell[data-index="${index}"]`, dom.scrollPages);
      if (shell) loadScrollPage(shell);
    });
  requestAnimationFrame(() => {
    scrollToPageShell(state.pageIndex);
    scheduleScrollPositionUpdate();
  });
}

async function setPage(index, options = {}) {
  if (!state.reader) return;
  const step = state.viewMode === "double" ? 2 : 1;
  state.pageIndex = Math.max(0, Math.min(state.pageCount - 1, Number(index) || 0));
  if (state.viewMode === "double") state.pageIndex = Math.floor(state.pageIndex / step) * step;
  closeGuidedMode();
  if (state.viewMode === "scroll") {
    if (!dom.scrollPages.childElementCount) await renderScrollView();
    scrollToPageShell(state.pageIndex, options.smooth ? "smooth" : "auto");
  } else {
    await renderPagedView();
    dom.readerViewport.scrollTo({ left: 0, top: 0 });
  }
  updatePageControls();
  if (options.save !== false) scheduleHistorySave();
}

function nextPage() {
  const amount = state.viewMode === "double" ? 2 : 1;
  if (state.pageIndex >= state.pageCount - 1) {
    toast("Você chegou ao fim desta leitura.");
    return;
  }
  setPage(state.pageIndex + amount, { smooth: state.viewMode === "scroll" });
}

function previousPage() {
  const amount = state.viewMode === "double" ? 2 : 1;
  if (state.pageIndex <= 0) return;
  setPage(state.pageIndex - amount, { smooth: state.viewMode === "scroll" });
}

function updatePageControls() {
  const current = state.pageIndex + 1;
  dom.pageSlider.value = String(current);
  dom.footerCurrentPage.textContent = String(current);
  const max = Math.max(1, state.pageCount - 1);
  const value = state.pageCount <= 1 ? 0 : (state.pageIndex / max) * 100;
  dom.pageSlider.style.setProperty("--range-value", `${value}%`);
  $$(".thumbnail-button", dom.thumbnailList).forEach((button) => {
    const active = Number(button.dataset.index) === state.pageIndex;
    button.classList.toggle("active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  });
}

let historyTimer;
function scheduleHistorySave() {
  clearTimeout(historyTimer);
  historyTimer = setTimeout(updateHistory, 450);
}

function preloadAround(index) {
  [index - 1, index + 1, index + 2]
    .filter((page) => page >= 0 && page < state.pageCount)
    .forEach((page) => state.reader.getPage(page).catch(() => {}));
}

function buildThumbnails() {
  state.thumbnailObserver?.disconnect();
  dom.thumbnailList.replaceChildren();
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < state.pageCount; index += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "thumbnail-button";
    button.dataset.index = String(index);
    button.setAttribute("aria-label", `Ir para a página ${index + 1}`);
    const image = document.createElement("img");
    image.alt = "";
    image.loading = "lazy";
    const number = document.createElement("span");
    number.textContent = String(index + 1);
    button.append(image, number);
    button.addEventListener("click", () => {
      setPage(index);
      dom.thumbnailRail.classList.remove("mobile-open");
    });
    fragment.append(button);
  }
  dom.thumbnailList.append(fragment);
  state.thumbnailObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const button = entry.target;
      const image = $("img", button);
      if (!image.src) state.reader.getPage(Number(button.dataset.index)).then((url) => { image.src = url; }).catch(() => {});
    }
  }, { root: dom.thumbnailList, rootMargin: "220px 0px" });
  $$(".thumbnail-button", dom.thumbnailList).forEach((button) => state.thumbnailObserver.observe(button));
}

async function setViewMode(mode, rerender = true) {
  if (!['single', 'double', 'scroll'].includes(mode)) return;
  if (mode === "double" && matchMedia("(max-width: 760px)").matches) {
    mode = "single";
    toast("No celular, a página única mantém o quadrinho legível. Gire a tela para usar página dupla.");
  }
  if (state.guidedActive) closeGuidedMode();
  state.viewMode = mode;
  state.zoom = 1;
  state.scrollObserver?.disconnect();
  dom.scrollPages.replaceChildren();
  dom.readerViewport.classList.toggle("scroll-mode", mode === "scroll");
  dom.pageStage.classList.toggle("manga-order", state.direction === "rtl");
  $$('[data-view-mode]').forEach((button) => button.classList.toggle("active", button.dataset.viewMode === mode));
  persistPrefs();
  if (rerender && state.reader) {
    if (mode === "scroll") await renderScrollView();
    else await renderPagedView();
    updatePageControls();
  }
}

function setDirection(direction) {
  state.direction = direction;
  dom.directionLtr.classList.toggle("active", direction === "ltr");
  dom.directionRtl.classList.toggle("active", direction === "rtl");
  dom.pageStage.classList.toggle("manga-order", direction === "rtl");
  state.guidedCache.clear();
  persistPrefs();
}

function setFit(fit) {
  if (!["page", "width", "original"].includes(fit)) return;
  state.fit = fit;
  dom.pageStage.classList.remove("fit-page", "fit-width", "fit-original");
  dom.pageStage.classList.add(`fit-${fit}`);
  $$('[data-fit]').forEach((button) => button.classList.toggle("active", button.dataset.fit === fit));
  dom.fitLabel.textContent = fit === "page" ? "Ajustar" : fit === "width" ? "Largura" : "Original";
  persistPrefs();
}

function cycleFit() {
  const order = ["page", "width", "original"];
  setFit(order[(order.indexOf(state.fit) + 1) % order.length]);
}

function setZoom(value) {
  if (state.viewMode === "scroll") return;
  state.zoom = Math.max(0.5, Math.min(5, Math.round(value * 20) / 20));
  dom.pageStage.style.setProperty("--zoom", state.zoom);
  dom.zoomValueButton.textContent = `${Math.round(state.zoom * 100)}%`;
}

function applyPageVisuals() {
  dom.pageStage.style.setProperty("--zoom", state.zoom);
  dom.pageStage.style.setProperty("--rotation", `${state.rotation}deg`);
  dom.pageStage.style.setProperty("--brightness", state.brightness / 100);
  dom.pageStage.style.setProperty("--contrast", state.contrast / 100);
  dom.scrollPages.style.setProperty("--brightness", state.brightness / 100);
  dom.scrollPages.style.setProperty("--contrast", state.contrast / 100);
  dom.zoomValueButton.textContent = `${Math.round(state.zoom * 100)}%`;
}

function applyPreferencesToUi() {
  setFit(state.fit);
  setDirection(state.direction);
  $$('[data-view-mode]').forEach((button) => button.classList.toggle("active", button.dataset.viewMode === state.viewMode));
  applyPageVisuals();
}

function rotatePage() {
  state.rotation = (state.rotation + 90) % 360;
  applyPageVisuals();
}

function openSettings() {
  dom.settingsBackdrop.hidden = false;
  dom.settingsSheet.hidden = false;
}

function closeSettings() {
  dom.settingsBackdrop.hidden = true;
  dom.settingsSheet.hidden = true;
}

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) await dom.readerView.requestFullscreen();
    else await document.exitFullscreen();
  } catch {
    toast("A tela cheia não está disponível neste navegador.", "error");
  }
}

function resetControlsTimer() {
  clearTimeout(state.controlsTimer);
  dom.readerView.classList.remove("controls-hidden");
  if (!state.autoHide || state.guidedActive || dom.readerView.hidden) return;
  state.controlsTimer = setTimeout(() => dom.readerView.classList.add("controls-hidden"), 3200);
}

function guidedCacheKey() {
  return `${state.pageIndex}:${state.direction}`;
}

async function startGuidedMode() {
  if (!state.reader) return;
  if (state.guidedActive) {
    nextGuidedRegion();
    return;
  }
  if (state.viewMode !== "single") await setViewMode("single");
  setZoom(1);
  state.rotation = 0;
  applyPageVisuals();
  await renderPagedView();
  setLoading(true, "Procurando as falas…", "Analisando esta página apenas no seu aparelho", 48);
  try {
    const key = guidedCacheKey();
    let regions = state.guidedCache.get(key);
    if (!regions) {
      regions = await detectSpeechRegions(dom.pageImage, state.direction);
      state.guidedCache.set(key, regions);
    }
    setLoading(false);
    if (!regions.length) {
      dom.emptyDetection.hidden = false;
      return;
    }
    state.guidedRegions = regions;
    state.guidedRegionIndex = 0;
    state.guidedActive = true;
    state.guidedView = null;
    dom.guidedLayer.hidden = false;
    dom.guidedButton.classList.add("active");
    dom.guidedButtonLabel.textContent = "Próxima fala";
    dom.mobileGuidedButton.classList.add("active");
    dom.readerView.classList.remove("controls-hidden");
    drawGuidedRegion();
  } catch (error) {
    setLoading(false);
    console.error(error);
    toast("Não consegui analisar as falas desta página. Você ainda pode marcar uma área manualmente.", "error");
    dom.emptyDetection.hidden = false;
  }
}

function roundedRectPath(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

function paintGuidedView(view, region) {
  if (!state.guidedActive || !state.guidedRegions.length) return;
  const canvas = dom.guidedCanvas;
  const bounds = dom.guidedLayer.getBoundingClientRect();
  const dpr = Math.min(isMobileLayout() ? 1.5 : 2, devicePixelRatio || 1);
  const pixelWidth = Math.max(1, Math.floor(bounds.width * dpr));
  const pixelHeight = Math.max(1, Math.floor(bounds.height * dpr));
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
  const context = canvas.getContext("2d", { alpha: false });
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.fillStyle = "#040506";
  context.fillRect(0, 0, bounds.width, bounds.height);

  const overview = overviewGuidedView(bounds);
  context.save();
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.filter = `brightness(${state.brightness}%) contrast(${state.contrast}%)`;
  context.drawImage(
    dom.pageImage,
    overview.x,
    overview.y,
    dom.pageImage.naturalWidth * overview.scale,
    dom.pageImage.naturalHeight * overview.scale,
  );
  context.restore();
  context.fillStyle = "rgba(0,0,0,.2)";
  context.fillRect(0, 0, bounds.width, bounds.height);

  const mobile = isMobileLayout();
  const topInset = mobile ? 58 : 54;
  const bottomInset = mobile ? 76 : 70;
  const usableHeight = Math.max(140, bounds.height - topInset - bottomInset);
  const lensWidth = Math.min(bounds.width - (mobile ? 20 : 44), bounds.width * (mobile ? 0.94 : 0.8));
  const focusedHeight = region.height * view.scale;
  const lensHeight = Math.min(
    usableHeight * (mobile ? 0.62 : 0.58),
    Math.max(mobile ? 176 : 210, focusedHeight * 1.9 + 36),
  );
  const lensX = (bounds.width - lensWidth) / 2;
  const lensY = topInset + (usableHeight - lensHeight) * 0.48;
  const lensRadius = mobile ? 18 : 22;

  context.save();
  context.shadowColor = "rgba(0,0,0,.78)";
  context.shadowBlur = 30;
  context.fillStyle = "#050608";
  roundedRectPath(context, lensX, lensY, lensWidth, lensHeight, lensRadius);
  context.fill();
  context.restore();

  context.save();
  roundedRectPath(context, lensX, lensY, lensWidth, lensHeight, lensRadius);
  context.clip();
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.filter = `brightness(${state.brightness}%) contrast(${state.contrast}%)`;
  context.drawImage(
    dom.pageImage,
    view.x,
    view.y,
    dom.pageImage.naturalWidth * view.scale,
    dom.pageImage.naturalHeight * view.scale,
  );
  const focusX = view.x + region.x * view.scale;
  const focusY = view.y + region.y * view.scale;
  const focusWidth = region.width * view.scale;
  const focusHeight = region.height * view.scale;
  context.filter = "none";
  context.strokeStyle = "rgba(216,255,72,.82)";
  context.lineWidth = 2;
  context.shadowColor = "rgba(216,255,72,.42)";
  context.shadowBlur = 14;
  context.strokeRect(focusX - 5, focusY - 5, focusWidth + 10, focusHeight + 10);
  context.restore();

  context.save();
  context.strokeStyle = "rgba(255,255,255,.22)";
  context.lineWidth = 1;
  roundedRectPath(context, lensX + 0.5, lensY + 0.5, lensWidth - 1, lensHeight - 1, lensRadius);
  context.stroke();
  context.restore();
}

function overviewGuidedView(bounds) {
  const sourceWidth = dom.pageImage.naturalWidth;
  const sourceHeight = dom.pageImage.naturalHeight;
  const scale = Math.min(bounds.width / sourceWidth, bounds.height / sourceHeight) * 0.96;
  return {
    scale,
    x: (bounds.width - sourceWidth * scale) / 2,
    y: (bounds.height - sourceHeight * scale) / 2,
  };
}

function drawGuidedRegion(options = {}) {
  if (!state.guidedActive || !state.guidedRegions.length) return;
  const region = state.guidedRegions[state.guidedRegionIndex];
  const bounds = dom.guidedLayer.getBoundingClientRect();
  const target = calculateGuidedViewport(
    dom.pageImage.naturalWidth,
    dom.pageImage.naturalHeight,
    bounds.width,
    bounds.height,
    region,
    { mobile: isMobileLayout() },
  );
  const start = state.guidedView || overviewGuidedView(bounds);
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const duration = options.animate === false || reducedMotion ? 0 : 320;
  const startedAt = performance.now();
  cancelAnimationFrame(state.guidedAnimationFrame);

  const frame = (now) => {
    const progress = duration ? Math.min(1, (now - startedAt) / duration) : 1;
    const eased = 1 - (1 - progress) ** 3;
    const view = {
      scale: start.scale + (target.scale - start.scale) * eased,
      x: start.x + (target.x - start.x) * eased,
      y: start.y + (target.y - start.y) * eased,
    };
    paintGuidedView(view, region);
    if (progress < 1) state.guidedAnimationFrame = requestAnimationFrame(frame);
    else {
      state.guidedAnimationFrame = null;
      state.guidedView = target;
    }
  };
  state.guidedAnimationFrame = requestAnimationFrame(frame);

  dom.guidedCounter.textContent = `${state.guidedRegionIndex + 1} de ${state.guidedRegions.length}`;
  dom.guidedHelp.textContent = state.guidedRegionIndex + 1 === state.guidedRegions.length
    ? "Última fala desta página · a arte ao redor continua visível"
    : "A página continua inteira · avance para aproximar a próxima fala";
}

async function nextGuidedRegion() {
  if (!state.guidedActive) return startGuidedMode();
  if (state.guidedRegionIndex < state.guidedRegions.length - 1) {
    state.guidedRegionIndex += 1;
    drawGuidedRegion();
    return;
  }
  if (state.pageIndex >= state.pageCount - 1) {
    toast("Fim do quadrinho. Boa leitura!");
    closeGuidedMode();
    return;
  }
  closeGuidedMode();
  await setPage(state.pageIndex + 1);
  await startGuidedMode();
}

function previousGuidedRegion() {
  if (!state.guidedActive) return;
  if (state.guidedRegionIndex > 0) {
    state.guidedRegionIndex -= 1;
    drawGuidedRegion();
  }
}

function closeGuidedMode() {
  cancelAnimationFrame(state.guidedAnimationFrame);
  state.guidedAnimationFrame = null;
  state.guidedView = null;
  state.guidedActive = false;
  state.guidedRegions = [];
  state.guidedRegionIndex = 0;
  dom.guidedLayer.hidden = true;
  dom.emptyDetection.hidden = true;
  dom.guidedButton.classList.remove("active");
  dom.guidedButtonLabel.textContent = "Modo Falas";
  dom.mobileGuidedButton.classList.remove("active");
  cancelManualRegion();
}

function startManualRegion() {
  dom.emptyDetection.hidden = true;
  dom.guidedLayer.hidden = true;
  state.manualMode = true;
  state.manualStart = null;
  dom.readerViewport.classList.add("manual-mode");
  dom.manualSelection.hidden = true;
}

function cancelManualRegion() {
  state.manualMode = false;
  state.manualStart = null;
  dom.readerViewport.classList.remove("manual-mode");
  dom.manualSelection.hidden = true;
}

function pointInImage(event) {
  const rect = dom.pageImage.getBoundingClientRect();
  const x = Math.max(rect.left, Math.min(rect.right, event.clientX));
  const y = Math.max(rect.top, Math.min(rect.bottom, event.clientY));
  return { x, y, rect };
}

function manualPointerDown(event) {
  if (!state.manualMode || event.button !== 0) return;
  const point = pointInImage(event);
  if (event.clientX < point.rect.left || event.clientX > point.rect.right || event.clientY < point.rect.top || event.clientY > point.rect.bottom) return;
  event.preventDefault();
  state.manualStart = point;
  dom.manualSelection.hidden = false;
  dom.manualSelection.style.left = `${point.x}px`;
  dom.manualSelection.style.top = `${point.y}px`;
  dom.manualSelection.style.width = "0px";
  dom.manualSelection.style.height = "0px";
  dom.readerViewport.setPointerCapture?.(event.pointerId);
}

function manualPointerMove(event) {
  if (!state.manualMode || !state.manualStart) return;
  const point = pointInImage(event);
  const left = Math.min(state.manualStart.x, point.x);
  const top = Math.min(state.manualStart.y, point.y);
  dom.manualSelection.style.left = `${left}px`;
  dom.manualSelection.style.top = `${top}px`;
  dom.manualSelection.style.width = `${Math.abs(point.x - state.manualStart.x)}px`;
  dom.manualSelection.style.height = `${Math.abs(point.y - state.manualStart.y)}px`;
}

function manualPointerUp(event) {
  if (!state.manualMode || !state.manualStart) return;
  const end = pointInImage(event);
  const start = state.manualStart;
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);
  if (width < 20 || height < 16) {
    toast("Arraste uma área maior ao redor da fala.");
    cancelManualRegion();
    return;
  }
  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const scaleX = dom.pageImage.naturalWidth / start.rect.width;
  const scaleY = dom.pageImage.naturalHeight / start.rect.height;
  const region = {
    x: (left - start.rect.left) * scaleX,
    y: (top - start.rect.top) * scaleY,
    width: width * scaleX,
    height: height * scaleY,
    confidence: 1,
  };
  const existing = state.guidedCache.get(guidedCacheKey()) || [];
  const regions = sortRegions([...existing, region], state.direction);
  state.guidedCache.set(guidedCacheKey(), regions);
  state.guidedRegions = regions;
  state.guidedRegionIndex = regions.indexOf(region);
  state.guidedActive = true;
  state.guidedView = null;
  cancelManualRegion();
  dom.guidedLayer.hidden = false;
  dom.guidedButton.classList.add("active");
  dom.guidedButtonLabel.textContent = "Próxima fala";
  drawGuidedRegion();
}

function bindEvents() {
  const chooseFile = () => {
    state.pendingRecent = null;
    dom.fileInput.multiple = true;
    dom.fileInput.click();
  };
  dom.openButton.addEventListener("click", (event) => { event.stopPropagation(); chooseFile(); });
  dom.dropZone.addEventListener("click", chooseFile);
  dom.dropZone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); chooseFile(); }
  });
  ["dragenter", "dragover"].forEach((name) => dom.dropZone.addEventListener(name, (event) => {
    event.preventDefault();
    dom.dropZone.classList.add("dragging");
  }));
  ["dragleave", "drop"].forEach((name) => dom.dropZone.addEventListener(name, (event) => {
    event.preventDefault();
    dom.dropZone.classList.remove("dragging");
  }));
  dom.dropZone.addEventListener("drop", (event) => openFiles(event.dataTransfer.files));
  dom.fileInput.addEventListener("change", () => openFiles(dom.fileInput.files));

  dom.themeButton.addEventListener("click", () => {
    document.documentElement.dataset.theme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    persistPrefs();
  });
  dom.clearHistoryButton.addEventListener("click", () => {
    if (confirm("Limpar o histórico de leitura deste navegador?")) {
      saveJson(HISTORY_KEY, []);
      renderHistory();
    }
  });
  dom.closeReaderButton.addEventListener("click", closeReader);
  [dom.previousPageZone, dom.footerPreviousButton, dom.mobilePreviousButton].forEach((button) => button.addEventListener("click", previousPage));
  [dom.nextPageZone, dom.footerNextButton, dom.mobileNextButton].forEach((button) => button.addEventListener("click", nextPage));
  dom.pageSlider.addEventListener("input", () => setPage(Number(dom.pageSlider.value) - 1));
  dom.zoomOutButton.addEventListener("click", () => setZoom(state.zoom - 0.2));
  dom.zoomInButton.addEventListener("click", () => setZoom(state.zoom + 0.2));
  dom.zoomValueButton.addEventListener("click", () => setZoom(1));
  dom.fitButton.addEventListener("click", cycleFit);
  dom.rotateButton.addEventListener("click", rotatePage);
  [dom.guidedButton, dom.mobileGuidedButton].forEach((button) => button.addEventListener("click", startGuidedMode));
  dom.fullscreenButton.addEventListener("click", toggleFullscreen);
  [dom.settingsButton, dom.mobileSettingsButton].forEach((button) => button.addEventListener("click", openSettings));
  [dom.closeSettingsButton, dom.settingsBackdrop].forEach((element) => element.addEventListener("click", closeSettings));
  dom.thumbnailToggle.addEventListener("click", () => dom.thumbnailRail.classList.toggle("collapsed"));
  dom.mobileThumbsButton.addEventListener("click", () => dom.thumbnailRail.classList.toggle("mobile-open"));
  $$('[data-view-mode]').forEach((button) => button.addEventListener("click", () => setViewMode(button.dataset.viewMode)));
  $$('[data-fit]').forEach((button) => button.addEventListener("click", () => setFit(button.dataset.fit)));
  dom.directionLtr.addEventListener("click", () => setDirection("ltr"));
  dom.directionRtl.addEventListener("click", () => setDirection("rtl"));
  dom.brightnessSlider.addEventListener("input", () => {
    state.brightness = Number(dom.brightnessSlider.value);
    dom.brightnessOutput.value = `${state.brightness}%`;
    applyPageVisuals();
    persistPrefs();
  });
  dom.contrastSlider.addEventListener("input", () => {
    state.contrast = Number(dom.contrastSlider.value);
    dom.contrastOutput.value = `${state.contrast}%`;
    applyPageVisuals();
    persistPrefs();
  });
  dom.autoHideToggle.addEventListener("click", () => {
    state.autoHide = !state.autoHide;
    dom.autoHideToggle.classList.toggle("active", state.autoHide);
    dom.autoHideToggle.setAttribute("aria-checked", String(state.autoHide));
    persistPrefs();
    resetControlsTimer();
  });

  dom.closeGuidedButton.addEventListener("click", closeGuidedMode);
  dom.guidedPreviousButton.addEventListener("click", previousGuidedRegion);
  dom.guidedNextButton.addEventListener("click", nextGuidedRegion);
  dom.manualRegionButton.addEventListener("click", startManualRegion);
  dom.startManualButton.addEventListener("click", startManualRegion);
  dom.guidedCanvas.addEventListener("click", (event) => {
    if (event.clientX < innerWidth * 0.35) previousGuidedRegion();
    else nextGuidedRegion();
  });
  dom.readerViewport.addEventListener("pointerdown", manualPointerDown);
  dom.readerViewport.addEventListener("pointermove", manualPointerMove);
  dom.readerViewport.addEventListener("pointerup", manualPointerUp);
  dom.readerViewport.addEventListener("pointercancel", cancelManualRegion);

  dom.readerViewport.addEventListener("wheel", (event) => {
    if ((event.ctrlKey || event.metaKey) && state.viewMode !== "scroll") {
      event.preventDefault();
      setZoom(state.zoom + (event.deltaY < 0 ? 0.15 : -0.15));
    }
  }, { passive: false });

  dom.readerViewport.addEventListener("touchstart", (event) => {
    resetControlsTimer();
    if (event.touches.length === 2) {
      state.touch.pinchDistance = Math.hypot(
        event.touches[0].clientX - event.touches[1].clientX,
        event.touches[0].clientY - event.touches[1].clientY,
      );
      state.touch.pinchZoom = state.zoom;
      return;
    }
    const touch = event.touches[0];
    state.touch.startX = touch.clientX;
    state.touch.startY = touch.clientY;
    state.touch.startTime = Date.now();
  }, { passive: true });

  dom.readerViewport.addEventListener("touchmove", (event) => {
    if (event.touches.length !== 2 || state.viewMode === "scroll") return;
    event.preventDefault();
    const distance = Math.hypot(
      event.touches[0].clientX - event.touches[1].clientX,
      event.touches[0].clientY - event.touches[1].clientY,
    );
    if (state.touch.pinchDistance) setZoom(state.touch.pinchZoom * (distance / state.touch.pinchDistance));
  }, { passive: false });

  dom.readerViewport.addEventListener("touchend", (event) => {
    if (state.viewMode === "scroll" || state.zoom > 1.1 || event.changedTouches.length !== 1) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - state.touch.startX;
    const dy = touch.clientY - state.touch.startY;
    const elapsed = Date.now() - state.touch.startTime;
    if (elapsed < 500 && Math.abs(dx) > 52 && Math.abs(dx) > Math.abs(dy) * 1.35) {
      if ((dx < 0 && state.direction === "ltr") || (dx > 0 && state.direction === "rtl")) nextPage();
      else previousPage();
    }
  }, { passive: true });

  dom.readerViewport.addEventListener("dblclick", () => setZoom(state.zoom > 1.1 ? 1 : 2.25));
  dom.readerViewport.addEventListener("scroll", scheduleScrollPositionUpdate, { passive: true });
  dom.readerView.addEventListener("pointermove", resetControlsTimer);
  dom.readerView.addEventListener("pointerdown", resetControlsTimer);
  const redrawGuidedAfterResize = () => {
    if (!state.guidedActive) return;
    state.guidedView = null;
    drawGuidedRegion({ animate: false });
  };
  addEventListener("resize", redrawGuidedAfterResize);
  window.visualViewport?.addEventListener("resize", redrawGuidedAfterResize);

  document.addEventListener("keydown", (event) => {
    if (dom.readerView.hidden || ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
    resetControlsTimer();
    if (event.key === "Escape") {
      if (state.guidedActive || state.manualMode) closeGuidedMode();
      else if (!dom.settingsSheet.hidden) closeSettings();
      return;
    }
    if (event.key.toLowerCase() === "f") { event.preventDefault(); startGuidedMode(); }
    else if (event.key === "ArrowRight") state.direction === "ltr" ? nextPage() : previousPage();
    else if (event.key === "ArrowLeft") state.direction === "ltr" ? previousPage() : nextPage();
    else if (event.key === "PageDown" || event.key === " ") { event.preventDefault(); nextPage(); }
    else if (event.key === "PageUp") previousPage();
    else if (event.key === "+" || event.key === "=") setZoom(state.zoom + 0.2);
    else if (event.key === "-") setZoom(state.zoom - 0.2);
    else if (event.key === "0") setZoom(1);
  });
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

loadPrefs();
renderHistory();
bindEvents();
registerServiceWorker();
