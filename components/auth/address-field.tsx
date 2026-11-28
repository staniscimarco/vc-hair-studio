"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { CITY, POSTAL_CODE } from "@/lib/validators";

/**
 * Via e numero civico con i suggerimenti delle vie di Brindisi (come su Google Maps).
 * CAP e città sono fissi e stanno in un campo a parte, sotto.
 */
export function AddressField({ defaultValue = "", name = "indirizzo" }: { defaultValue?: string; name?: string }) {
  const [value, setValue] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const skipNext = useRef(false);

  useEffect(() => {
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    const query = value.trim();
    if (query.replace(/[\s,]+\d+[a-zA-Z]?\s*$/, "").length < 3) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch(`/api/indirizzi?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((response) => response.json())
        .then((body) => {
          setSuggestions(body.vie ?? []);
          setActive(-1);
        })
        .catch(() => undefined);
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [value]);

  function choose(street: string) {
    // Mantiene l'eventuale numero civico già scritto.
    const number = value.match(/(\d+[a-zA-Z]?)\s*$/)?.[1];
    skipNext.current = true;
    setValue(number ? `${street} ${number}` : `${street} `);
    setSuggestions([]);
    setOpen(false);
    window.setTimeout(() => input.current?.focus(), 0);
  }

  const showList = open && suggestions.length > 0;

  return (
    <div className="grid gap-3">
      <label className="field">
        Via e numero civico
        <span className="address-wrap">
          <span className="address-input">
            <MapPin size={18} aria-hidden />
            <input
              ref={input}
              name={name}
              value={value}
              placeholder="Es. Via Roma 12"
              autoComplete="off"
              role="combobox"
              aria-controls={`${name}-suggerimenti`}
              aria-expanded={showList}
              aria-autocomplete="list"
              required
              onChange={(event) => {
                setValue(event.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => window.setTimeout(() => setOpen(false), 150)}
              onKeyDown={(event) => {
                if (!showList) return;
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActive((current) => Math.min(suggestions.length - 1, current + 1));
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActive((current) => Math.max(0, current - 1));
                } else if (event.key === "Enter" && active >= 0) {
                  event.preventDefault();
                  choose(suggestions[active]);
                } else if (event.key === "Escape") {
                  setOpen(false);
                }
              }}
            />
          </span>
          {showList ? (
            <ul id={`${name}-suggerimenti`} className="address-suggestions" role="listbox">
              {suggestions.map((street, index) => (
                <li key={street} role="option" aria-selected={index === active}>
                  <button
                    type="button"
                    className={index === active ? "is-active" : ""}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => choose(street)}
                  >
                    <MapPin size={15} aria-hidden />
                    <span>
                      <strong>{street}</strong>
                      <small>{POSTAL_CODE} {CITY}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </span>
        <small className="text-[11px] font-normal text-muted">Scegli la via dai suggerimenti e aggiungi il numero civico.</small>
      </label>
      <label className="field">
        CAP e città
        <input value={`${POSTAL_CODE} ${CITY}`} readOnly tabIndex={-1} aria-readonly="true" className="address-city" />
        <small className="text-[11px] font-normal text-muted">Il servizio è disponibile solo a Brindisi.</small>
      </label>
    </div>
  );
}
