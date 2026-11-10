import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Old auth URLs keep working.
      { source: "/auth", destination: "/login", permanent: false },
      { source: "/auth/forgot-password", destination: "/login?mode=forgot", permanent: false },
      { source: "/auth/reset-password", destination: "/login?mode=forgot", permanent: false },
      { source: "/signup", destination: "/register", permanent: false },
      { source: "/sign-in", destination: "/login", permanent: false },
      { source: "/student", destination: "/dashboard", permanent: false },
      { source: "/student/dashboard", destination: "/dashboard", permanent: false },
      { source: "/parent", destination: "/parent/dashboard", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
