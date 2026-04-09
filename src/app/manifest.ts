import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hapus Logistics",
    short_name: "Hapus",
    description: "Modern logistics tracking, booking, and operator operations.",
    start_url: "/",
    display: "standalone",
    background_color: "#0A0D09",
    theme_color: "#D5E400",
    icons: [
      {
        src: "/web-app-manifest-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/web-app-manifest-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
