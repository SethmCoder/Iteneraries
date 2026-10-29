"use client";

import { useEffect, useRef, useState } from "react";
import {
  ACTIVITY_TYPES,
  getActivityType,
  type ActivityTypeId,
} from "@/lib/itinerary/activity-types";

export function ActivityTypePicker({
  value,
  onChange,
  disabled,
}: {
  value: ActivityTypeId;
  onChange: (id: ActivityTypeId) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = getActivityType(value);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-full items-center gap-2 rounded-[8px] border border-input bg-white px-3 text-left text-sm shadow-sm hover:bg-brand-light disabled:opacity-50"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm"
          style={{ background: "var(--brand)", color: "white" }}
          aria-hidden
        >
          {selected.emoji}
        </span>
        <span className="flex-1 font-medium text-foreground">{selected.label}</span>
        <span className="text-xs text-muted">{open ? "▲" : "▼"}</span>
      </button>
      {open ? (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-[10px] border border-border bg-white py-1 shadow-md"
        >
          {ACTIVITY_TYPES.map((opt) => (
            <li key={opt.id} role="option" aria-selected={opt.id === value}>
              <button
                type="button"
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-brand-light ${
                  opt.id === value ? "bg-brand-light" : ""
                }`}
                onClick={() => {
                  onChange(opt.id);
                  setOpen(false);
                }}
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm"
                  style={{ background: "var(--brand)", color: "white" }}
                  aria-hidden
                >
                  {opt.emoji}
                </span>
                <span className="font-medium text-foreground">{opt.label}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
