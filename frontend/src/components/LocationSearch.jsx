import React, { useState, useRef, useEffect, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Nominatim autocomplete component
// Props:
//   id          – input element id (for accessibility)
//   value       – controlled string value
//   onChange    – (stringValue) => void  (updates parent state text)
//   onSelect    – ({ displayName, lat, lng }) => void  (location chosen)
//   placeholder – input placeholder text
//   icon        – JSX icon element rendered inside the input
// ─────────────────────────────────────────────────────────────────────────────

const NOMINATIM = "https://nominatim.openstreetmap.org/search";

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export default function LocationSearch({
  id,
  value,
  onChange,
  onSelect,
  placeholder = "Search location…",
  icon,
}) {
  const [results, setResults]       = useState([]);
  const [loading, setLoading]       = useState(false);
  const [open,    setOpen]          = useState(false);
  const [active,  setActive]        = useState(-1);   // keyboard nav index
  const inputRef                    = useRef(null);
  const listRef                     = useRef(null);
  const abortRef                    = useRef(null);

  // ── Nominatim fetch (debounced 350 ms) ──────────────────────────────────
  const fetchSuggestions = useCallback(
    debounce(async (query) => {
      if (!query || query.trim().length < 1) {
        setResults([]);
        setOpen(false);
        return;
      }
      // Cancel previous in-flight request
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      try {
        const params = new URLSearchParams({
          q:              query,
          format:         "json",
          limit:          "7",
          addressdetails: "1",
          "accept-language": "en",
        });
        const res = await fetch(`${NOMINATIM}?${params}`, {
          signal:  controller.signal,
          headers: { "User-Agent": "GreenPath-SustainableTransitHub/1.0" },
        });
        if (!res.ok) throw new Error("Nominatim error");
        const data = await res.json();
        setResults(data);
        setOpen(data.length > 0);
        setActive(-1);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Nominatim suggestion fetch failed:", err);
          setResults([]);
          setOpen(false);
        }
      } finally {
        setLoading(false);
      }
    }, 350),
    []
  );

  // ── Input change handler ─────────────────────────────────────────────────
  const handleChange = (e) => {
    const v = e.target.value;
    onChange(v);
    fetchSuggestions(v);
  };

  // ── Select a suggestion ──────────────────────────────────────────────────
  const handleSelect = (item) => {
    const displayName = item.display_name;
    onChange(displayName);
    onSelect({
      displayName,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
    });
    setResults([]);
    setOpen(false);
    setActive(-1);
    inputRef.current?.blur();
  };

  // ── Keyboard navigation ──────────────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && results[active]) {
        handleSelect(results[active]);
      } else if (results.length === 1) {
        // Auto-select if only one result
        handleSelect(results[0]);
      }
      // else: allow form submit with typed text
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  };

  // ── Close on outside click ───────────────────────────────────────────────
  useEffect(() => {
    const onClickOut = (e) => {
      if (
        inputRef.current && !inputRef.current.contains(e.target) &&
        listRef.current  && !listRef.current.contains(e.target)
      ) {
        setOpen(false);
        setActive(-1);
      }
    };
    document.addEventListener("mousedown", onClickOut);
    return () => document.removeEventListener("mousedown", onClickOut);
  }, []);

  // ── Scroll active item into view ─────────────────────────────────────────
  useEffect(() => {
    if (active < 0 || !listRef.current) return;
    const el = listRef.current.children[active];
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [active]);

  // ── Format a Nominatim result for display ────────────────────────────────
  const formatLabel = (item) => {
    const a = item.address || {};
    const parts = [
      a.road || a.pedestrian || a.amenity || a.neighbourhood,
      a.suburb || a.village || a.town || a.city_district,
      a.city || a.county,
      a.state,
      a.country,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : item.display_name;
  };

  const formatSub = (item) => {
    const a = item.address || {};
    return [a.state, a.country].filter(Boolean).join(", ");
  };

  const formatType = (item) => {
    return item.type
      ? item.type.replace(/_/g, " ")
      : item.class || "";
  };

  return (
    <div className="relative w-full">
      {/* Input */}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            {icon}
          </div>
        )}
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setOpen(true);
            else if (value.trim().length >= 1) fetchSuggestions(value);
          }}
          autoComplete="off"
          placeholder={placeholder}
          className={`w-full ${icon ? "pl-9" : "pl-3.5"} pr-9 bg-white dark:bg-neutral-900
            border border-neutral-200 dark:border-neutral-800 rounded-lg py-2 px-3.5
            text-sm text-neutral-900 dark:text-white
            focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary
            transition-all`}
        />
        {/* Loading spinner or clear button */}
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center">
          {loading ? (
            <span className="w-4 h-4 border-2 border-neutral-300 dark:border-neutral-600 border-t-primary rounded-full animate-spin" />
          ) : value ? (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => {
                onChange("");
                setResults([]);
                setOpen(false);
                inputRef.current?.focus();
              }}
              className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          ) : null}
        </div>
      </div>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <ul
          ref={listRef}
          className="absolute top-full left-0 right-0 mt-1 z-[9999]
            bg-white dark:bg-neutral-900
            border border-neutral-200 dark:border-neutral-700
            rounded-xl shadow-2xl overflow-hidden overflow-y-auto max-h-72
            divide-y divide-neutral-100 dark:divide-neutral-800"
        >
          {results.map((item, idx) => (
            <li
              key={item.place_id}
              onMouseDown={(e) => {
                // Use mousedown so blur doesn't close before select fires
                e.preventDefault();
                handleSelect(item);
              }}
              onMouseEnter={() => setActive(idx)}
              className={`flex items-start gap-3 px-3 py-2.5 cursor-pointer transition-colors
                ${active === idx
                  ? "bg-primary/10 dark:bg-primary/15"
                  : "hover:bg-neutral-50 dark:hover:bg-neutral-800"
                }`}
            >
              {/* Place type icon */}
              <div className="flex-shrink-0 mt-0.5 w-7 h-7 rounded-lg bg-neutral-100 dark:bg-neutral-800
                flex items-center justify-center text-neutral-500 dark:text-neutral-400">
                {placeTypeIcon(item.class, item.type)}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold truncate ${
                  active === idx
                    ? "text-primary dark:text-emerald-400"
                    : "text-neutral-900 dark:text-white"
                }`}>
                  {formatLabel(item)}
                </p>
                <p className="text-2xs text-neutral-400 dark:text-neutral-500 truncate mt-0.5">
                  <span className="capitalize text-neutral-500 dark:text-neutral-400 font-medium">
                    {formatType(item)}
                  </span>
                  {formatSub(item) && <> · {formatSub(item)}</>}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Tiny helper: returns a small SVG icon based on OSM place type ──────────
function placeTypeIcon(cls, type) {
  const t = (type || "").toLowerCase();
  const c = (cls  || "").toLowerCase();

  if (t === "railway_station" || t === "station")
    return <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="9" rx="2"/><path d="M3 11V8a5 5 0 0110 0v3"/><line x1="9" y1="20" x2="7" y2="23"/><line x1="15" y1="20" x2="17" y2="23"/></svg>;
  if (t === "university" || t === "college")
    return <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
  if (t === "hospital" || t === "clinic")
    return <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9a2 2 0 012-2h14a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>;
  if (c === "highway" || t === "road" || t === "street")
    return <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l6-12 6 12"/><path d="M21 17l-6-12-6 12"/></svg>;
  if (c === "amenity" || t === "restaurant" || t === "cafe" || t === "bar")
    return <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>;
  if (t === "city" || t === "town" || t === "village")
    return <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>;
  // Default: map pin
  return <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>;
}
