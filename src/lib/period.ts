/** Parses ?from=YYYY-MM-DD&to=YYYY-MM-DD (inclusive) into a [from, toExclusive) UTC range. Default: last 30 days. */
export function parsePeriod(sp: { from?: string; to?: string }, defaultDays = 30) {
  const d = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00Z`) : null);
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  const to = d(sp.to) ?? today;
  const from = d(sp.from) ?? new Date(to.getTime() - (defaultDays - 1) * 86400_000);
  const toExclusive = new Date(to.getTime() + 86400_000);
  return { from, to, toExclusive, fromStr: from.toISOString().slice(0, 10), toStr: to.toISOString().slice(0, 10) };
}
