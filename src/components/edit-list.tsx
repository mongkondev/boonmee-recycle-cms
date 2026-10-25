"use client";

import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Button, cn, Input, Toggle } from "./ui";

export type EditItem = { id: number; name: string; isActive?: boolean; meta?: React.ReactNode };

type Props = {
  items: EditItem[];
  selectedId?: number;
  onSelect?: (id: number) => void;
  onCreate: (name: string) => Promise<string | void>;
  onRename: (id: number, name: string) => Promise<string | void>;
  onDelete: (item: EditItem) => Promise<string | void>;
  onToggle?: (id: number, active: boolean) => Promise<string | void>;
  onReorder: (ids: number[]) => Promise<unknown>;
  placeholder: string;
  extra?: (item: EditItem) => React.ReactNode;
};

/** Ordered list with inline add / rename / delete / active toggle / move up-down. */
export function EditList({ items, selectedId, onSelect, onCreate, onRename, onDelete, onToggle, onReorder, placeholder, extra }: Props) {
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<string | void | unknown>) => {
    setBusy(true);
    setError(undefined);
    const err = await fn();
    if (typeof err === "string") setError(err);
    setBusy(false);
    return typeof err !== "string";
  };

  const move = (idx: number, d: number) => {
    const ids = items.map((i) => i.id);
    [ids[idx], ids[idx + d]] = [ids[idx + d], ids[idx]];
    void run(() => onReorder(ids));
  };

  return (
    <div>
      <form
        className="flex gap-2 p-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!newName.trim()) return;
          if (await run(() => onCreate(newName))) setNewName("");
        }}
      >
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={placeholder} />
        <Button type="submit" disabled={busy || !newName.trim()}>
          <Plus className="size-4" /> เพิ่ม
        </Button>
      </form>
      {error && <p className="mx-3 mb-2 rounded-lg bg-accent-50 px-3 py-2 text-sm text-accent-600">{error}</p>}
      <ul className="divide-y divide-slate-100 border-t border-slate-100">
        {items.length === 0 && <li className="px-4 py-10 text-center text-sm text-slate-400">ยังไม่มีรายการ</li>}
        {items.map((item, idx) => (
          <li
            key={item.id}
            onClick={() => onSelect?.(item.id)}
            className={cn(
              "group flex items-center gap-2 px-3 py-2.5",
              onSelect && "cursor-pointer hover:bg-slate-50",
              selectedId === item.id && "bg-brand-50 hover:bg-brand-50",
            )}
          >
            <div className="flex flex-col opacity-0 transition group-hover:opacity-100">
              <button disabled={idx === 0 || busy} onClick={(e) => { e.stopPropagation(); move(idx, -1); }} className="text-slate-400 hover:text-slate-700 disabled:invisible" title="ขึ้น">
                <ArrowUp className="size-3.5" />
              </button>
              <button disabled={idx === items.length - 1 || busy} onClick={(e) => { e.stopPropagation(); move(idx, 1); }} className="text-slate-400 hover:text-slate-700 disabled:invisible" title="ลง">
                <ArrowDown className="size-3.5" />
              </button>
            </div>
            {editing?.id === item.id ? (
              <form
                className="flex flex-1 items-center gap-1"
                onClick={(e) => e.stopPropagation()}
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (await run(() => onRename(item.id, editing.name))) setEditing(null);
                }}
              >
                <Input autoFocus value={editing.name} onChange={(e) => setEditing({ id: item.id, name: e.target.value })} onKeyDown={(e) => e.key === "Escape" && setEditing(null)} className="h-8" />
                <button className="rounded p-1.5 text-brand-600 hover:bg-brand-50" title="บันทึก"><Check className="size-4" /></button>
                <button type="button" onClick={() => setEditing(null)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100" title="ยกเลิก"><X className="size-4" /></button>
              </form>
            ) : (
              <>
                <div className="min-w-0 flex-1">
                  <div className={cn("truncate text-sm font-medium", item.isActive === false ? "text-slate-400 line-through" : "text-slate-800")}>{item.name}</div>
                  {item.meta && <div className="text-xs text-slate-400">{item.meta}</div>}
                </div>
                {extra?.(item)}
                {onToggle && (
                  <span onClick={(e) => e.stopPropagation()}>
                    <Toggle checked={!!item.isActive} onChange={(v) => void run(() => onToggle(item.id, v))} disabled={busy} label="Active" />
                  </span>
                )}
                <button onClick={(e) => { e.stopPropagation(); setEditing({ id: item.id, name: item.name }); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600" title="แก้ไขชื่อ">
                  <Pencil className="size-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`ลบ "${item.name}"?`)) void run(() => onDelete(item));
                  }}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-accent-50 hover:text-accent-500"
                  title="ลบ"
                >
                  <Trash2 className="size-4" />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
