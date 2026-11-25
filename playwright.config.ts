import { defineConfig } from "@playwright/test";

const viewports = [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
];

export default defineConfig({
  testDir: "e2e",
  use: { baseURL: "http://127.0.0.1:3210" },
  webServer: {
    command: "npm run dev -- --port 3210",
    url: "http://127.0.0.1:3210",
    reuseExistingServer: false,
    timeout: 120000,
  },
  projects: viewports.map((viewport) => ({
    name: `${viewport.width}x${viewport.height}`,
    use: { viewport },
  })),
});
