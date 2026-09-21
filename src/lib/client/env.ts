/**
 * Client-side environment helpers.
 *
 * Demo mode is deliberately NOT read from a NEXT_PUBLIC_* copy: a second
 * variable can disagree with the server's DEMO_MODE, which is exactly how the
 * sign-in page once offered Google in demo mode. Server components read
 * `envConfig.demoMode` and pass it down as a prop instead.
 */
export function envFlag(name: string): boolean {
  return typeof process !== "undefined" && process.env[name] === "1";
}
