import { TJSGameSettings } from "#runtime/svelte/store/fvtt/settings";
import CONSTANTS from "./constants.js";
import * as lib from "./lib/lib.js";
import DownloaderApp from "./applications/downloader/downloader-app.js";

class Settings extends TJSGameSettings {

	SETTINGS = {
		ASSET_TYPES: CONSTANTS.FLAG_KEYS.ASSET_TYPES,
		TIME_PERIODS: CONSTANTS.FLAG_KEYS.TIME_PERIODS,
		CATEGORIES: CONSTANTS.FLAG_KEYS.CATEGORIES,
		TAGS: CONSTANTS.FLAG_KEYS.TAGS,
	}

	constructor() {
		super(CONSTANTS.MODULE_NAME);
	}

	getUniqueTags(settingsKey) {
		const setting = game.settings.get(CONSTANTS.MODULE_NAME, settingsKey);

		const values = lib.uniqueArrayElements(
			Object.values(setting).deepFlatten().filter(Boolean)
		);

		const order = CONSTANTS.TAG_ORDER?.[settingsKey] ?? false;

		return values.sort((a, b) => {
			if (order) {
				const aOffset = order.indexOf(a);
				const bOffset = order.indexOf(b);
				if (aOffset > -1 && bOffset > -1) {
					return aOffset - bOffset;
				} else if (aOffset > -1 || bOffset > -1) {
					return aOffset > -1 ? -1 : 1;
				}
			}
			return b > a ? -1 : 1;
		});
	}

	initialize() {

		game.settings.registerMenu(CONSTANTS.MODULE_NAME, "downloader", {
			name: "Asset Pack Manager",
			label: "Install Asset Pack",
			hint: "To add a new asset pack, copy the Pack link, click on the button above and paste it.",
			icon: "",
			type: DownloaderApp.shim,
			restricted: true
		});

		game.settings.registerMenu(CONSTANTS.MODULE_NAME, "website", {
			name: "My website",
			label: "Get New Assets",
			hint: "Find front-view and top-view assets.",
			icon: "",
			type: KinemancerWebsite,
			restricted: true
		});

		game.settings.registerMenu(CONSTANTS.MODULE_NAME, "faq", {
			name: "Need help?",
			label: "FAQ",
			hint: "Find help with installations, updates, technical specs…",
			icon: "",
			type: FAQ,
			restricted: true
		});

		game.settings.registerMenu(CONSTANTS.MODULE_NAME, "discord", {
			name: "Stay tuned!",
			label: "Join the Discord",
			hint: "Vote for the next creations, submit your ideas, get some freebies!",
			icon: "",
			type: Discord,
			restricted: true
		});

		this.register({
			namespace: CONSTANTS.MODULE_NAME,
			key: "",
			options: {
				scope: "world",
				config: false,
				default: {},
				type: Object
			}
		});

		this.register({
			namespace: CONSTANTS.MODULE_NAME,
			key: this.SETTINGS.ASSET_TYPES,
			options: {
				scope: "world",
				config: false,
				default: {},
				type: Object
			}
		});

		this.register({
			namespace: CONSTANTS.MODULE_NAME,
			key: this.SETTINGS.TIME_PERIODS,
			options: {
				scope: "world",
				config: false,
				default: {},
				type: Object
			}
		});

		this.register({
			namespace: CONSTANTS.MODULE_NAME,
			key: this.SETTINGS.CATEGORIES,
			options: {
				scope: "world",
				config: false,
				default: {},
				type: Object
			}
		});

		this.register({
			namespace: CONSTANTS.MODULE_NAME,
			key: this.SETTINGS.TAGS,
			options: {
				scope: "world",
				config: false,
				default: {},
				type: Object
			}
		});

		Object.entries(this.SETTINGS).forEach(entry => {
			this[entry[0]] = {
				get: () => {
					return game.settings.get(CONSTANTS.MODULE_NAME, entry[1]);
				},
				set: (value) => {
					return game.settings.set(CONSTANTS.MODULE_NAME, entry[1], value);
				},
				store: this.getStore(entry[1])
			};
		});
	}
}


class URLShim extends FormApplication {
	/**
	 * @inheritDoc
	 */
	constructor() {
		super({});
		window.open(this.urlToOpen, "_blank");
	}

	get urlToOpen() {
		return "";
	}

	async _updateObject(event, formData) {
	}

	render() {
		this.close();
	}
}

class KinemancerWebsite extends URLShim {
	get urlToOpen() {
		return "https://www.thekinemancer.com";
	}
}

class FAQ extends URLShim {
	get urlToOpen() {
		return "https://www.thekinemancer.com/faq/";
	}
}

class Discord extends URLShim {
	get urlToOpen() {
		return "https://discord.gg/zhaYaj5ejg";
	}
}


const GameSettings = new Settings();

export default GameSettings;
