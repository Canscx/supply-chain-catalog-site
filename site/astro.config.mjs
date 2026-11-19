import { defineConfig } from "astro/config";

export default defineConfig({
  build: { format: "file", assets: "assets" },
  compressHTML: true,
  devToolbar: { enabled: false },
});
