"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  BookOpen, CalendarRange, Layers, GraduationCap, Sparkles,
  Users, ClipboardList, FileText, ChevronDown, TrendingUp,
} from "lucide-react";
import type { GradeLevel, Subject } from "../services";
import type { Tab } from "../utils";

export function TabIcon({ id, className }: { id: Tab; className?: string }) {
  const cn = className || "h-4 w-4";
  switch (id) {
    case "overview":
      return <Sparkles className={cn} />;
    case "years":
      return <CalendarRange className={cn} />;
    case "classes":
      return <Layers className={cn} />;
    case "subjects":
      return <BookOpen className={cn} />;
    case "teachers":
      return <Users className={cn} />;
    case "marks":
      return <ClipboardList className={cn} />;
    case "report-cards":
      return <FileText className={cn} />;
    case "progress":
      return <TrendingUp className={cn} />;
    case "promotion":
      return <GraduationCap className={cn} />;
    default:
      return <BookOpen className={cn} />;
  }
}


export function useMenuPosition(open: boolean, anchorRef: { current: HTMLElement | null }) {
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setCoords(null);
      return;
    }
    const update = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const gap = 6;
      const pad = 12;
      const spaceBelow = window.innerHeight - r.bottom - gap - pad;
      const spaceAbove = r.top - gap - pad;
      const openUp = spaceBelow < 200 && spaceAbove > spaceBelow;
      const maxHeight = Math.min(400, Math.max(160, openUp ? spaceAbove : spaceBelow));
      let top = openUp ? r.top - gap - maxHeight : r.bottom + gap;
      top = Math.min(Math.max(pad, top), window.innerHeight - pad - Math.min(maxHeight, 120));
      let left = r.left;
      const width = Math.max(r.width, 180);
      if (left + width > window.innerWidth - pad) {
        left = Math.max(pad, window.innerWidth - pad - width);
      }
      setCoords({ top, left, width, maxHeight });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, anchorRef]);

  return coords;
}

type MenuOption = { value: string; label: string };

export function PortalSelectMenu({
  value,
  onChange,
  options,
  placeholder,
  emptyLabel,
  className,
  triggerClassName,
}: {
  value: string;
  onChange: (v: string) => void;
  options: MenuOption[];
  placeholder?: string;
  emptyLabel?: string;
  className?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const coords = useMenuPosition(open, btnRef);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const node = e.target as Node;
      if (btnRef.current?.contains(node) || menuRef.current?.contains(node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const label = selected?.label || emptyLabel || placeholder || "Select…";

  const baseTrigger =
    "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring mt-0.5";

  const menu =
    mounted && open && coords
      ? createPortal(
          <div
            ref={menuRef}
            role="listbox"
            className="fixed z-[2147483000] rounded-md border border-border bg-white shadow-2xl py-1 overflow-y-auto overscroll-contain"
            style={{
              top: coords.top,
              left: coords.left,
              width: coords.width,
              maxHeight: coords.maxHeight,
            }}
          >
            {emptyLabel != null ? (
              <button
                type="button"
                role="option"
                className={`w-full text-left px-3 py-2 text-sm hover:bg-primary/10 ${
                  value === "" ? "bg-primary/10 font-medium text-primary" : "text-foreground"
                }`}
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                {emptyLabel}
              </button>
            ) : null}
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                role="option"
                className={`w-full text-left px-3 py-2 text-sm hover:bg-primary/10 ${
                  o.value === value ? "bg-primary/10 font-medium text-primary" : "text-foreground"
                }`}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                {o.label}
              </button>
            ))}
            {options.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">No options</p>
            ) : null}
          </div>,
          document.body
        )
      : null;

  return (
    <div className={className || "relative w-full"}>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={triggerClassName ? `${baseTrigger} ${triggerClassName}` : baseTrigger}
      >
        <span className={`truncate text-left ${selected ? "text-foreground" : "text-muted-foreground"}`}>
          {label}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 opacity-50 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {menu}
    </div>
  );
}

export function GradeSelect({
  grades,
  value,
  onChange,
  placeholder = "Select grade…",
  emptyLabel,
  className,
  getLabel,
}: {
  grades: GradeLevel[];
  value: number | "";
  onChange: (v: number | "") => void;
  placeholder?: string;
  emptyLabel?: string;
  className?: string;
  getLabel?: (g: GradeLevel) => string;
}) {
  const sorted = useMemo(
    () => grades.slice().sort((a, b) => a.order - b.order),
    [grades]
  );
  const options = useMemo(
    () =>
      sorted.map((g) => ({
        value: String(g.id),
        label: getLabel ? getLabel(g) : g.name,
      })),
    [sorted, getLabel]
  );
  return (
    <PortalSelectMenu
      value={value === "" ? "" : String(value)}
      onChange={(v) => onChange(v === "" ? "" : Number(v))}
      options={options}
      placeholder={placeholder}
      emptyLabel={emptyLabel}
      className={className}
    />
  );
}

export function SubjectSelect({
  subjects,
  value,
  onChange,
  placeholder = "Select subject…",
  emptyLabel = "Select subject…",
  className,
}: {
  subjects: Subject[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  emptyLabel?: string;
  className?: string;
}) {
  const options = useMemo(
    () =>
      subjects
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((s) => ({
          value: String(s.id),
          label: s.code ? `${s.name} (${s.code})` : s.name,
        })),
    [subjects]
  );
  return (
    <PortalSelectMenu
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      emptyLabel={emptyLabel}
      className={className}
    />
  );
}


export function ReadinessRing({ score }: { score: number }) {
  const r = 36;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  const color = score >= 80 ? "#0F766E" : score >= 50 ? "#D97706" : "#EA580C";
  return (
    <div suppressHydrationWarning className="flex items-center gap-3 bg-white border border-border rounded-2xl px-4 py-3 shadow-card">
      <svg width="88" height="88" className="-rotate-90">
        <circle cx="44" cy="44" r={r} fill="none" stroke="#E7E5E4" strokeWidth="8" />
        <circle
          cx="44" cy="44" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
        />
      </svg>
      <div>
        <p className="text-2xl font-bold text-textPrimary">{score}%</p>
        <p className="text-xs text-textMuted font-medium">Structure readiness</p>
        <p className="text-[11px] text-textMuted">Unique to your school setup</p>
      </div>
    </div>
  );
}


export function Empty({ hint }: { hint: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-white/60 py-14 text-center text-textMuted">
      Nothing here yet — {hint}
    </div>
  );
}
