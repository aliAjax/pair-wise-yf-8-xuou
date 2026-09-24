// 页面交互：渲染清单并绑定事件。判定规则见 rules.js，清单保存见 store.js。
const rules = FilmDesk.rules;
const store = FilmDesk.store;

const fallbackThumbs = ["#d49b35", "#347d89", "#b54d48", "#4d7656", "#6d6378"];

let state = store.loadState();
let draggedId = null;

const els = {
  reelTitle: document.querySelector("#reelTitle"),
  colorFilter: document.querySelector("#colorFilter"),
  searchInput: document.querySelector("#searchInput"),
  segmentForm: document.querySelector("#segmentForm"),
  codeInput: document.querySelector("#codeInput"),
  durationInput: document.querySelector("#durationInput"),
  shiftInput: document.querySelector("#shiftInput"),
  damageInput: document.querySelector("#damageInput"),
  thumbInput: document.querySelector("#thumbInput"),
  noteInput: document.querySelector("#noteInput"),
  segmentList: document.querySelector("#segmentList"),
  warningList: document.querySelector("#warningList"),
  totalDuration: document.querySelector("#totalDuration"),
  damageCount: document.querySelector("#damageCount"),
  segmentCount: document.querySelector("#segmentCount"),
  pendingCount: document.querySelector("#pendingCount"),
  skippedCount: document.querySelector("#skippedCount"),
  exportBtn: document.querySelector("#exportBtn")
};

function getFilteredSegments() {
  const color = els.colorFilter.value;
  const keyword = els.searchInput.value.trim();
  return state.segments.filter((item) => {
    const matchesColor = color === "all" || item.shift === color;
    const matchesKeyword = !keyword ||
      `${item.code}${item.note}${item.damage}${item.repair?.method || ""}`.includes(keyword);
    return matchesColor && matchesKeyword;
  });
}

function renderStats() {
  const stats = rules.getStats(state.segments);
  els.totalDuration.textContent = rules.formatDuration(stats.totalSeconds);
  els.damageCount.textContent = stats.damaged;
  els.segmentCount.textContent = stats.total;
  els.pendingCount.textContent = stats.pending;
  els.skippedCount.textContent = stats.skipped;
}

function renderRepairBox(item) {
  const status = rules.getRepairStatus(item);
  const options = Object.entries(rules.REPAIR_STATUS_LABELS)
    .map(([value, label]) =>
      `<option value="${value}" ${value === status ? "selected" : ""}>${label}</option>`
    )
    .join("");
  const record = item.repair || {};
  const archive = record.method
    ? `<p class="repair-archive">留档：原偏移 ${escapeHtml(record.originalShift)} · 原破损 ${escapeHtml(record.originalDamage)}｜修复方式：${escapeHtml(record.method)}${record.repairedAt ? `｜${record.repairedAt.slice(0, 10)}` : ""}</p>`
    : "";
  return `
    <div class="repair-box">
      <div class="repair-form">
        <select data-repair-status="${item.id}" title="修复状态">${options}</select>
        <input type="text" data-repair-method="${item.id}"
               placeholder="修复方式（登记已修复时必填）" value="${escapeHtml(record.method || "")}" />
        <button type="button" data-repair-apply="${item.id}">登记</button>
        ${
          status === rules.REPAIR_STATUS.SKIPPED
            ? `<button type="button" data-repair-restore="${item.id}">恢复计时</button>`
            : ""
        }
      </div>
      ${archive}
    </div>
  `;
}

function renderList() {
  const segments = getFilteredSegments();
  els.segmentList.innerHTML =
    segments
      .map((item) => {
        const realIndex = state.segments.findIndex((segment) => segment.id === item.id);
        const hasDamage = item.damage !== "完好";
        const status = rules.getRepairStatus(item);
        const isSkipped = status === rules.REPAIR_STATUS.SKIPPED;
        const statusTag =
          status !== rules.REPAIR_STATUS.NONE
            ? `<span class="tag repair ${status}">${rules.REPAIR_STATUS_LABELS[status]}</span>`
            : "";
        return `
          <article class="segment-card ${isSkipped ? "skipped" : ""}" draggable="true" data-id="${item.id}">
            <div class="thumb">
              ${
                item.thumb
                  ? `<img src="${item.thumb}" alt="${escapeHtml(item.code)}缩略图" />`
                  : `<div class="film-placeholder" style="background:${fallbackThumbs[realIndex % fallbackThumbs.length]}">${escapeHtml(item.code)}</div>`
              }
            </div>
            <div class="segment-main">
              <div class="segment-title">
                <strong>${realIndex + 1}. ${escapeHtml(item.code)}</strong>
                <span class="${isSkipped ? "duration-skipped" : ""}">${rules.formatDuration(item.duration)}${isSkipped ? "（不计入）" : ""}</span>
              </div>
              <div class="tag-row">
                <span class="tag">${escapeHtml(item.shift)}</span>
                <span class="tag ${hasDamage ? "damage" : "ok"}">${escapeHtml(item.damage)}</span>
                ${statusTag}
              </div>
              <p class="segment-note">${escapeHtml(item.note || "没有备注。")}</p>
              ${renderRepairBox(item)}
            </div>
            <div class="segment-actions">
              <button type="button" title="上移" data-move-up="${item.id}">↑</button>
              <button type="button" title="下移" data-move-down="${item.id}">↓</button>
              <button type="button" title="删除" data-delete="${item.id}">×</button>
            </div>
          </article>
        `;
      })
      .join("") || `<p class="empty">没有符合筛选的片段。</p>`;
}

function renderWarnings() {
  const warnings = rules.getWarnings(state.segments);
  els.warningList.innerHTML =
    warnings
      .map(({ segment, index, reasons }) => `
        <div class="warning-item">
          <strong>${index + 1}. ${escapeHtml(segment.code)}</strong>
          <span>${escapeHtml(reasons.join(" · "))}${segment.note ? `：${escapeHtml(segment.note)}` : ""}</span>
        </div>
      `)
      .join("") || `<p class="empty">当前清单没有颜色偏移、破损或修复待办提醒。</p>`;
}

function renderAll() {
  store.saveState(state);
  els.reelTitle.value = state.reelTitle;
  renderStats();
  renderList();
  renderWarnings();
}

function readFileAsDataUrl(file) {
  return new Promise((resolve) => {
    if (!file) {
      resolve("");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

async function addSegment(event) {
  event.preventDefault();
  const thumb = await readFileAsDataUrl(els.thumbInput.files[0]);
  state.segments.push({
    id: crypto.randomUUID(),
    code: els.codeInput.value.trim(),
    duration: Number(els.durationInput.value),
    shift: els.shiftInput.value,
    damage: els.damageInput.value,
    note: els.noteInput.value.trim(),
    thumb,
    repair: rules.createRepairRecord()
  });
  els.segmentForm.reset();
  els.durationInput.value = 12;
  renderAll();
}

function moveSegment(id, direction) {
  const index = state.segments.findIndex((item) => item.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= state.segments.length) return;
  const [item] = state.segments.splice(index, 1);
  state.segments.splice(target, 0, item);
  renderAll();
}

function findSegment(id) {
  return state.segments.find((item) => item.id === id);
}

function applyRepair(id) {
  const segment = findSegment(id);
  if (!segment) return;
  const statusSelect = els.segmentList.querySelector(`[data-repair-status="${id}"]`);
  const methodInput = els.segmentList.querySelector(`[data-repair-method="${id}"]`);
  const result = rules.applyRepairStatus(segment, statusSelect.value, methodInput.value);
  if (!result.ok) {
    methodInput.setCustomValidity(result.error);
    methodInput.reportValidity();
    return;
  }
  renderAll();
}

function restoreTiming(id) {
  const segment = findSegment(id);
  if (!segment) return;
  rules.applyRepairStatus(segment, rules.REPAIR_STATUS.NONE);
  renderAll();
}

function exportList() {
  const blob = new Blob([store.buildExportText(state)], { type: "text/plain;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${state.reelTitle || "film-reel"}-checklist.txt`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

els.reelTitle.addEventListener("input", () => {
  state.reelTitle = els.reelTitle.value;
  store.saveState(state);
});
els.colorFilter.addEventListener("change", renderList);
els.searchInput.addEventListener("input", renderList);
els.segmentForm.addEventListener("submit", addSegment);
els.exportBtn.addEventListener("click", exportList);

els.segmentList.addEventListener("click", (event) => {
  const up = event.target.closest("[data-move-up]");
  const down = event.target.closest("[data-move-down]");
  const remove = event.target.closest("[data-delete]");
  const repairApply = event.target.closest("[data-repair-apply]");
  const repairRestore = event.target.closest("[data-repair-restore]");
  if (up) moveSegment(up.dataset.moveUp, -1);
  if (down) moveSegment(down.dataset.moveDown, 1);
  if (remove) {
    state.segments = state.segments.filter((item) => item.id !== remove.dataset.delete);
    renderAll();
  }
  if (repairApply) applyRepair(repairApply.dataset.repairApply);
  if (repairRestore) restoreTiming(repairRestore.dataset.repairRestore);
});

// 用户重新填写修复方式时，清掉必填校验提示。
els.segmentList.addEventListener("input", (event) => {
  const methodInput = event.target.closest("[data-repair-method]");
  if (methodInput) methodInput.setCustomValidity("");
});

els.segmentList.addEventListener("dragstart", (event) => {
  const card = event.target.closest("[data-id]");
  if (!card) return;
  draggedId = card.dataset.id;
  card.classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
});

els.segmentList.addEventListener("dragend", (event) => {
  event.target.closest("[data-id]")?.classList.remove("dragging");
  draggedId = null;
});

els.segmentList.addEventListener("dragover", (event) => {
  const card = event.target.closest("[data-id]");
  if (!card || !draggedId || card.dataset.id === draggedId) return;
  event.preventDefault();
  const fromIndex = state.segments.findIndex((item) => item.id === draggedId);
  const toIndex = state.segments.findIndex((item) => item.id === card.dataset.id);
  if (fromIndex < 0 || toIndex < 0) return;
  const [item] = state.segments.splice(fromIndex, 1);
  state.segments.splice(toIndex, 0, item);
  renderAll();
});

renderAll();
