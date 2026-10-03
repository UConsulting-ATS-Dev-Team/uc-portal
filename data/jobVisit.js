import { useMemo } from "react";

// "New since your last visit": a member's own marker of when they were last on the portal, kept per account
// in this browser (localStorage), so it is a per-device convenience, not synced account data.
//
// The baseline a page compares against must not move while the member is still browsing, or every "New"
// badge would vanish on the next navigation. So a visit is a run of activity with gaps under VISIT_GAP_MS:
// the baseline is the previous visit's last activity, and each load only bumps `last`.
const KEY_PREFIX = "uc-portal-jobs-visit:";
const VISIT_GAP_MS = 30 * 60 * 1000;
const FIRST_VISIT_LOOKBACK_MS = 7 * 86400000; // nothing recorded yet: treat the last week as new
const MAX_LOOKBACK_MS = 14 * 86400000; // away for months: still only the last two weeks

export function computeVisitBaseline(accountId, now = Date.now(), storage = globalThis.localStorage) {
  const key = KEY_PREFIX + accountId;
  let record = null;
  try {
    const parsed = JSON.parse(storage?.getItem(key) ?? "null");
    if (parsed && Number.isFinite(parsed.baseline) && Number.isFinite(parsed.last)) record = parsed;
  } catch {
    // unreadable or blocked storage: behave like a first visit
  }

  let next;
  if (!record) next = { baseline: now - FIRST_VISIT_LOOKBACK_MS, last: now };
  else if (now - record.last > VISIT_GAP_MS) next = { baseline: record.last, last: now };
  else next = { baseline: record.baseline, last: now };
  next.baseline = Math.max(next.baseline, now - MAX_LOOKBACK_MS);

  try {
    storage?.setItem(key, JSON.stringify(next));
  } catch {
    // storage full or blocked: the baseline still works for this page load
  }
  return next.baseline;
}

// Epoch ms a job must have been added after to count as new, or null until the account is known.
export function useJobsVisitBaseline(accountId) {
  return useMemo(() => (accountId ? computeVisitBaseline(accountId) : null), [accountId]);
}

export function isNewSince(job, baselineMs) {
  return baselineMs != null && job.addedAt != null && job.addedAt > baselineMs;
}
