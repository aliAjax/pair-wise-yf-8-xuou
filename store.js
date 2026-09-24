// 清单保存：本地存储读写、旧数据补全与清单导出文本。
window.FilmDesk = window.FilmDesk || {};

FilmDesk.store = (() => {
  const rules = FilmDesk.rules;
  const storageKey = "zfl17-film-strip-desk";

  const defaultState = {
    reelTitle: "春日试映A卷",
    segments: [
      {
        id: crypto.randomUUID(),
        code: "A-001",
        duration: 18,
        shift: "正常",
        damage: "完好",
        note: "开场街景，节奏平稳，适合保留原顺序。",
        thumb: "",
        repair: rules.createRepairRecord()
      },
      {
        id: crypto.randomUUID(),
        code: "A-006",
        duration: 9,
        shift: "偏红",
        damage: "轻微划痕",
        note: "人物近景左侧有划痕，试映时留意是否明显。",
        thumb: "",
        repair: { ...rules.createRepairRecord(), status: rules.REPAIR_STATUS.PENDING }
      },
      {
        id: crypto.randomUUID(),
        code: "A-012",
        duration: 14,
        shift: "褪色",
        damage: "接片松动",
        note: "接片位置靠近段尾，放映前建议重新压平。",
        thumb: "",
        repair: rules.createRepairRecord()
      }
    ]
  };

  // 旧版本清单没有修复字段，读取时补齐。
  function normalizeSegment(raw) {
    return { ...raw, repair: { ...rules.createRepairRecord(), ...(raw.repair || {}) } };
  }

  function normalizeState(state) {
    return { ...state, segments: (state.segments || []).map(normalizeSegment) };
  }

  function loadState() {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return normalizeState(structuredClone(defaultState));
    try {
      return normalizeState({ ...structuredClone(defaultState), ...JSON.parse(saved) });
    } catch {
      return normalizeState(structuredClone(defaultState));
    }
  }

  function saveState(state) {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }

  function buildExportText(state) {
    const stats = rules.getStats(state.segments);
    const lines = [
      `胶片卷：${state.reelTitle || "未命名胶片卷"}`,
      `总时长：${rules.formatDuration(stats.totalSeconds)}（跳过 ${stats.skipped} 段不计入）`,
      `待修：${stats.pending} 段｜跳过：${stats.skipped} 段`,
      "",
      ...state.segments.map((item, index) => {
        const statusLabel = rules.REPAIR_STATUS_LABELS[rules.getRepairStatus(item)];
        const timing = rules.countsTowardDuration(item)
          ? rules.formatDuration(item.duration)
          : `${rules.formatDuration(item.duration)}（不计入时长）`;
        const archive = item.repair?.method
          ? `｜修复方式：${item.repair.method}（原偏移 ${item.repair.originalShift}，原破损 ${item.repair.originalDamage}）`
          : "";
        return `${index + 1}. ${item.code}｜${timing}｜${item.shift}｜${item.damage}｜${statusLabel}${archive}｜${item.note || "无备注"}`;
      })
    ];
    return lines.join("\n");
  }

  return { storageKey, loadState, saveState, buildExportText };
})();
