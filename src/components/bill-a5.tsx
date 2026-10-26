"use client";

import { Phone } from "lucide-react";
import { forwardRef } from "react";
import { A5, BILL_MIN_ROWS, bahtText, fmtBillNo, fmtMoney, fmtQty } from "@/lib/bill";
import type { BillDetail } from "@/lib/queries";
import type { ShopSettings } from "@/lib/types";
import { RecycleMark } from "./recycle-mark";

const INK = "#0f2a1d";
const GREEN = "#3a9e1d";
// table area left after header, totals and signatures (px at A5 scale)
const TABLE_BODY_H = 790;

/** One A5 (874×1240) cash bill. Fixed px sizes only: theme text classes are scaled for the CMS. */
export const BillA5 = forwardRef<HTMLDivElement, { bill: BillDetail; settings: ShopSettings }>(function BillA5({ bill, settings }, ref) {
  const phones = settings.phones.split(",").map((s) => s.trim()).filter(Boolean);
  const rows = Math.max(BILL_MIN_ROWS, bill.items.length);
  const rowH = Math.min(79, TABLE_BODY_H / rows);
  const font = Math.max(13, Math.min(19, rowH * 0.4));
  const date = new Date(bill.billDate).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" });
  const cell = { height: rowH, fontSize: font, borderBottom: "1px solid #dfe6da" } as const;

  return (
    <div
      ref={ref}
      style={{ width: A5.width, height: A5.height, fontFamily: "var(--font-prompt), sans-serif", color: INK }}
      className="relative flex flex-col overflow-hidden bg-white px-[36px] pt-[34px] pb-[30px]"
    >
      <RecycleMark size={520} className="absolute -right-40 -bottom-36" style={{ color: GREEN, opacity: 0.04 }} />

      {/* header */}
      <header className="relative flex items-start gap-5">
        <div className="grid size-[76px] shrink-0 place-items-center rounded-[20px]" style={{ background: GREEN }}>
          <RecycleMark size={48} className="text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[30px] leading-[1.2] font-bold">{settings.shop_name}</div>
          {settings.tagline && <div className="truncate text-[15px] text-[#4b5d52]">{settings.tagline}</div>}
          {phones.length > 0 && (
            <div className="mt-1 flex flex-wrap items-center gap-x-3 text-[16px] font-medium">
              <Phone className="size-4" style={{ color: GREEN }} strokeWidth={2.4} />
              {phones.join(" , ")}
            </div>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className="rounded-[14px] px-4 py-1.5 text-[22px] font-bold text-white" style={{ background: "#003020" }}>บิลเงินสด</div>
          <div className="mt-1 text-[14px] text-[#4b5d52]">ใบรับซื้อสินค้า</div>
        </div>
      </header>

      <div className="relative mt-5 grid grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 rounded-[14px] bg-[#f3f7ef] px-5 py-3 text-[17px]">
        <div className="flex min-w-0 gap-2">
          <span className="shrink-0 text-[#4b5d52]">ชื่อลูกค้า</span>
          <span className="min-w-0 flex-1 truncate border-b border-dotted border-[#9fb39a] font-medium">{bill.customerName ?? ""}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-[#4b5d52]">เลขที่</span>
          <span className="font-semibold tabular-nums">{bill.billNo ? fmtBillNo(bill.billNo) : "—"}</span>
        </div>
        <div />
        <div className="flex gap-2">
          <span className="text-[#4b5d52]">วันที่</span>
          <span className="font-medium">{date}</span>
        </div>
      </div>

      {/* items */}
      <table className="relative mt-4 w-full table-fixed border-collapse">
        <colgroup>
          <col style={{ width: 54 }} />
          <col />
          <col style={{ width: 96 }} />
          <col style={{ width: 70 }} />
          <col style={{ width: 112 }} />
          <col style={{ width: 132 }} />
        </colgroup>
        <thead>
          <tr className="text-[15px] font-semibold text-white" style={{ background: GREEN }}>
            <th className="h-[40px] rounded-l-[10px] text-center">ลำดับ</th>
            <th className="px-2 text-left">รายการ</th>
            <th className="px-2 text-right">จำนวน</th>
            <th className="px-2 text-center">หน่วย</th>
            <th className="px-2 text-right">ราคา/หน่วย</th>
            <th className="rounded-r-[10px] px-3 text-right">จำนวนเงิน</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, i) => {
            const it = bill.items[i];
            return (
              <tr key={i} style={{ background: i % 2 ? "#fafcf8" : undefined }}>
                <td style={cell} className="text-center text-[#4b5d52] tabular-nums">{it ? i + 1 : ""}</td>
                <td style={cell} className="truncate px-2 font-medium">{it?.title}</td>
                <td style={cell} className="px-2 text-right tabular-nums">{it ? fmtQty(it.qty) : ""}</td>
                <td style={cell} className="px-2 text-center text-[#4b5d52]">{it?.unitName}</td>
                <td style={cell} className="px-2 text-right tabular-nums">{it ? fmtMoney(it.unitPrice) : ""}</td>
                <td style={cell} className="px-3 text-right font-semibold tabular-nums">{it ? fmtMoney(it.amount) : ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* totals */}
      <div className="relative mt-4 flex items-stretch gap-4">
        <div className="flex min-w-0 flex-1 flex-col justify-center rounded-[14px] bg-[#f3f7ef] px-4 py-2">
          <div className="text-[13px] text-[#4b5d52]">จำนวนเงิน (ตัวอักษร)</div>
          <div className="text-[16px] leading-snug font-medium">({bahtText(bill.total)})</div>
        </div>
        <div className="flex shrink-0 items-center gap-4 rounded-[14px] px-5 py-2 text-white" style={{ background: "#003020" }}>
          <span className="text-[18px]">รวมทั้งหมด</span>
          <span className="text-[32px] font-bold tabular-nums">{fmtMoney(bill.total)}</span>
          <span className="text-[16px] text-white/70">บาท</span>
        </div>
      </div>

      <div className="relative mt-3 flex items-center gap-6 text-[17px]">
        <span className="font-semibold">การจ่าย</span>
        {(["cash", "transfer"] as const).map((m) => (
          <span key={m} className="flex items-center gap-2">
            <span
              className="grid size-[22px] place-items-center rounded-[6px] border-2 text-[15px] leading-none font-bold text-white"
              style={{ borderColor: bill.paymentMethod === m ? GREEN : "#9fb39a", background: bill.paymentMethod === m ? GREEN : undefined }}
            >
              {bill.paymentMethod === m ? "✓" : ""}
            </span>
            {m === "cash" ? "เงินสด" : "โอน"}
          </span>
        ))}
        {bill.note && <span className="min-w-0 flex-1 truncate text-right text-[15px] text-[#4b5d52]">หมายเหตุ: {bill.note}</span>}
      </div>

      {/* signatures */}
      <div className="relative mt-auto grid grid-cols-2 gap-10 px-4 text-center text-[15px] text-[#4b5d52]">
        {["ผู้ขาย (ลูกค้า)", "ผู้รับซื้อ"].map((who) => (
          <div key={who}>
            <div className="mx-auto mb-1.5 h-[36px] w-[230px] border-b border-dotted border-[#7d917a]" />
            {who}
          </div>
        ))}
      </div>
    </div>
  );
});
