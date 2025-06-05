import "./styles/module.scss";

import CONSTANTS from "./constants.js";

import { copiedData, StatefulVideo } from "./StatefulVideo.js";
import SocketHandler from "./socket.js";
import * as lib from "./lib/lib.js";
import Settings from "./settings.js";
import DownloaderApp from "./applications/downloader/downloader-app.js";
import registerFilePicker from "./filepicker.js";

Hooks.once('init', async function () {

	registerLibwrappers();
	registerFilePicker();
	Settings.initialize();
	SocketHandler.initialize();
	StatefulVideo.registerHooks();

	// CONFIG.debug.kinemancer = true;

	game.thekinemancer = {
		StatefulVideo,
		CONSTANTS,
		copiedData,
		lib
	};

});

Hooks.once('ready', async function () {

	setTimeout(() => {
		StatefulVideo.determineCurrentDelegator();
	}, 250);

	document.addEventListener("visibilitychange", function () {
		if (document.hidden) {
			StatefulVideo.getAll().forEach(statefulVideo => {
				statefulVideo.video.pause();
			});
		} else {
			StatefulVideo.getAll().forEach(statefulVideo => {
				statefulVideo.offset = Number(Date.now()) - statefulVideo.flags.updated;
				statefulVideo.play();
			});
		}
	});

	if (game.user.isGM) {
		for (const scene of Array.from(game.scenes)) {
			const updates = Array.from(scene.tiles).map(tile => {
				if (!foundry.utils.getProperty(tile, CONSTANTS.STATES_FLAG)?.length || foundry.utils.getProperty(tile, CONSTANTS.BASE_FILE_FLAG)) return false;
				return {
					_id: tile.id,
					[CONSTANTS.BASE_FILE_FLAG]: tile?.texture?.src,
					[CONSTANTS.FOLDER_PATH_FLAG]: lib.getFolder(tile?.texture?.src),
				}
			}).filter(Boolean);
			if (updates.length) {
				await scene.updateEmbeddedDocuments("Tile", updates);
			}
		}
	}

});

function registerLibwrappers() {

	libWrapper.register(CONSTANTS.MODULE_NAME, 'Tile.prototype._destroy', function (wrapped) {
		if (this.isVideo) {
			StatefulVideo.tearDown(this.document.uuid);
		}
		return wrapped();
	}, "MIXED");

	libWrapper.register(CONSTANTS.MODULE_NAME, 'Token.prototype._destroy', function (wrapped) {
		if (this.isVideo) {
			StatefulVideo.tearDown(this.document.uuid);
		}
		return wrapped();
	}, "MIXED");

	libWrapper.register(CONSTANTS.MODULE_NAME, 'VideoHelper.prototype.play', async function (wrapped, video, options) {
		const videoOptions = { playing: options?.playing ?? true };
		const statefulVideos = StatefulVideo.getAll().values();
		for (const statefulVideo of statefulVideos) {
			if (video === statefulVideo.video) {
				if (this.locked || statefulVideo.destroyed || (statefulVideo.playing && videoOptions.playing) || statefulVideo.still) {
					return;
				}
				if (window.document.hidden) return video.pause();
				const newOptions = statefulVideo.getVideoPlaybackState(videoOptions);
				if (!newOptions) return;
				return wrapped(video, newOptions);
			}
		}
		return wrapped(video, options);
	}, "MIXED");

	libWrapper.register(CONSTANTS.MODULE_NAME, 'VideoHelper.prototype._onFirstGesture', async function (wrapped, event) {
		Hooks.callAll("canvasFirstUserGesture");
		return wrapped(event);
	}, "MIXED");

	if (Tile.prototype._refreshVideo) {
		libWrapper.register(CONSTANTS.MODULE_NAME, 'Tile.prototype._refreshVideo', function (wrapped) {
			const statefulVideo = StatefulVideo.get(this.document.uuid);
			if (!statefulVideo) {
				return wrapped();
			}
		}, "MIXED");
	}

}

