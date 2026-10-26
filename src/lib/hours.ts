/** Opening hours per weekday, Sunday first (Date.getDay order). */
export type DayHours = { open: boolean; from: string; to: string };

export const DAY_NAMES = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const SHORT = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

export const defaultHours = (): DayHours[] => DAY_NAMES.map((_, d) => ({ open: d !== 0, from: "08:00", to: "17:00" }));

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function parseHours(json: string): DayHours[] {
  try {
    const v = JSON.parse(json) as DayHours[];
    if (Array.isArray(v) && v.length === 7 && v.every((d) => typeof d.open === "boolean" && TIME.test(d.from) && TIME.test(d.to))) return v;
  } catch {}
  return defaultHours();
}

/** "จ.–ส. 08:00–17:00 · อา. ปิด" — consecutive days with the same hours are joined, Monday first. */
export function hoursSummary(hours: DayHours[]) {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const label = (d: DayHours) => (d.open ? `${d.from}–${d.to}` : "ปิด");
  const groups: { days: number[]; text: string }[] = [];
  for (const d of order) {
    const text = label(hours[d]);
    const last = groups.at(-1);
    if (last && last.text === text) last.days.push(d);
    else groups.push({ days: [d], text });
  }
  return groups
    .map((g) => `${SHORT[g.days[0]]}${g.days.length > 1 ? `–${SHORT[g.days.at(-1)!]}` : ""} ${g.text}`)
    .join(" · ");
}
