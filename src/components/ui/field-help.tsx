"use client";

import * as Popover from "@radix-ui/react-popover";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * The "what is this field?" control that sits next to a label.
 *
 * Built on Radix Popover rather than HoverCard deliberately: HoverCard responds
 * to hover and focus only, which leaves the help unreachable on a phone — and
 * this is a mobile-first app used on the showroom floor. Popover gives tap and
 * keyboard for free; hover is layered on top, and only on devices that actually
 * have a pointer, so a touch device never gets phantom hover states.
 *
 * Accessibility: the trigger is a real <button> with an accessible name, the
 * content is labelled by it, Escape closes, and focus returns to the trigger.
 */
export interface FieldHelpContent {
  /** One sentence: what goes in this field. */
  what: string;
  /** A concrete value someone could type. */
  example?: string;
  /** Anything easy to get wrong — units, effects elsewhere, confidentiality. */
  note?: string;
}

function canHover(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

export function FieldHelp({ label, content }: { label: string; content: FieldHelpContent }) {
  const [open, setOpen] = useState(false);
  const [hoverCapable, setHoverCapable] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Whether the current open came from hovering, which decides if focus should
  // move into the card. A hover-opened card must not steal focus mid-typing.
  const openedByHover = useRef(false);

  useEffect(() => {
    setHoverCapable(canHover());
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const openByHover = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openedByHover.current = true;
    setOpen(true);
  };
  // Small delay so moving the pointer from the icon into the card does not close it.
  const closeSoon = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  const hoverProps = hoverCapable
    ? { onPointerEnter: openByHover, onPointerLeave: closeSoon }
    : {};

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`What is “${label}”?`}
          className={cn(
            "ml-1 inline-grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full align-[-1px]",
            "border border-slate-300 text-[9px] font-semibold leading-none text-slate-400",
            "transition-colors hover:border-slate-400 hover:bg-slate-100 hover:text-slate-600",
            open && "border-slate-400 bg-slate-100 text-slate-600"
          )}
          // A click (or Enter/Space on the button) always works; hover is an
          // enhancement on pointer devices. Deliberately NOT opened on focus:
          // Escape returns focus here, and reopening on that focus would make
          // the card impossible to dismiss with the keyboard.
          onClick={() => {
            openedByHover.current = false;
            setOpen((v) => !v);
          }}
          {...hoverProps}
        >
          <span aria-hidden>i</span>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="top"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          // Keep the card open while the pointer is inside it.
          {...hoverProps}
          // Hover-opened cards leave focus where it was; click- and keyboard-
          // opened ones take focus so Escape and screen readers behave normally.
          onOpenAutoFocus={(e) => {
            if (openedByHover.current) e.preventDefault();
          }}
          className={cn(
            "z-50 w-[min(17.5rem,calc(100vw-1.5rem))] rounded-lg border border-slate-200 bg-white p-2.5",
            "text-left shadow-lg outline-none",
            "data-[state=open]:animate-rise"
          )}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
          <p className="mt-0.5 text-xs leading-snug text-slate-700">{content.what}</p>
          {content.example ? (
            <p className="mt-1.5 text-xs text-slate-600">
              <span className="font-medium text-slate-700">Example: </span>
              <code className="rounded bg-slate-100 px-1 py-px font-mono text-[11px] text-slate-800">
                {content.example}
              </code>
            </p>
          ) : null}
          {content.note ? (
            <p className="mt-1.5 border-t border-slate-100 pt-1.5 text-[11px] leading-snug text-slate-500">
              {content.note}
            </p>
          ) : null}
          <Popover.Arrow className="fill-white" width={11} height={5} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
