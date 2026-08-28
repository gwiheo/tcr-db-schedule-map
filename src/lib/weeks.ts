import type { Week } from "./types";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISODate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function buildWeeks(): Week[] {
  const start = new Date(2026, 7, 3);
  const last = new Date(2026, 11, 28);
  const weeks: Week[] = [];
  let index = 0;
  for (const cursor = new Date(start); cursor <= last; cursor.setDate(cursor.getDate() + 7)) {
    const end = new Date(cursor);
    end.setDate(end.getDate() + 6);
    weeks.push({
      index,
      start: toISODate(cursor),
      end: toISODate(end),
      month: cursor.getMonth() + 1,
      label: `${cursor.getMonth() + 1}/${cursor.getDate()}`,
      rangeLabel: `${cursor.getMonth() + 1}/${cursor.getDate()}–${end.getMonth() + 1}/${end.getDate()}`,
    });
    index += 1;
  }
  return weeks;
}

export const WEEKS = buildWeeks();

export function currentWeekIndex(now = new Date()) {
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  for (const week of WEEKS) {
    const start = parseISODate(week.start).getTime();
    const end = parseISODate(week.end).getTime();
    if (t >= start && t <= end) return week.index;
  }
  if (t < parseISODate(WEEKS[0].start).getTime()) return -1;
  return WEEKS.length;
}

export function monthGroups(weeks = WEEKS) {
  const groups: { month: number; start: number; count: number }[] = [];
  for (const week of weeks) {
    const last = groups[groups.length - 1];
    if (!last || last.month !== week.month) {
      groups.push({ month: week.month, start: week.index, count: 1 });
    } else {
      last.count += 1;
    }
  }
  return groups;
}
