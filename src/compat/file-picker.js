import { isV12 } from "./is-v12.js";

/** The FilePicker class core Foundry uses, for static calls and instantiation. */
export function getFilePicker() {
	return isV12() ? FilePicker : foundry.applications.apps.FilePicker.implementation;
}

/**
 * Install a KinemancerFilePicker subclass as the picker. v13/v14 only.
 *
 * v12's FilePicker is a lexical binding from a top-level class declaration in a
 * <script> tag, not a globalThis property. Reassigning globalThis.FilePicker
 * doesn't replace what core Foundry reads, so on v12 we monkey-patch
 * FilePicker.prototype directly instead of going through this function.
 */
export function registerFilePickerOverride(cls) {
	CONFIG.ux.FilePicker = cls;
}
