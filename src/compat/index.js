/**
 * Foundry v12/v13/v14 compat layer. Every export is lazy: evaluated on first
 * call, not at module load. The ESM bundle can run before Foundry has populated
 * foundry.applications, so anything that touches that namespace must defer until
 * at least the init hook fires.
 */

export { isV12 } from "./is-v12.js";

export { getFilePicker, registerFilePickerOverride } from "./file-picker.js";
export { parseS3URLCompat } from "./s3.js";
export { getLibwrapperPaths } from "./libwrapper-paths.js";
export { getTileClass, getTokenClass, getVideoHelperClass, getTextureLoader } from "./foundry-classes.js";
