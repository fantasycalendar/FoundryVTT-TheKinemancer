/**
 * Foundry version detection. Lazy: evaluated on first call, then cached.
 *
 * Module-load evaluation is unsafe because our ESM bundle can run before
 * Foundry's client.mjs has populated foundry.applications. At first call from
 * the init hook (or later), the namespace is ready.
 */

let _cached = null;

export function isV12() {
	if (_cached === null) _cached = !foundry.applications?.apps?.FilePicker;
	return _cached;
}
