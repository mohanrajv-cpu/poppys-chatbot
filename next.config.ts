import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdfjs-dist', 'pdf-to-img', 'tesseract.js', 'canvas'],
};

export default nextConfig;
