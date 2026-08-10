import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          // Do not force Shiki into one chunk: its language grammars are
          // dynamic imports and should stay split so viewing one diff does not
          // load every supported grammar into the webview.
          if (id.includes("/@codemirror/") || id.includes("/@uiw/react-codemirror/"))
            return "codemirror";
          if (id.includes("/recharts/") || id.includes("/d3-")) return "charts";
          if (id.includes("/motion/") || id.includes("/framer-motion/")) return "motion";
          if (id.includes("/date-fns/")) return "date-fns";
          if (id.includes("/material-icon-theme/")) return "material-icons";
          if (id.includes("/@radix-ui/") || id.includes("/radix-ui/")) return "radix";
          if (id.includes("/@base-ui/")) return "base-ui";
          if (id.includes("/@tanstack/")) return "tanstack";
          if (id.includes("/lucide-react/")) return "lucide";
          if (id.includes("/react-dom/") || id.includes("/react/") || id.includes("/scheduler/"))
            return "react";
        },
      },
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
