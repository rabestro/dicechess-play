import { defineConfig, devices } from '@playwright/test';

// End-to-end smoke tests, deliberately pointed at `vite preview` — the BUILT `dist/`, minified
// exactly as it deploys. That is the whole point: vitest imports the Scala.js engine straight from
// node_modules and never bundles it, so a bundler that miscompiles the engine passes every other
// gate (see #185, and `scripts/verify-bundle.mjs` for the narrower engine-only guard).
//
// `npm run build` must have run first — the web server here only serves dist/, it does not build.
const PORT = 4173;

export default defineConfig({
	testDir: 'e2e',
	// A red smoke means the shipped bundle cannot play a game; never let a retry paper over that.
	// Flakiness here is a bug in the test, to be fixed rather than absorbed.
	retries: 0,
	forbidOnly: !!process.env.CI,
	reporter: process.env.CI ? [['github'], ['list']] : [['list']],
	use: {
		baseURL: `http://localhost:${PORT}`,
		trace: 'retain-on-failure',
	},
	// Chromium alone: this suite guards the build pipeline, not browser compatibility.
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		command: `npm run preview -- --port ${PORT} --strictPort`,
		url: `http://localhost:${PORT}`,
		reuseExistingServer: !process.env.CI,
		timeout: 60_000,
	},
});
