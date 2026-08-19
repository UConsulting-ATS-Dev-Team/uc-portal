import { STAGES } from "./trackerUtils.js";

// Gantt math for the Timeline tracker view (1j). The date window is fixed
// to the recruiting cycle the wireframe specifies (Aug-Nov) rather than
// computed from data, since it's meant to represent the whole cycle, not
// just whatever's currently tracked.
export const TIMELINE_START = new Date("2026-08-01T00:00:00.000Z");
export const TIMELINE_END = new Date("2026-11-30T00:00:00.000Z");
const TOTAL_MS = TIMELINE_END - TIMELINE_START;

export const MONTH_MARKERS = [
  { label: "Aug", date: new Date("2026-08-01T00:00:00.000Z") },
  { label: "Sep", date: new Date("2026-09-01T00:00:00.000Z") },
  { label: "Oct", date: new Date("2026-10-01T00:00:00.000Z") },
  { label: "Nov", date: new Date("2026-11-01T00:00:00.000Z") },
];

export function dateToPct(date) {
  const pct = ((date - TIMELINE_START) / TOTAL_MS) * 100;
  return Math.max(0, Math.min(100, pct));
}

const STAGE_GROUPS = [
  { key: "interview", label: "Interview rounds", stages: ["First round", "Final round"] },
  { key: "applied", label: "Applied & assessment", stages: ["Applied", "Assessment"] },
  { key: "notYet", label: "Not yet applied", stages: ["Interested", "Preparing"] },
  { key: "closed", label: "Closed", stages: ["Closed"] },
];

export function groupForStage(stage) {
  return STAGE_GROUPS.find((g) => g.stages.includes(stage))?.key || "notYet";
}

export const GROUP_ORDER = STAGE_GROUPS;

// Shade progressively darker by stage index, from ground (lightest) to
// UC's accent blue (darkest) -- matches "Interested lightest -> Interview
// rounds accent" from the spec.
export function shadeForStage(stage) {
  const i = STAGES.indexOf(stage);
  const t = i / (STAGES.length - 1);
  const light = [231, 231, 234]; // --color-border-inner
  const dark = [12, 116, 193]; // UC accent
  const rgb = light.map((c, idx) => Math.round(c + (dark[idx] - c) * t));
  return `rgb(${rgb.join(",")})`;
}

// Builds the actual (solid) + projected (dashed) bar segments and one
// event marker for a tracked application row.
export function buildRow(application, shiftDays = 0) {
  const { job, stage, stageHistory = [] } = application;
  const history = stageHistory.length > 0 ? stageHistory : [{ stage, date: application.addedAt }];

  const actualSegments = history.map((entry, i) => {
    const start = new Date(entry.date);
    const end = i < history.length - 1 ? new Date(history[i + 1].date) : new Date();
    return { stage: entry.stage, start, end, kind: "actual" };
  });

  const lastActual = actualSegments[actualSegments.length - 1];
  const currentIndex = STAGES.indexOf(stage);
  const remainingStages = STAGES.slice(currentIndex + 1).filter((s) => s !== "Closed");

  const deadline = job.deadlineDate ? new Date(job.deadlineDate) : new Date(TIMELINE_END);
  const shiftedDeadline = new Date(deadline.getTime() + shiftDays * 86400000);

  const projectedSegments = [];
  if (remainingStages.length > 0 && stage !== "Closed") {
    const segStart = lastActual ? lastActual.end : new Date();
    const spanMs = Math.max(shiftedDeadline - segStart, 86400000);
    const perStageMs = spanMs / remainingStages.length;
    remainingStages.forEach((s, i) => {
      projectedSegments.push({
        stage: s,
        start: new Date(segStart.getTime() + perStageMs * i),
        end: new Date(segStart.getTime() + perStageMs * (i + 1)),
        kind: "projected",
      });
    });
  }

  let event = null;
  if (["Assessment", "First round", "Final round"].includes(stage) && lastActual) {
    const label = stage === "Assessment" ? "Solve game due" : `${stage.toLowerCase()}`;
    event = { date: lastActual.end, label: `${label} · ${job.location}` };
  }

  return { actualSegments, projectedSegments, event };
}
