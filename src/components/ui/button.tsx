"use client";

import { Slot } from "@radix-ui/react-slot";
import { forwardRef } from "react";
import { cn } from "@/lib/cn";

/**
 * The application button.
 *
 * `asChild` renders the styling onto whatever child is passed — most often a
 * Next <Link> — so a navigation control stays a real anchor (middle-click,
 * open-in-new-tab, crawlable) instead of a button that calls router.push.
 *
 * `loading` disables the button and shows a spinner, which is what stops the
 * double submits that create duplicate payments.
 */
const VARIANTS = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  danger: "btn-danger",
  ghost: "btn-ghost"
} as const;

const SIZES = {
  sm: "px-2.5 py-1.5 text-xs",
  md: "",
  lg: "px-4 py-2.5 text-[15px]"
} as const;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  loading?: boolean;
  asChild?: boolean;
  /** Announced while `loading` is true. */
  loadingText?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading, loadingText, asChild, children, disabled, type, ...props },
  ref
) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      ref={ref}
      // A button inside a form defaults to type="submit", which silently submits
      // when someone means "add a row". Default to "button" unless asked.
      type={asChild ? undefined : (type ?? "button")}
      className={cn(VARIANTS[variant], SIZES[size], className)}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <span
            className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70"
            aria-hidden
          />
          {loadingText ?? children}
        </>
      ) : (
        children
      )}
    </Comp>
  );
});
