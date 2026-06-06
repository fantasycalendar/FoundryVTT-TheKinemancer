import { IS_V12 } from "./is-v12.js";

/** The FilePicker class core Foundry uses, for static calls and instantiation. */
export function getFilePicker() {
	return IS_V12 ? FilePicker : foundry.applications.apps.FilePicker.implementation;
}

/** Swap in a KinemancerFilePicker subclass as the picker. */
export function registerFilePickerOverride(cls) {
	if (IS_V12) globalThis.FilePicker = cls;
	else CONFIG.ux.FilePicker = cls;
}
