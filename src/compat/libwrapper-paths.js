import { IS_V12 } from "./is-v12.js";

/** libWrapper registration paths for the prototype methods the module patches. */
export const LIBWRAPPER_PATHS = IS_V12
	? {
		tileDestroy: "Tile.prototype._destroy",
		tileRefreshVideo: "Tile.prototype._refreshVideo",
		tokenDestroy: "Token.prototype._destroy",
		videoHelperPlay: "VideoHelper.prototype.play"
	}
	: {
		tileDestroy: "foundry.canvas.placeables.Tile.prototype._destroy",
		tileRefreshVideo: "foundry.canvas.placeables.Tile.prototype._refreshVideo",
		tokenDestroy: "foundry.canvas.placeables.Token.prototype._destroy",
		videoHelperPlay: "foundry.helpers.media.VideoHelper.prototype.play"
	};
