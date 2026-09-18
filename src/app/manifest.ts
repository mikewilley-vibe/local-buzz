import type { MetadataRoute } from "next";
import { PRODUCT_NAME, SUPPORTING_DESCRIPTION } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: PRODUCT_NAME,
    short_name: PRODUCT_NAME,
    description: SUPPORTING_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#f6efe4",
    theme_color: "#e8a54b",
    icons: [
      {
        src: "/local-buzz-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/local-buzz-icon-48.png",
        sizes: "48x48",
        type: "image/png",
      },
      {
        src: "/local-buzz-icon-32.png",
        sizes: "32x32",
        type: "image/png",
      },
    ],
  };
}
