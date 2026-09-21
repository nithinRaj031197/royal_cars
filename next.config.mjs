/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // A pnpm lockfile in a parent directory made Next infer the wrong workspace
  // root, which affects which files get traced into a standalone build.
  outputFileTracingRoot: import.meta.dirname
};

export default nextConfig;
