import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The startup schema check reads these files at runtime, so they must be
  // traced into the serverless output alongside the instrumentation bundle.
  outputFileTracingIncludes: {
    "/**/*": ["./migrations/**/*.sql"],
  },
};

export default nextConfig;
