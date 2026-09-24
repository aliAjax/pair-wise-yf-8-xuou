// 判定规则：修复状态流转与校验、时长与统计口径、试映前核对项。
window.FilmDesk = window.FilmDesk || {};

FilmDesk.rules = (() => {
  const REPAIR_STATUS = {
    NONE: "none",
    PENDING: "pending",
    REPAIRED: "repaired",
    SKIPPED: "skipped"
  };

  const REPAIR_STATUS_LABELS = {
    [REPAIR_STATUS.NONE]: "未登记",
    [REPAIR_STATUS.PENDING]: "待修",
    [REPAIR_STATUS.REPAIRED]: "已修复",
    [REPAIR_STATUS.SKIPPED]: "跳过"
  };

  function createRepairRecord() {
    return {
      status: REPAIR_STATUS.NONE,
      method: "",
      originalShift: "",
      originalDamage: "",
      repairedAt: ""
    };
  }

  function getRepairStatus(segment) {
    return segment.repair?.status || REPAIR_STATUS.NONE;
  }

  // 登记修复结果。登记已修复时修复方式不能为空；登记成功后颜色恢复为正常，
  // 原本的偏移和破损情况写入留档。返回 { ok, error }，失败时不改动片段。
  function applyRepairStatus(segment, nextStatus, method = "") {
    if (!Object.values(REPAIR_STATUS).includes(nextStatus)) {
      return { ok: false, error: "未知的修复状态。" };
    }
    const record = segment.repair || (segment.repair = createRepairRecord());
    if (nextStatus === REPAIR_STATUS.REPAIRED) {
      const trimmedMethod = String(method).trim();
      if (!trimmedMethod) {
        return { ok: false, error: "登记已修复时必须填写修复方式。" };
      }
      if (record.status !== REPAIR_STATUS.REPAIRED) {
        record.originalShift = segment.shift;
        record.originalDamage = segment.damage;
      }
      record.method = trimmedMethod;
      record.repairedAt = new Date().toISOString();
      segment.shift = "正常";
      segment.damage = "完好";
    }
    record.status = nextStatus;
    return { ok: true };
  }

  // 跳过项保留放映顺序，但不计入时长；恢复登记后重新计时。
  function countsTowardDuration(segment) {
    return getRepairStatus(segment) !== REPAIR_STATUS.SKIPPED;
  }

  function getScreeningSeconds(segments) {
    return segments
      .filter(countsTowardDuration)
      .reduce((sum, item) => sum + Number(item.duration), 0);
  }

  function getStats(segments) {
    return {
      totalSeconds: getScreeningSeconds(segments),
      damaged: segments.filter((item) => item.damage !== "完好").length,
      total: segments.length,
      pending: segments.filter((item) => getRepairStatus(item) === REPAIR_STATUS.PENDING).length,
      skipped: segments.filter((item) => getRepairStatus(item) === REPAIR_STATUS.SKIPPED).length
    };
  }

  // 试映前核对：颜色偏移、破损、待修与跳过都需要提醒；
  // 已修复片段恢复试映统计，不再列入。
  function getWarnings(segments) {
    return segments
      .map((segment, index) => {
        const reasons = [];
        if (segment.shift !== "正常") reasons.push(segment.shift);
        if (segment.damage !== "完好") reasons.push(segment.damage);
        const status = getRepairStatus(segment);
        if (status === REPAIR_STATUS.PENDING) reasons.push("待修复");
        if (status === REPAIR_STATUS.SKIPPED) reasons.push("跳过，不计入时长");
        return { segment, index, reasons };
      })
      .filter((entry) => entry.reasons.length > 0);
  }

  function formatDuration(seconds) {
    const value = Number(seconds) || 0;
    const minutes = Math.floor(value / 60);
    const rest = String(value % 60).padStart(2, "0");
    return `${minutes}:${rest}`;
  }

  return {
    REPAIR_STATUS,
    REPAIR_STATUS_LABELS,
    createRepairRecord,
    getRepairStatus,
    applyRepairStatus,
    countsTowardDuration,
    getScreeningSeconds,
    getStats,
    getWarnings,
    formatDuration
  };
})();
