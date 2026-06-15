import { defineConfig } from "vite";
import { offscreenRenderPlugin } from "./examples/vite-offscreen-render-plugin";

export default defineConfig({
	base: "./",
	root: "examples",
	plugins: [offscreenRenderPlugin()],
	build: {
		rollupOptions: {
			input: {
				offscreen: "./examples/offscreen-render.html",
			},
		},
	},
});
