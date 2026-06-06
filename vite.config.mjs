import { svelte } from "@sveltejs/vite-plugin-svelte";
import autoprefixer from "autoprefixer";
import postcssPresetEnv from "postcss-preset-env";
import { sveltePreprocess } from "svelte-preprocess";

import moduleJSON from "./module.json" with { type: "json" };

const s_PACKAGE_ID = `modules/${moduleJSON.id}`;

// A short additional string to add to Svelte CSS hash values to make this module's
// scoped styles unique in the browser debugger.
const s_SVELTE_HASH_ID = "tk";

const s_SOURCEMAPS = true; // Generate sourcemaps for the bundle (recommended).

const postcss = {
	inject: false,
	sourceMap: s_SOURCEMAPS,
	extensions: [".css"],
	plugins: [autoprefixer, postcssPresetEnv]
};

export default ({ mode }) => {
	const compilerOptions =
		mode === "production"
			? {
					cssHash: ({ hash, css }) => `svelte-${s_SVELTE_HASH_ID}-${hash(css)}`
				}
			: {};

	/** @type {import('vite').UserConfig} */
	return {
		root: "src/", // Source location / esbuild root.
		base: `/${s_PACKAGE_ID}/dist`, // Base module path that 29999 / served dev directory.
		publicDir: false, // No public resources to copy.
		cacheDir: "../.vite-cache", // Relative from root directory.

		resolve: {
			conditions: ["browser", "import"]
		},

		esbuild: {
			target: ["es2022"]
		},

		css: { postcss },

		// About server options:
		// - Set `open` to boolean `false` to not open a browser window automatically.
		//
		// - The top proxy entry redirects requests under the module path for the compiled CSS and the static
		//   `assets`, `lang`, `packs` directories, pulling them from the main Foundry / 30000 server.
		server: {
			port: 29999,
			open: "/game",
			proxy: {
				// Serves static files from main Foundry server.
				[`^(/${s_PACKAGE_ID}/(assets|lang|packs|dist/${moduleJSON.id}.css))`]: "http://localhost:30000",

				// All other paths besides package ID path are served from main Foundry server.
				[`^(?!/${s_PACKAGE_ID}/)`]: "http://localhost:30000",

				// Rewrite incoming `module-id.js` request from Foundry to the dev server `module.js`.
				[`/${s_PACKAGE_ID}/dist/${moduleJSON.id}.js`]: {
					target: `http://localhost:29999/${s_PACKAGE_ID}/dist`,
					rewrite: () => "/module.js"
				},

				// Enable socket.io from main Foundry server.
				"/socket.io": { target: "ws://localhost:30000", ws: true }
			}
		},

		build: {
			outDir: "../dist",
			emptyOutDir: false,
			sourcemap: s_SOURCEMAPS,
			brotliSize: true,
			minify: false,
			target: ["es2022"],
			lib: {
				entry: "./module.js",
				formats: ["es"],
				fileName: moduleJSON.id
			},
			rollupOptions: {
				output: {
					// Rewrite the default style.css to a more recognizable file name.
					assetFileNames: (assetInfo) => (assetInfo.name === "style.css" ? `${moduleJSON.id}.css` : assetInfo.name)
				}
			}
		},

		optimizeDeps: {
			esbuildOptions: {
				target: "es2022"
			}
		},

		plugins: [
			svelte({
				compilerOptions,
				preprocess: sveltePreprocess()
			})
		]
	};
};
