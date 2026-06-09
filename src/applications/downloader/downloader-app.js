import { SvelteApplicationMixin } from "../SvelteMixin.js";
import DownloaderShell from "./downloader-shell.svelte";

export default class DownloaderApp extends SvelteApplicationMixin(foundry.applications.api.ApplicationV2) {
	static DEFAULT_OPTIONS = {
		position: {
			width: 400,
			height: "auto"
		},
		window: {
			title: "The Kinemancer Downloader",
			resizable: false
		}
	};

	root = DownloaderShell;

	static get shim() {
		return DownloaderAppShim;
	}
}

class DownloaderAppShim extends foundry.applications.api.ApplicationV2 {
	constructor() {
		super({});
		DownloaderApp.show();
	}

	async render() {
		return this;
	}
}
