import { SvelteApplication } from '#runtime/svelte/application';
import DownloaderShell from './downloader-shell.svelte';

export default class DownloaderApp extends SvelteApplication {

	constructor(options) {
		super(options);
	}

	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			title: "The Kinemancer Downloader",
			width: 400,
			height: "auto",
			svelte: {
				class: DownloaderShell,
				target: document.body
			},
			close: () => this.options.resolve(null),
		})
	}

	static getActiveApp() {
		return Object.values(ui.windows).find(app => app instanceof this);
	}

	static async show(styles, options = {}) {
		const app = this.getActiveApp()
		if (app) return app.render(false, { focus: true });
		return new Promise(resolve => {
			options.resolve = resolve;
			return new this(styles, options).render(true, { focus: true });
		});
	}

	static get shim() {
		return DownloaderAppShim;
	}
}

class DownloaderAppShim extends FormApplication {
	/**
	 * @inheritDoc
	 */
	constructor() {
		super({});
		DownloaderApp.show();
	}

	async _updateObject(event, formData) {
	}

	render() {
		this.close();
	}
}
