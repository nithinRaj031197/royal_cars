"use client";

import { Toaster as Sonner, toast } from "sonner";

/**
 * Transient feedback for actions that succeed.
 *
 * Errors stay inline next to the field or form that caused them — a toast that
 * disappears is the wrong place for something the user must act on. Toasts are
 * for confirmations ("Payment recorded") where the work is already done and the
 * page has usually moved on.
 */
export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      closeButton
      duration={4000}
      toastOptions={{
        classNames: {
          toast: "rounded-xl border border-slate-200 bg-white text-slate-900 shadow-lg",
          description: "text-slate-600",
          actionButton: "btn-primary",
          cancelButton: "btn-secondary"
        }
      }}
    />
  );
}

export { toast };
