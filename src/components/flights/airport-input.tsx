"use client";

import { useDeferredValue, useState } from "react";
import { Input } from "@/components/ui/input";
import { searchAirports, type AirportOption } from "@/lib/flights/airports";

export function AirportInput({
  id,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const deferred = useDeferredValue(value.trim());
  const results: AirportOption[] =
    deferred.length >= 1 ? searchAirports(deferred, 8) : [];

  return (
    <div className="relative">
      <Input
        id={id}
        value={value}
        disabled={disabled}
        placeholder={placeholder ?? "SFO or San Francisco"}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && results.length > 0 ? (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-[8px] border border-border bg-white shadow-sm">
          {results.map((r) => (
            <li key={r.code}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-brand-light"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(r.code);
                  setOpen(false);
                }}
              >
                <span className="font-semibold text-brand">{r.code}</span>{" "}
                <span className="text-foreground">
                  {r.city} — {r.name}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
