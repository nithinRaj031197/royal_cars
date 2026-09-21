/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // A pnpm lockfile in a parent directory made Next infer the wrong workspace
  // root, which affects which files get traced into a standalone build.
  outputFileTracingRoot: import.meta.dirname,
  // The dev-tools badge defaults to the bottom-left, directly over the sidebar's
  // "Sign out" button, so clicks on the left half of that button hit the badge
  // instead. Development-only, but it makes sign-out look broken.
  devIndicators: {
    position: "bottom-right"
  }
};

export default nextConfig;
