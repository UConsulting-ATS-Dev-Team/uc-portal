// Deadline math shared by the Jobs board's filter and its job cards.
export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const ms = new Date(dateStr) - new Date();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function deadlineLabel(job) {
  if (job.rolling) return "Rolling";
  const days = daysUntil(job.deadlineDate);
  if (days === null) return "No deadline listed";
  if (days < 0) return "Closed";
  if (days === 0) return "Closes today";
  if (days <= 14) return `${days}d left`;
  return new Date(job.deadlineDate).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function isUrgent(job) {
  if (job.rolling) return false;
  const days = daysUntil(job.deadlineDate);
  return days !== null && days >= 0 && days <= 7;
}

export function matchesDeadlineBucket(job, bucket) {
  if (bucket === "Rolling") return !!job.rolling;
  const days = daysUntil(job.deadlineDate);
  if (days === null || days < 0) return false;
  if (bucket === "This week") return days <= 7;
  if (bucket === "This month") return days <= 30;
  return false;
}
