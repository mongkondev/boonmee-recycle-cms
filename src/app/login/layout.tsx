export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-ink-900 px-4 py-10">
      <div className="pointer-events-none absolute -top-40 -left-40 size-[520px] rounded-full bg-brand-500/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 -bottom-48 size-[480px] rounded-full bg-brand-400/20 blur-3xl" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: "radial-gradient(#fff 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center text-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" className="size-14 rounded-2xl shadow-lg shadow-brand-900/40" />
          <h1 className="mt-3 text-xl font-semibold">บุญมี รีไซเคิล</h1>
          <p className="text-sm text-brand-200/80">ระบบจัดการราคารับซื้อ</p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-2xl shadow-black/30">{children}</div>
      </div>
    </div>
  );
}
