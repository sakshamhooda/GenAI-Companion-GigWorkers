import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

/** Surface for grouped content. Colours come from the theme tokens in globals.css. */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-border bg-card p-4 shadow-sm ${className}`}>{children}</section>;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" };

/** 44px-tall button; `variant` picks primary or secondary styling. */
export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  const base =
    "min-h-11 rounded-xl px-4 text-base font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50";
  const styles =
    variant === "primary"
      ? "bg-accent text-accent-fg hover:opacity-90"
      : "border border-border bg-card text-fg hover:bg-bg";
  return <button className={`${base} ${styles} ${className}`} {...props} />;
}

const fieldClass =
  "min-h-11 w-full rounded-xl border border-border bg-card px-3 text-base text-fg focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40";

/** Visible form label; always pair with an input `id`. */
export function Label({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-fg">
      {children}
    </label>
  );
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${fieldClass} ${className}`} {...props} />;
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${fieldClass} ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${fieldClass} min-h-28 py-2 ${className}`} {...props} />;
}

/** Inline error message announced to screen readers via role="alert". */
export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-sm text-red-700 dark:text-red-400">
      {children}
    </p>
  );
}

/** Small rounded label for statuses (urgency, connector kind, effort). */
export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warn" | "bad" }) {
  const tones = {
    neutral: "bg-bg text-fg border-border",
    good: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800",
    warn: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800",
    bad: "bg-red-100 text-red-900 border-red-300 dark:bg-red-950 dark:text-red-200 dark:border-red-800",
  };
  return <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

type ChipGroupProps = {
  label: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (next: string[]) => void;
  addLabel?: string;
  addPlaceholder?: string;
  id: string;
};

/** Multi-select as toggle chips. Custom values can be appended when `addLabel` is set. */
export function ChipGroup({ label, options, value, onChange, addLabel, addPlaceholder, id }: ChipGroupProps) {
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  const known = new Set(options.map((o) => o.value));
  const custom = value.filter((v) => !known.has(v));
  const all = [...options, ...custom.map((v) => ({ value: v, label: v }))];
  return (
    <fieldset>
      <legend className="mb-2 block text-sm font-medium text-fg">{label}</legend>
      <div className="flex flex-wrap gap-2" role="group" aria-labelledby={`${id}-legend`}>
        {all.map((o) => {
          const on = value.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(o.value)}
              className={`min-h-11 rounded-full border px-4 text-base font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                on ? "border-accent bg-accent text-accent-fg" : "border-border bg-card text-fg hover:bg-bg"
              }`}
            >
              {on ? "✓ " : ""}
              {o.label}
            </button>
          );
        })}
      </div>
      {addLabel ? (
        <AddChip id={`${id}-add`} label={addLabel} placeholder={addPlaceholder ?? ""} onAdd={(v) => !value.includes(v) && onChange([...value, v])} />
      ) : null}
    </fieldset>
  );
}

function AddChip({ id, label, placeholder, onAdd }: { id: string; label: string; placeholder: string; onAdd: (v: string) => void }) {
  return (
    <div className="mt-2 flex gap-2">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        className={fieldClass}
        placeholder={placeholder}
        autoComplete="off"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const v = e.currentTarget.value.trim();
            if (v) {
              onAdd(v);
              e.currentTarget.value = "";
            }
          }
        }}
      />
      <Button
        type="button"
        variant="secondary"
        onClick={(e) => {
          const input = e.currentTarget.previousElementSibling as HTMLInputElement | null;
          const v = input?.value.trim();
          if (input && v) {
            onAdd(v);
            input.value = "";
          }
        }}
      >
        {label}
      </Button>
    </div>
  );
}
