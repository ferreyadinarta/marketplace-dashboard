import type { MetadataRoute } from "next";

// Web App Manifest → bikin dashboard bisa di-"Add to Home Screen" (PWA),
// syarat untuk push notification (khususnya iOS 16.4+).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pembukuan Marketplace",
    short_name: "Pembukuan",
    description: "Dashboard pembukuan & stok multi-marketplace.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#4f46e5",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
