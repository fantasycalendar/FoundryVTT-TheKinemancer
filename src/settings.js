import { TJSGameSettings } from "#runtime/svelte/store/fvtt/settings";
import CONSTANTS from "./constants.js";

class Settings extends TJSGameSettings {

	SETTINGS = {
		INSTALLED_PACKS: 'installed-packs',
	}

	constructor() {
		super(CONSTANTS.MODULE_NAME);
	}

	initialize() {
		this.register({
			namespace: CONSTANTS.MODULE_NAME,
			key: this.SETTINGS.INSTALLED_PACKS,
			options: {
				scope: "world",
				config: false,
				default: [],
				type: Array
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
