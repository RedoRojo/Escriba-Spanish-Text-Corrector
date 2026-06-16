/* ── DOM refs ── */
const textInput = document.getElementById('text-input');
const counter = document.getElementById('counter');
const analyzeBtn = document.getElementById('analyze-btn');
const errorMessage = document.getElementById('error-message');
const loading = document.getElementById('loading');
const resultsSection = document.getElementById('results-section');
const manuscript = document.getElementById('manuscript');
const textContent = document.getElementById('text-content');
const progressLabel = document.getElementById('progress-label');
const progressFill = document.getElementById('progress-fill');
const finalSection = document.getElementById('final-section');
const finalText = document.getElementById('final-text');
const copyBtn = document.getElementById('copy-btn');
const emptyState = document.getElementById('empty-state');

const popover = document.getElementById('error-popover');
const popoverType = document.getElementById('popover-type');
const popoverErrNum = document.getElementById('popover-err-num');
const popoverOriginal = document.getElementById('popover-original');
const popoverCorrection = document.getElementById('popover-correction');
const popoverExplanation = document.getElementById('popover-explanation');
const popoverAccept = document.getElementById('popover-accept');
const popoverIgnore = document.getElementById('popover-ignore');

/* ── Error type registry (populated from API on load) ── */
let errorTypeRegistry = {};
/* ── State ── */
let currentText = '';
let errors = [];
let errorStates = [];       // { status: 'pending'|'accepted'|'ignored', error }
let errorPositions = [];    // { start, end, index }
let activeErrorIndex = -1;


function labelFor(type) {
  return (errorTypeRegistry[type] && errorTypeRegistry[type].label) || type;
}
function colorsFor(type) {
  return errorTypeRegistry[type] || { badge_bg: '#FEE2E2', badge_text: '#DC2626', dot: '#DC2626' };
}

/* ── Init: fetch error types from API ── */
async function initErrorTypes() {
  try {
    const res = await fetch('/error-types');
    if (res.ok) {
      const data = await res.json();
      for (const t of data.types) {
        errorTypeRegistry[t.type] = { label: t.label, colors: t.colors };
      }
    }
  } catch (_) { /* use defaults */ }
}

/* ── Events ── */
textInput.addEventListener('input', updateCounter);
analyzeBtn.addEventListener('click', handleAnalyze);
copyBtn.addEventListener('click', handleCopy);
popoverAccept.addEventListener('click', () => resolveError('accepted'));
popoverIgnore.addEventListener('click', () => resolveError('ignored'));
document.addEventListener('click', handleDocClick);

initErrorTypes();

/* ── Counter ── */
function updateCounter() {
  counter.textContent = `${textInput.value.length} caracteres`;
}

/* ── Validation ── */
function showError(msg) {
  errorMessage.textContent = msg;
  errorMessage.classList.remove('hidden');
}

function validate() {
  const text = textInput.value.trim();
  if (text.length < 20) {
    showError(`Mínimo 20 caracteres (tiene ${text.length})`);
    return null;
  }
  if (text.length > 5000) {
    showError(`Máximo 5000 caracteres (tiene ${text.length})`);
    return null;
  }
  errorMessage.classList.add('hidden');
  return text;
}

/* ── Analyze ── */
async function handleAnalyze() {
  const text = validate();
  if (!text) return;

  setLoading(true);
  resultsSection.classList.add('hidden');
  finalSection.classList.add('hidden');
  popover.classList.remove('show');

  try {
    const res = await fetch('/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      let detail = `Error ${res.status}`;
      try {
        const errBody = await res.json();
        if (errBody.detail) detail = errBody.detail;
      } catch (_) { /* ignore parse failure */ }
      throw new Error(detail);
    }

    const data = await res.json();
    currentText = text;
    errors = data.errors;
    errorStates = errors.map((e) => ({ status: 'pending', error: e }));
    errorPositions = locateErrors(text, errors);
    errorPositions.sort((a, b) => a.start - b.start);
    activeErrorIndex = -1;

    if (errors.length === 0) {
      resultsSection.classList.add('hidden');
      finalText.textContent = text;
      finalSection.classList.remove('hidden');
      emptyState.classList.add('hidden');
      return;
    }

    renderManuscript();
    updateProgress();
    resultsSection.classList.remove('hidden');
    emptyState.classList.add('hidden');
  } catch (err) {
    const isNetworkError = err instanceof TypeError || err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError');
    const msg = isNetworkError 
      ? 'Error al analizar. Verifica que el servidor esté corriendo.' 
      : (err.message || 'Error al analizar.');
    showError(msg);
  } finally {
    setLoading(false);
  }
}

function setLoading(on) {
  loading.classList.toggle('hidden', !on);
  analyzeBtn.disabled = on;
  analyzeBtn.textContent = on ? 'Analizando…' : 'Analizar';
}

/* ── Locate errors in text ── */
function locateErrors(text, errs) {
  const occupied = new Set();
  const positions = [];
  let lastIndex = 0;
  for (let i = 0; i < errs.length; i++) {
    const orig = errs[i].original;
    if (!orig) {
      positions.push({ start: 0, end: 0, index: i });
      continue;
    }
    let found = -1;

    // First try searching from lastIndex to handle sequential duplicate words
    let searchFrom = lastIndex;
    while (true) {
      const idx = text.indexOf(orig, searchFrom);
      if (idx === -1) break;
      const end = idx + orig.length;
      let overlap = false;
      for (let p = idx; p < end; p++) {
        if (occupied.has(p)) { overlap = true; break; }
      }
      if (!overlap) { found = idx; break; }
      searchFrom = idx + 1;
    }

    // Fallback to searching from 0 if not found sequentially
    if (found === -1 && lastIndex > 0) {
      searchFrom = 0;
      while (true) {
        const idx = text.indexOf(orig, searchFrom);
        if (idx === -1 || idx >= lastIndex) break;
        const end = idx + orig.length;
        let overlap = false;
        for (let p = idx; p < end; p++) {
          if (occupied.has(p)) { overlap = true; break; }
        }
        if (!overlap) { found = idx; break; }
        searchFrom = idx + 1;
      }
    }

    if (found !== -1) {
      for (let p = found; p < found + orig.length; p++) occupied.add(p);
      positions.push({ start: found, end: found + orig.length, index: i });
      lastIndex = found + orig.length;
    } else {
      const fallback = text.indexOf(orig);
      if (fallback !== -1) {
        positions.push({ start: fallback, end: fallback + orig.length, index: i });
      } else {
        positions.push({ start: 0, end: 0, index: i });
      }
    }
  }
  return positions;
}

/* ── Render manuscript with inline errors ── */
function renderManuscript() {
  const segments = buildSegments();
  let html = '';
  for (const seg of segments) {
    if (seg.type === 'text') {
      html += escHtml(seg.content);
    } else {
      const state = errorStates[seg.index];
      let cls = 'error-highlight';
      if (state.status === 'accepted') cls += ' accepted';
      else if (state.status === 'ignored') cls += ' ignored';
      if (seg.index === activeErrorIndex) cls += ' active';

      if (state.status === 'accepted') {
        html += `<span class="${cls}">${escHtml(seg.correction)}</span>`;
      } else if (state.status === 'ignored') {
        html += escHtml(seg.original);
      } else {
        html += `<span class="${cls}" data-error-idx="${seg.index}">${escHtml(seg.original)}</span>`;
      }
    }
  }
  textContent.innerHTML = html;

  // Attach click listeners to error spans
  textContent.querySelectorAll('.error-highlight[data-error-idx]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(el.dataset.errorIdx);
      openPopover(idx, el);
    });
  });
}

function buildSegments() {
  const segs = [];
  let lastEnd = 0;
  for (const pos of errorPositions) {
    if (pos.start > lastEnd) {
      segs.push({ type: 'text', content: currentText.slice(lastEnd, pos.start) });
    }
    const state = errorStates[pos.index];
    segs.push({
      type: 'error',
      index: pos.index,
      original: currentText.slice(pos.start, pos.end),
      correction: state.error.correction,
      status: state.status,
    });
    lastEnd = pos.end;
  }
  if (lastEnd < currentText.length) {
    segs.push({ type: 'text', content: currentText.slice(lastEnd) });
  }
  return segs;
}

/* ── Popover ── */
function openPopover(idx, anchorEl) {
  if (errorStates[idx].status !== 'pending') return;

  activeErrorIndex = idx;
  const err = errors[idx];

  popoverType.textContent = labelFor(err.type);
  popoverErrNum.textContent = `${idx + 1} / ${errors.length}`;
  popoverOriginal.textContent = err.original;
  popoverCorrection.textContent = err.correction;
  popoverExplanation.textContent = err.explanation;

  // Position popover
  const rect = anchorEl.getBoundingClientRect();
  const containerRect = manuscript.getBoundingClientRect();

  let top = rect.bottom - containerRect.top + 6;
  let left = rect.left - containerRect.left;
  if (left + 340 > containerRect.width - 16) {
    left = containerRect.width - 356;
  }
  if (left < 16) left = 16;

  popover.style.top = top + 'px';
  popover.style.left = left + 'px';
  popover.classList.add('show');

  renderManuscript();
}

function closePopover() {
  popover.classList.remove('show');
  activeErrorIndex = -1;
  renderManuscript();
}

function handleDocClick(e) {
  if (popover.classList.contains('show') && !popover.contains(e.target) && !e.target.closest('.error-highlight')) {
    closePopover();
  }
}

/* ── Resolve error (accept / ignore) ── */
function resolveError(status) {
  if (activeErrorIndex === -1) return;
  errorStates[activeErrorIndex].status = status;
  closePopover();
  updateProgress();
  checkAllResolved();
}

/* ── Progress ── */
function updateProgress() {
  const resolved = errorStates.filter((s) => s.status !== 'pending').length;
  const total = errors.length;
  progressLabel.textContent = `${resolved} / ${total} errores revisados`;
  progressFill.style.width = total ? `${(resolved / total) * 100}%` : '0%';
}

/* ── Final text ── */
function checkAllResolved() {
  const allDone = errorStates.every((s) => s.status !== 'pending');
  if (allDone && errors.length > 0) {
    let result = currentText;
    // Apply from last position to first to avoid offset shifting
    const sorted = [...errorPositions].sort((a, b) => b.start - a.start);
    for (const pos of sorted) {
      const state = errorStates[pos.index];
      if (state.status === 'accepted') {
        result = result.slice(0, pos.start) + state.error.correction + result.slice(pos.end);
      }
    }
    finalText.textContent = result;
    finalSection.classList.remove('hidden');
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    finalSection.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });
  }
}

/* ── Copy ── */
function handleCopy() {
  if (!navigator.clipboard || !navigator.clipboard.writeText) {
    const textArea = document.createElement("textarea");
    textArea.value = finalText.textContent;
    textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      const orig = copyBtn.textContent;
      copyBtn.textContent = '¡Copiado!';
      setTimeout(() => { copyBtn.textContent = 'Copiar'; }, 2000);
    } catch (err) {
      alert('No se pudo copiar el texto automáticamente. Por favor, selecciónalo y cópialo manualmente.');
    }
    document.body.removeChild(textArea);
    return;
  }

  navigator.clipboard.writeText(finalText.textContent).then(() => {
    const orig = copyBtn.textContent;
    copyBtn.textContent = '¡Copiado!';
    setTimeout(() => { copyBtn.textContent = 'Copiar'; }, 2000);
  });
}

/* ── Utils ── */
function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
