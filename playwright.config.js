// @ts-check
// 讓 context.route 也攔得到擴充功能背景程式（service worker）發出的請求
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = "1";
const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "tests",
  timeout: 60_000,
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  use: { browserName: "chromium", headless: true },
});
