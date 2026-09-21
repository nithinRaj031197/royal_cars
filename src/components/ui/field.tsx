"use client";

import { cloneElement, isValidElement, useId } from "react";
import { FieldHelp } from "./field-help";
import { lookupFieldHelp } from "@/lib/field-help";

/**
 * Label + control + help + error, wired together correctly.
 *
 * Does three things every form would otherwise have to remember:
 *  - associates the label with the control (`htmlFor`/`id`), without which a
 *    screen reader announces an unnamed input,
 *  - points `aria-describedby` at the error or hint and marks `aria-invalid`,
 *  - looks up the field's explanation by label from `@/lib/field-help`, so the
 *    wording for a concept lives in one place.
 */
export function Field({
  label,
  error,
  hint,
  children,
  required,
  help
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  required?: boolean;
  /** Set false to suppress the help icon on a field that needs no explanation. */
  help?: boolean;
}) {
  const reactId = useId();
  const helpContent = help === false ? undefined : lookupFieldHelp(label);

  const controlId = `${reactId}-control`;
  const errorId = `${reactId}-error`;
  const hintId = `${reactId}-hint`;
  const describedBy = [error ? errorId : null, hint && !error ? hintId : null].filter(Boolean).join(" ");

  const control = isValidElement<Record<string, unknown>>(children)
    ? cloneElement(children, {
        id: (children.props.id as string | undefined) ?? controlId,
        "aria-describedby": describedBy || undefined,
        "aria-invalid": error ? true : undefined
      })
    : children;

  return (
    <div>
      {/* The help button is a sibling of the label, never inside it: a button
          within a <label> also activates the control, which would toggle a
          checkbox just for reading its description. */}
      <div className="mb-1.5 flex items-center">
        <label className="label mb-0" htmlFor={controlId}>
          {label}
          {required ? <span className="text-red-600"> *</span> : null}
        </label>
        {helpContent ? <FieldHelp label={label} content={helpContent} /> : null}
      </div>
      {control}
      {hint && !error ? (
        <p id={hintId} className="mt-1.5 text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="error-text" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
