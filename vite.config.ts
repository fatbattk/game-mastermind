import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  base: "/game-mastermind/",
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  css: {
    preprocessorOptions: {
      scss: {
        // Silence Sass deprecation warnings from dependencies
        quietDeps: true,
      },
    },
  },
});
