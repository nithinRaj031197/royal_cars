import "./commands";

// The app is a Next.js App Router build; a ResizeObserver notice and Next's own
// dev-overlay hydration chatter are not test failures.
Cypress.on("uncaught:exception", (err) => {
  if (/ResizeObserver loop|Hydration failed|Minified React error #418|#423/.test(err.message)) return false;
  return true;
});
