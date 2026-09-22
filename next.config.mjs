/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The dev-tools badge defaults to the bottom-left, directly over the sidebar's
  // "Sign out" button, so clicks on the left half of that button hit the badge
  // instead. Development-only, but it makes sign-out look broken.
  devIndicators: {
    position: "bottom-right"
  }
  // Deliberately no outputFileTracingRoot. It was set to silence a local warning
  // about a pnpm lockfile in a parent directory, but it changes which files are
  // traced into a serverless bundle — a real risk on Vercel for a cosmetic gain.
};

export default nextConfig;
