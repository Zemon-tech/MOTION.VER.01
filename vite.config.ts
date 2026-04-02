import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Each heavy lib gets its own named chunk so you can verify
          // in the build output that they are NOT in the main bundle.
          if (id.includes("node_modules/mermaid")) return "vendor-mermaid"
          if (id.includes("node_modules/three")) return "vendor-three"
          // monaco-editor is in package.json but unused; guard it anyway.
          if (id.includes("node_modules/monaco-editor")) return "vendor-monaco"
        },
      },
    },
  },
})