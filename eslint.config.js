import js from "@eslint/js";
import globals from "globals";
import sveltePlugin from "eslint-plugin-svelte";
import svelteParser from "svelte-eslint-parser";

// Foundry VTT globals that the runtime exposes on `window`. Kept explicit so the
// linter understands what's provided by Foundry vs. what's actually undefined.
const foundryGlobals = {
	// Core entry points
	game: "readonly",
	foundry: "readonly",
	canvas: "readonly",
	ui: "readonly",
	Hooks: "readonly",
	CONFIG: "readonly",
	CONST: "readonly",

	// jQuery, bundled by Foundry on window
	$: "readonly",
	jQuery: "readonly",

	// Legacy / shim globals still re-exposed in v13+. Tile/Token/VideoHelper are
	// also globals on v12; the compat layer reads them via getTileClass etc.
	Application: "readonly",
	ApplicationV2: "readonly",
	FilePicker: "readonly",
	Tile: "readonly",
	Token: "readonly",
	VideoHelper: "readonly",
	TextureLoader: "readonly",
	fromUuid: "readonly",
	fromUuidSync: "readonly",
	getProperty: "readonly",
	hasProperty: "readonly",
	setProperty: "readonly",
	mergeObject: "readonly",
	duplicate: "readonly",
	deepClone: "readonly",
	renderTemplate: "readonly",
	loadTemplates: "readonly",

	// PIXI is bundled by Foundry on window
	PIXI: "readonly",

	// Provided by required module dependencies (see module.json relationships.requires)
	libWrapper: "readonly",

	// Bundled vendor libs the asset-pack downloader pulls onto window
	JSZip: "readonly",
	JSZipUtils: "readonly"
};

export default [
	{
		ignores: ["dist/**", "node_modules/**", "assets/**", "lang/**", "packs/**", "*.min.js"]
	},

	js.configs.recommended,

	{
		languageOptions: {
			ecmaVersion: "latest",
			sourceType: "module",
			globals: {
				...globals.browser,
				...foundryGlobals
			}
		},
		rules: {
			"no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
			"no-empty": ["error", { allowEmptyCatch: true }]
		}
	},

	{
		// Build-time files run on Node, not in the browser.
		files: ["vite.config.{js,mjs,cjs}", "eslint.config.{js,mjs,cjs}"],
		languageOptions: {
			globals: {
				...globals.node
			}
		}
	},

	...sveltePlugin.configs["flat/recommended"],

	{
		files: ["**/*.svelte"],
		languageOptions: {
			parser: svelteParser,
			ecmaVersion: "latest",
			sourceType: "module",
			globals: {
				...globals.browser,
				...foundryGlobals
			}
		}
	}
];
