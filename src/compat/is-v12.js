/**
 * Foundry version detection. Lives in its own file so other compat modules can
 * import IS_V12 without going through index.js, which would create a circular
 * import that TDZ-errors when LIBWRAPPER_PATHS evaluates its ternary at load
 * time.
 */
export const IS_V12 = !foundry.applications?.apps?.FilePicker;
