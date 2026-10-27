"use client";

import { AIRLINE_ALLIANCES, AIRLINES } from "@/lib/flights/airlines";

export function AirlinePreferenceSelect({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor="preferred-airlines" className="text-sm font-medium">
        Preferred airlines
      </label>
      <select
        id="preferred-airlines"
        className="h-10 w-full rounded-[8px] border border-input bg-white px-3 text-sm"
        value=""
        onChange={(e) => {
          const code = e.target.value;
          if (!code) return;
          if (!value.includes(code)) onChange([...value, code]);
          e.target.value = "";
        }}
      >
        <option value="">Add airline…</option>
        {AIRLINES.map((a) => (
          <option key={a.code} value={a.code} disabled={value.includes(a.code)}>
            {a.code} — {a.name}
          </option>
        ))}
      </select>
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((code) => {
            const meta = AIRLINES.find((a) => a.code === code);
            return (
              <button
                key={code}
                type="button"
                className="rounded-[8px] border border-brand bg-brand-light px-2 py-0.5 text-xs font-medium text-brand"
                onClick={() => onChange(value.filter((c) => c !== code))}
                title="Remove"
              >
                {meta ? `${code} · ${meta.name}` : code} ×
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-[11px] text-muted">Optional — leave empty for any airline</p>
      )}
    </div>
  );
}

export function AlliancePreferenceSelect({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor="preferred-alliances" className="text-sm font-medium">
        Preferred alliances
      </label>
      <select
        id="preferred-alliances"
        className="h-10 w-full rounded-[8px] border border-input bg-white px-3 text-sm"
        value=""
        onChange={(e) => {
          const id = e.target.value;
          if (!id) return;
          if (!value.includes(id)) onChange([...value, id]);
          e.target.value = "";
        }}
      >
        <option value="">Add alliance…</option>
        {AIRLINE_ALLIANCES.map((a) => (
          <option key={a.id} value={a.id} disabled={value.includes(a.id)}>
            {a.label}
          </option>
        ))}
      </select>
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((id) => {
            const meta = AIRLINE_ALLIANCES.find((a) => a.id === id);
            return (
              <button
                key={id}
                type="button"
                className="rounded-[8px] border border-brand bg-brand-light px-2 py-0.5 text-xs font-medium text-brand"
                onClick={() => onChange(value.filter((c) => c !== id))}
                title="Remove"
              >
                {meta?.label ?? id} ×
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-[11px] text-muted">Optional — leave empty for any alliance</p>
      )}
    </div>
  );
}
