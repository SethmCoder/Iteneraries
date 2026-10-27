"use client";

import { useEffect, useId, useState } from "react";
import { Input } from "@/components/ui/input";
import type { AirportOption } from "@/lib/flights/airports";

export function AirportInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  id: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const listId = useId();
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<AirportOption[]>([]);
  const [open, setOpen] = useState(false);
  const [resolved, setResolved] = useState<AirportOption | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setQuery(value);
    if (value.trim().length === 3) {
      void fetch(`/api/flights/airports?q=${encodeURIComponent(value.trim())}`)
        .then((r) => r.json())
        .then((data) => {
          const match = (data.results as AirportOption[] | undefined)?.find(
            (a) => a.code.toUpperCase() === value.trim().toUpperCase(),
          );
          setResolved(match ?? null);
        })
        .catch(() => setResolved(null));
    } else {
      setResolved(null);
    }
  }, [value]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      setResults([]);
      return;
    }
    const handle = setTimeout(() => {
      setLoading(true);
      void fetch(`/api/flights/airports?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((data) => {
          setResults(data.results ?? []);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 160);
    return () => clearTimeout(handle);
  }, [query]);

  function pick(airport: AirportOption) {
    onChange(airport.code);
    setQuery(airport.code);
    setResolved(airport);
    setOpen(false);
  }

  return (
    <div className="relative space-y-1.5">
      {label ? <span className="sr-only">{label}</span> : null}
      <Input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        value={query}
        disabled={disabled}
        placeholder={placeholder ?? "Search city or airport code"}
        autoComplete="off"
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          setOpen(true);
          // Keep form value as typed until a pick; clear code if user edits away
          if (next.trim().toUpperCase() !== value) {
            onChange(next.trim().length === 3 ? next.trim().toUpperCase() : next);
          }
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setTimeout(() => setOpen(false), 150);
          // On blur, if best match is clear, lock to IATA code
          const best = results[0];
          if (best && query.trim().length >= 2) {
            const q = query.trim().toLowerCase();
            if (
              best.code.toLowerCase() === q ||
              best.city.toLowerCase().startsWith(q) ||
              best.name.toLowerCase().startsWith(q)
            ) {
              pick(best);
            }
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && results[0]) {
            e.preventDefault();
            pick(results[0]);
          }
        }}
      />
      {resolved ? (
        <p className="text-[11px] text-muted">
          Using <span className="font-semibold text-brand">{resolved.code}</span> ·{" "}
          {resolved.city}
          {resolved.name ? ` — ${resolved.name}` : ""}
          {resolved.country ? ` (${resolved.country})` : ""}
        </p>
      ) : query.trim().length >= 2 && !loading && results.length === 0 ? (
        <p className="text-[11px] text-warning">No matching airport</p>
      ) : null}

      {open && results.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-[8px] border border-border bg-white shadow-sm"
        >
          {results.map((r, index) => (
            <li key={r.code} role="option" aria-selected={index === 0}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-brand-light"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(r)}
              >
                <span className="font-semibold text-brand">{r.code}</span>{" "}
                <span className="text-foreground">
                  {r.city} — {r.name}
                </span>
                {r.country ? (
                  <span className="text-muted"> · {r.country}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
