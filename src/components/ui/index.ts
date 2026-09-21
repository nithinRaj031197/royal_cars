/**
 * Shared UI library — Radix primitives + Tailwind, in the shadcn/ui style.
 *
 * Every screen imports from here (`@/components/ui`) rather than reaching for a
 * component file directly, so a component can be moved or split without a
 * repo-wide rename. Radix supplies behaviour and accessibility; Tailwind
 * supplies styling through the `.btn-*`, `.input`, `.card` and `.badge` classes
 * in globals.css; the wrapper source below is ours to edit.
 *
 * Adding a primitive: install that one `@radix-ui/react-*` package, add a
 * wrapper file here, and export it from this barrel.
 */

// Actions
export { Button, type ButtonProps } from "./button";
export { ConfirmDialog } from "./confirm-dialog";
export { Toaster, toast } from "./toast";

// Forms
export { Field } from "./field";
export { FieldHelp, type FieldHelpContent } from "./field-help";

// Data display
export { StatusBadge } from "./badge";
export { Money, DateText, Ref } from "./money";
export { StatCard } from "./stat-card";
export { PageHeader } from "./page-header";

// Feedback
export { EmptyState, ErrorState, Loading, Skeleton } from "./states";
