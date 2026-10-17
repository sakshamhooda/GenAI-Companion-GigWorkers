import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

/** Surface for grouped content. */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 ${className}`}>
      {children}
    </section>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" };

/** 44px-tall button; `variant` picks primary or secondary styling. */
export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  const base =
    "min-h-11 rounded-xl px-4 text-base font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:opacity-50";
  const styles =
    variant === "primary"
      ? "bg-emerald-700 text-white hover:bg-emerald-800"
      : "border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100";
  return <button className={`${base} ${styles} ${className}`} {...props} />;
}

const fieldClass =
  "min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-base text-zinc-900 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100";

/** Visible form label; always pair with an input `id`. */
export function Label({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-zinc-800 dark:text-zinc-200">
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
      <legend className="mb-2 block text-sm font-medium text-zinc-800 dark:text-zinc-200">{label}</legend>
      <div className="flex flex-wrap gap-2" role="group" aria-labelledby={`${id}-legend`}>
        {all.map((o) => {
          const on = value.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(o.value)}
              className={`min-h-11 rounded-full border px-4 text-base font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                on
                  ? "border-emerald-700 bg-emerald-700 text-white"
                  : "border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
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
          const input = (e.currentTarget.previousElementSibling as HTMLInputElement | null);
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
