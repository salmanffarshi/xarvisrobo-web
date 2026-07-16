import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Custom Cloudinary loader (src/lib/cloudinary-loader.ts): next/image srcset
    // points at Cloudinary-optimized derivatives (f_auto,q_auto,w_<width>), NOT
    // Vercel's metered image optimizer. See the loader file for the rationale.
    loader: "custom",
    loaderFile: "./src/lib/cloudinary-loader.ts",
  },
};

export default nextConfig;
