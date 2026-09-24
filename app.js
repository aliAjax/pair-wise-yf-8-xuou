// 页面交互：渲染清单、统计与提醒，响应录入、排序和修复登记操作。
// 判定逻辑走 FilmRules，清单读写走 FilmStore。
let state = FilmStore.loadState();
let draggedId = null;
let repairEditingId = null;
let repairError = "";

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
    const matchesKeyword = !keyword || `${item.code}${item.note}${item.damage}${item.repairStatus}`.includes(keyword);
    return matchesColor && matchesKeyword;
  });
}

function renderStats() {
  const tally = FilmRules.repairTally(state.segments);
  const damaged = state.segments.filter((item) => item.damage !== "完好").length;
  els.totalDuration.textContent = formatDuration(FilmRules.screeningDuration(state.segments));
  els.damageCount.textContent = damaged;
  els.segmentCount.textContent = state.segments.length;
  els.pendingCount.textContent = tally.pending;
  els.skippedCount.textContent = tally.skipped;
}

function statusTag(status) {
  if (status === FilmRules.STATUS_PENDING) return `<span class="tag pending">待修</span>`;
  if (status === FilmRules.STATUS_REPAIRED) return `<span class="tag repaired">已修复</span>`;
  if (status === FilmRules.STATUS_SKIPPED) return `<span class="tag skipped">跳过</span>`;
  return "";
}

function archiveLine(item) {
  if (!item.originalShift && !item.originalDamage) return "";
  const method = item.repairMethod ? `｜修复方式：${escapeHtml(item.repairMethod)}` : "";
  return `<p class="repair-archive">留档：原偏移 ${escapeHtml(item.originalShift)}｜原破损 ${escapeHtml(item.originalDamage)}${method}</p>`;
}

function renderList() {
  const segments = getFilteredSegments();
  els.segmentList.innerHTML =
    segments
      .map((item) => {
        const realIndex = state.segments.findIndex((segment) => segment.id === item.id);
        const hasDamage = item.damage !== "完好";
        const countable = FilmRules.countsForScreening(item);
        const editing = repairEditingId === item.id;
        const selectedStatus = editing ? FilmRules.STATUS_REPAIRED : item.repairStatus;
        const showMethod = editing || item.repairStatus === FilmRules.STATUS_REPAIRED;
        return `
          <article class="segment-card ${countable ? "" : "not-counted"}" draggable="true" data-id="${item.id}">
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
                <span>${formatDuration(item.duration)}${countable ? "" : `<em class="duration-hint">不计入时长</em>`}</span>
              </div>
              <div class="tag-row">
                <span class="tag">${escapeHtml(item.shift)}</span>
                <span class="tag ${hasDamage ? "damage" : "ok"}">${escapeHtml(item.damage)}</span>
                ${statusTag(item.repairStatus)}
              </div>
              <p class="segment-note">${escapeHtml(item.note || "没有备注。")}</p>
              ${archiveLine(item)}
              <div class="repair-row">
                <span class="repair-label">修复登记</span>
                <select data-repair-select="${item.id}">
                  ${FilmRules.REPAIR_STATUSES.map(
                    (status) => `<option value="${status}" ${status === selectedStatus ? "selected" : ""}>${status}</option>`
                  ).join("")}
                </select>
                ${showMethod ? `<input data-repair-method="${item.id}" type="text" placeholder="修复方式（必填）" value="${escapeHtml(item.repairMethod)}" />` : ""}
                ${showMethod ? `<button type="button" data-repair-apply="${item.id}">登记修复</button>` : ""}
              </div>
              ${editing && repairError ? `<p class="repair-error">${escapeHtml(repairError)}</p>` : ""}
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
  const warnings = FilmRules.warningEntries(state.segments);
  els.warningList.innerHTML =
    warnings
      .map(
        ({ segment, index, reasons }) => `
          <div class="warning-item">
            <strong>${index}. ${escapeHtml(segment.code)}</strong>
            <span>${escapeHtml(reasons)}${segment.note ? `：${escapeHtml(segment.note)}` : ""}</span>
          </div>
        `
      )
      .join("") || `<p class="empty">当前清单没有颜色偏移、破损或修复跟进提醒。</p>`;
}

function renderAll() {
  FilmStore.saveState(state);
  els.reelTitle.value = state.reelTitle;
  renderStats();
  renderList();
  renderWarnings();
}

function formatDuration(seconds) {
  const value = Number(seconds) || 0;
  const minutes = Math.floor(value / 60);
  const rest = String(value % 60).padStart(2, "0");
  return `${minutes}:${rest}`;
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
  state.segments.push(
    FilmStore.createSegment({
      code: els.codeInput.value.trim(),
      duration: Number(els.durationInput.value),
      shift: els.shiftInput.value,
      damage: els.damageInput.value,
      note: els.noteInput.value.trim(),
      thumb
    })
  );
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

function commitRepair(id, status, method = "") {
  const segment = state.segments.find((item) => item.id === id);
  if (!segment) return;
  const result = FilmRules.registerRepair(segment, status, method);
  if (!result.ok) {
    repairEditingId = id;
    repairError = result.error;
    renderList();
    return;
  }
  state.segments = state.segments.map((item) => (item.id === id ? result.segment : item));
  repairEditingId = null;
  repairError = "";
  renderAll();
}

function applyRepair(id) {
  const input = els.segmentList.querySelector(`[data-repair-method="${id}"]`);
  commitRepair(id, FilmRules.STATUS_REPAIRED, input ? input.value : "");
}

function exportList() {
  const tally = FilmRules.repairTally(state.segments);
  const lines = [
    `胶片卷：${state.reelTitle || "未命名胶片卷"}`,
    `总时长：${formatDuration(FilmRules.screeningDuration(state.segments))}（待修 ${tally.pending} 段、跳过 ${tally.skipped} 段不计入）`,
    "",
    ...state.segments.map((item, index) => {
      const parts = [`${index + 1}. ${item.code}`, formatDuration(item.duration), item.shift, item.damage];
      if (item.repairStatus !== FilmRules.STATUS_NONE) parts.push(`修复登记：${item.repairStatus}`);
      if (item.repairStatus === FilmRules.STATUS_REPAIRED) {
        parts.push(`修复方式：${item.repairMethod}`, `留档：${item.originalShift}/${item.originalDamage}`);
      }
      parts.push(item.note || "无备注");
      return parts.join("｜");
    })
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
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

const fallbackThumbs = ["#d49b35", "#347d89", "#b54d48", "#4d7656", "#6d6378"];

els.reelTitle.addEventListener("input", () => {
  state.reelTitle = els.reelTitle.value;
  FilmStore.saveState(state);
});
els.colorFilter.addEventListener("change", renderList);
els.searchInput.addEventListener("input", renderList);
els.segmentForm.addEventListener("submit", addSegment);
els.exportBtn.addEventListener("click", exportList);

els.segmentList.addEventListener("click", (event) => {
  const up = event.target.closest("[data-move-up]");
  const down = event.target.closest("[data-move-down]");
  const remove = event.target.closest("[data-delete]");
  const apply = event.target.closest("[data-repair-apply]");
  if (up) moveSegment(up.dataset.moveUp, -1);
  if (down) moveSegment(down.dataset.moveDown, 1);
  if (apply) applyRepair(apply.dataset.repairApply);
  if (remove) {
    if (repairEditingId === remove.dataset.delete) {
      repairEditingId = null;
      repairError = "";
    }
    state.segments = state.segments.filter((item) => item.id !== remove.dataset.delete);
    renderAll();
  }
});

els.segmentList.addEventListener("change", (event) => {
  const select = event.target.closest("[data-repair-select]");
  if (!select) return;
  const id = select.dataset.repairSelect;
  if (select.value === FilmRules.STATUS_REPAIRED) {
    repairEditingId = id;
    repairError = "";
    renderList();
    return;
  }
  commitRepair(id, select.value);
});

els.segmentList.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  const input = event.target.closest("[data-repair-method]");
  if (!input) return;
  event.preventDefault();
  applyRepair(input.dataset.repairMethod);
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
