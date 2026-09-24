// 清单保存：本地读写、默认数据与片段字段补全。
// 旧清单缺少修复字段时在载入时补齐，保证判定规则有可用的数据。
window.FilmStore = (() => {
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
        thumb: ""
      },
      {
        id: crypto.randomUUID(),
        code: "A-006",
        duration: 9,
        shift: "偏红",
        damage: "轻微划痕",
        note: "人物近景左侧有划痕，试映时留意是否明显。",
        thumb: ""
      },
      {
        id: crypto.randomUUID(),
        code: "A-012",
        duration: 14,
        shift: "褪色",
        damage: "接片松动",
        note: "接片位置靠近段尾，放映前建议重新压平。",
        thumb: ""
      }
    ]
  };

  function normalizeSegment(raw) {
    return {
      repairStatus: FilmRules.STATUS_NONE,
      repairMethod: "",
      originalShift: "",
      originalDamage: "",
      ...raw
    };
  }

  function normalizeState(state) {
    return { ...state, segments: state.segments.map(normalizeSegment) };
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

  function createSegment(fields) {
    return normalizeSegment({ id: crypto.randomUUID(), ...fields });
  }

  return { loadState, saveState, createSegment };
})();
