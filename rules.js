// 判定规则：修复状态流转、时长统计口径与试映前提醒。
// 只处理片段数据，不触碰页面与存储。
window.FilmRules = (() => {
  const STATUS_NONE = "无";
  const STATUS_PENDING = "待修";
  const STATUS_REPAIRED = "已修复";
  const STATUS_SKIPPED = "跳过";
  const REPAIR_STATUSES = [STATUS_NONE, STATUS_PENDING, STATUS_REPAIRED, STATUS_SKIPPED];

  // 待修与跳过的片段保留在放映顺序里，但不计入试映时长。
  function countsForScreening(segment) {
    return segment.repairStatus !== STATUS_PENDING && segment.repairStatus !== STATUS_SKIPPED;
  }

  function screeningDuration(segments) {
    return segments.filter(countsForScreening).reduce((sum, item) => sum + Number(item.duration), 0);
  }

  function repairTally(segments) {
    return {
      pending: segments.filter((item) => item.repairStatus === STATUS_PENDING).length,
      skipped: segments.filter((item) => item.repairStatus === STATUS_SKIPPED).length
    };
  }

  // 登记修复结果。已修复必须填写修复方式，颜色恢复为正常，
  // 原本的偏移与破损写入留档字段。返回 { ok, segment } 或 { ok, error }。
  function registerRepair(segment, status, method) {
    if (!REPAIR_STATUSES.includes(status)) {
      return { ok: false, error: "未知的修复状态。" };
    }
    const next = { ...segment };
    if (status === STATUS_REPAIRED) {
      const repairMethod = String(method || "").trim();
      if (!repairMethod) {
        return { ok: false, error: "登记已修复前请先填写修复方式。" };
      }
      next.originalShift = segment.originalShift || segment.shift;
      next.originalDamage = segment.originalDamage || segment.damage;
      next.shift = "正常";
      next.repairMethod = repairMethod;
    }
    next.repairStatus = status;
    return { ok: true, segment: next };
  }

  // 试映前核对：待修与跳过片段必须跟进，未修复的偏移或破损继续提醒。
  function warningEntries(segments) {
    return segments
      .map((segment, index) => ({ segment, index: index + 1 }))
      .filter(({ segment }) => {
        const hasIssue = segment.shift !== "正常" || segment.damage !== "完好";
        const tracking = segment.repairStatus === STATUS_PENDING || segment.repairStatus === STATUS_SKIPPED;
        return tracking || (hasIssue && segment.repairStatus !== STATUS_REPAIRED);
      })
      .map(({ segment, index }) => {
        const reasons = [];
        if (segment.shift !== "正常") reasons.push(segment.shift);
        if (segment.damage !== "完好") reasons.push(segment.damage);
        if (segment.repairStatus === STATUS_PENDING) reasons.push("待修，暂不计入时长");
        if (segment.repairStatus === STATUS_SKIPPED) reasons.push("跳过，保留顺序不计时长");
        return { segment, index, reasons: reasons.join(" · ") };
      });
  }

  return {
    STATUS_NONE,
    STATUS_PENDING,
    STATUS_REPAIRED,
    STATUS_SKIPPED,
    REPAIR_STATUSES,
    countsForScreening,
    screeningDuration,
    repairTally,
    registerRepair,
    warningEntries
  };
})();
