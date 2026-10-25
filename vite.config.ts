import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages project sites use /<repository>/; normal builds retain root paths.
const pagesRepo = process.env.GITHUB_PAGES_REPO;
export default defineConfig({
  plugins: [react()],
  base: pagesRepo ? `/${pagesRepo}/` : "/",
});
