import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Le site est servi par GitHub Pages sous /palmamotel-studio/
export default defineConfig({
  base: "/palmamotel-studio/",
  plugins: [react()],
  test: { environment: "node" },
} as any);
