import { isV12 } from "./is-v12.js";

/** Foundry's Tile placeable class. */
export function getTileClass() {
	return isV12() ? Tile : foundry.canvas.placeables.Tile;
}

/** Foundry's Token placeable class. */
export function getTokenClass() {
	return isV12() ? Token : foundry.canvas.placeables.Token;
}

/** Foundry's VideoHelper class. */
export function getVideoHelperClass() {
	return isV12() ? VideoHelper : foundry.helpers.media.VideoHelper;
}

/** Foundry's TextureLoader class. */
export function getTextureLoader() {
	return isV12() ? TextureLoader : foundry.canvas.TextureLoader;
}
