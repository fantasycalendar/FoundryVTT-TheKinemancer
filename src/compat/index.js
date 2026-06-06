/**
 * Foundry v12/v13/v14 compat layer. Detects the Foundry version once at module
 * load; everything else imports IS_V12 or a helper from here instead of poking
 * Foundry namespaces directly.
 */

export { IS_V12 } from "./is-v12.js";

export { getFilePicker, registerFilePickerOverride } from "./file-picker.js";
export { parseS3URLCompat } from "./s3.js";
export { LIBWRAPPER_PATHS } from "./libwrapper-paths.js";
export { getTileClass, getTokenClass, getVideoHelperClass, getTextureLoader } from "./foundry-classes.js";
