/** Shared by the browser (live checklist) and the server (enforcement). */
export const PASSWORD_RULES = [
  { id: "len", label: "อย่างน้อย 8 ตัวอักษร", test: (p: string) => p.length >= 8 },
  { id: "upper", label: "มีตัวพิมพ์ใหญ่ (A-Z)", test: (p: string) => /[A-Z]/.test(p) },
  { id: "lower", label: "มีตัวพิมพ์เล็ก (a-z)", test: (p: string) => /[a-z]/.test(p) },
  { id: "digit", label: "มีตัวเลข (0-9)", test: (p: string) => /\d/.test(p) },
  { id: "symbol", label: "มีอักขระพิเศษ เช่น ! @ # $ %", test: (p: string) => /[^A-Za-z0-9\s]/.test(p) },
  { id: "space", label: "ไม่มีช่องว่าง", test: (p: string) => p.length > 0 && !/\s/.test(p) },
] as const;

export function passwordProblems(p: string) {
  return PASSWORD_RULES.filter((r) => !r.test(p)).map((r) => r.label);
}

export const normalizeEmail = (e: string) => e.trim().toLowerCase();
export const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
