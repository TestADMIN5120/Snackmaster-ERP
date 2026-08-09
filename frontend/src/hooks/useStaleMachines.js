export function isStale(lastRefillAt, days = 7) {
  if (!lastRefillAt) return true;
  const diff =
    Date.now() - lastRefillAt.toDate().getTime();
  return diff > days * 86400000;
}
