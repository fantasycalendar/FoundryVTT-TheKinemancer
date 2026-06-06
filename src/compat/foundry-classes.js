import { IS_V12 } from "./is-v12.js";

/** Foundry's Tile placeable class. */
export function getTileClass() {
	return IS_V12 ? Tile : foundry.canvas.placeables.Tile;
}

/** Foundry's Token placeable class. */
export function getTokenClass() {
	return IS_V12 ? Token : foundry.canvas.placeables.Token;
}

/** Foundry's VideoHelper class. */
export function getVideoHelperClass() {
	return IS_V12 ? VideoHelper : foundry.helpers.media.VideoHelper;
}

/** Foundry's TextureLoader class. */
export function getTextureLoader() {
	return IS_V12 ? TextureLoader : foundry.canvas.TextureLoader;
}
