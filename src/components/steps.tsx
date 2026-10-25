export function Steps({ current }: { current: 1 | 2 }) {
  return (
    <div className="mb-5 flex items-center gap-2 text-xs">
      {["ตั้งรหัสผ่าน", "ตั้งค่า Google Authenticator"].map((label, i) => (
        <div key={label} className="flex flex-1 items-center gap-2">
          <span className={`grid size-6 shrink-0 place-items-center rounded-full font-semibold ${i + 1 <= current ? "bg-brand-500 text-white" : "bg-slate-200 text-slate-500"}`}>{i + 1}</span>
          <span className={i + 1 === current ? "font-medium text-ink-900" : "text-slate-400"}>{label}</span>
          {i === 0 && <span className="h-px flex-1 bg-slate-200" />}
        </div>
      ))}
    </div>
  );
}
