import { get, writable } from "svelte/store";
import { propertyStore } from '#runtime/svelte/store/writable-derived';

class ProgressBarStore {

	#derived = {
		percent: 1,
		text: ""
	}

	#stores;

	constructor() {
		const derivedWritable = writable(this.#derived);
		this.#stores = {
			bonus: propertyStore(derivedWritable, "bonus"),
			subSkills: propertyStore(derivedWritable, "subSkills"),
		};
		this.percentStore = writable(1);
		this.textStore = writable("");
		this._current = 0;
		this._total = 0;
	}

	setTotal(total) {
		this.percent = 0;
		this._current = 0;
		this._total = total;
	}

	incrementProgress() {
		this._current++;
		this.percent = this._current / this._total;
		return this._current;
	}

	set percent(pct) {
		this.percentStore.set(pct);
	}

	get percent() {
		return get(this.percentStore);
	}

	set text(text) {
		this.textStore.set(text);
	}

	get text() {
		return get(this.textStore);
	}

}

const ProgressBar = new ProgressBarStore();

export default ProgressBar;
