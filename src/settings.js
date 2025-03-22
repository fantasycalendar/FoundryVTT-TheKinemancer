import { TJSGameSettings } from "#runtime/svelte/store/fvtt/settings";
import CONSTANTS from "./constants.js";
import * as lib from "./lib/lib.js";

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

		return values.sort((a, b) => {
			const offset = CONSTANTS.TIME_PERIODS_ORDER.includes(a) - CONSTANTS.TIME_PERIODS_ORDER.includes(b)
			if (!offset) {
				return CONSTANTS.TIME_PERIODS_ORDER.indexOf(a) - CONSTANTS.TIME_PERIODS_ORDER.indexOf(b)
			}
			return b > a ? -1 : 1;
		});
	}

	initialize() {

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

const GameSettings = new Settings();

export default GameSettings;
