import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Göreli yollar: aynı derleme hem 127.0.0.1 üzerinde hem de GitHub Pages
  // alt dizininde (/hizliokumaprogrami/) çalışır.
  base: "./",
  // Yalnızca bu bilgisayardan erişilir; yerel ağa açılmaz.
  server: { host: "127.0.0.1", port: 5173 },
  preview: { host: "127.0.0.1", port: 4173 },
  build: { chunkSizeWarningLimit: 650 },
});
