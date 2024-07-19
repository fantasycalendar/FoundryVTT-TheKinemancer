import { TJSGameSettings } from "#runtime/svelte/store/fvtt/settings";
import CONSTANTS from "./constants.js";

class Settings extends TJSGameSettings {

	SETTINGS = {
		PACK_TAGS: 'pack-tags',
	}

	constructor() {
		super(CONSTANTS.MODULE_NAME);
	}

	getUniquePackTags() {
		return Array.from(new Set(Object.values(this.PACK_TAGS.get()).deepFlatten())).sort((a, b) => {
			return b > a ? -1 : 1;
		});
	}

	initialize() {
		this.register({
			namespace: CONSTANTS.MODULE_NAME,
			key: this.SETTINGS.PACK_TAGS,
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
