import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig(async ({ mode }) => {
  let componentTagger: (() => unknown) | null = null;
  try {
    const m = await import("lovable-tagger");
    componentTagger = m.componentTagger;
  } catch {
    // optional
  }
  return {
    root: __dirname,
    server: {
      host: "::",
      port: 3000,
      hmr: { overlay: false },
    },
    plugins: [react(), mode === "development" && componentTagger?.()].filter(Boolean),
    resolve: {
      alias: { "@": path.resolve(__dirname, "src") },
    },
  };
});
