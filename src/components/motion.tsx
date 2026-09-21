"use client";

import { Children, cloneElement, isValidElement, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { LazyMotion, domAnimation, m, useReducedMotion, AnimatePresence } from "framer-motion";
import type { Transition } from "framer-motion";

/**
 * Motion primitives for the admin portal.
 *
 * Deliberately restrained: this is a tool staff use dozens of times a day, so
 * movement is short (<=220ms), only ever on entry, and never blocks input.
 * Everything collapses to an instant, opacity-only change when the viewer has
 * asked for reduced motion.
 *
 * `LazyMotion` + `m` ships the small animation feature set rather than the full
 * `motion` bundle.
 */

const EASE_OUT: Transition = { duration: 0.22, ease: [0.16, 1, 0.3, 1] };

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <LazyMotion features={domAnimation}>{children}</LazyMotion>;
}

/**
 * Fades a page's content in on client-side navigation.
 *
 * Critically, the FIRST render (server HTML and hydration) uses `initial={false}`
 * so the markup ships fully visible. Setting an initial opacity of 0 here means
 * the server sends `style="opacity:0"` and the page stays blank until Framer
 * Motion hydrates — which looks exactly like a broken link if the route's JS is
 * still loading, and stays blank forever if that JS fails. Content must never
 * depend on JavaScript to become visible.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const pathname = usePathname();
  const firstRender = useRef(true);

  useEffect(() => {
    firstRender.current = false;
  }, []);

  return (
    <m.div
      key={pathname}
      initial={firstRender.current ? false : reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0.12 } : EASE_OUT}
    >
      {children}
    </m.div>
  );
}

/**
 * Wraps a list/grid so its children appear in a quick stagger.
 *
 * The entrance is a CSS animation, not a JS one: CSS arrives with the document,
 * so the tiles animate immediately and — more importantly — are visible even if
 * scripts are slow, blocked or broken. `Stagger` only assigns the delays.
 * Pass `label` to render a landmark <section aria-label=…> instead of a div.
 */
export function Stagger({
  children,
  className,
  label
}: {
  children: React.ReactNode;
  className?: string;
  label?: string;
}) {
  const Tag = label ? "section" : "div";
  return (
    <Tag className={className} aria-label={label}>
      {Children.map(children, (child, i) =>
        isValidElement<{ style?: React.CSSProperties }>(child)
          ? cloneElement(child, {
              style: { ...(child.props.style ?? {}), animationDelay: `${Math.min(i, 12) * 35}ms` }
            })
          : child
      )}
    </Tag>
  );
}

/** A single staggered child. Use inside <Stagger>. */
export function StaggerItem({
  children,
  className,
  style
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`animate-rise ${className ?? ""}`} style={style}>
      {children}
    </div>
  );
}

/** Mobile navigation drawer + backdrop. */
export function NavDrawer({
  open,
  onClose,
  children
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  return (
    <>
      {/* Desktop: a permanently pinned rail. The page reserves space for it with
          lg:pl-64, so it must stay `fixed` — making it static here drops it into
          normal flow and pushes the content below it. */}
      <aside
        className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:block lg:w-64"
        aria-label="Main navigation"
      >
        {children}
      </aside>

      <AnimatePresence>
        {open ? (
          <>
            <m.div
              className="fixed inset-0 z-30 bg-ink-950/50 lg:hidden"
              aria-hidden
              onClick={onClose}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            />
            <m.aside
              className="fixed inset-y-0 left-0 z-40 w-[17rem] max-w-[85vw] bg-ink-900 shadow-2xl lg:hidden"
              aria-label="Main navigation"
              initial={reduced ? { opacity: 0 } : { x: "-100%" }}
              animate={reduced ? { opacity: 1 } : { x: 0 }}
              exit={reduced ? { opacity: 0 } : { x: "-100%" }}
              transition={reduced ? { duration: 0.12 } : { type: "spring", stiffness: 420, damping: 38 }}
            >
              {children}
            </m.aside>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}

/** Press feedback for primary actions. */
export function Tappable({
  children,
  className,
  ...rest
}: React.ComponentProps<typeof m.div> & { className?: string }) {
  const reduced = useReducedMotion();
  return (
    <m.div className={className} whileTap={reduced ? undefined : { scale: 0.98 }} {...rest}>
      {children}
    </m.div>
  );
}
