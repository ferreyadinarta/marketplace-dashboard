import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // file yang ikut ter-trace tapi tidak pernah di-load (Prisma pakai runtime/library.js
  // + engine native; gambar dioptimasi Vercel) → ±70 MB per function
  outputFileTracingExcludes: {
    "*": [
      "node_modules/@prisma/client/runtime/*.wasm-base64.*",
      "node_modules/@prisma/client/runtime/query_engine_bg.*",
      "node_modules/@prisma/client/runtime/query_compiler_bg.*",
      "node_modules/@prisma/client/runtime/wasm-*",
      "node_modules/@prisma/client/runtime/edge*",
      "node_modules/@prisma/client/runtime/react-native.*",
      "node_modules/@prisma/client/runtime/binary.*",
      "node_modules/@prisma/client/runtime/client.*",
      "node_modules/@img/**",
      "node_modules/sharp/**",
    ],
  },
  async headers() {
    return [
      {
        // service worker harus disajikan sebagai JS & tidak di-cache
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
