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

	game.thekinemancer = {
		updateState: (uuid, options) => StatefulVideo.changeVideoState(uuid, options),
		StatefulVideo,
		CONSTANTS,
		copiedData,
		lib
	};

});

Hooks.on("changeSidebarTab", (app) => {
	const button = $("<button><i class='fas icon-thekinemancer_icon_logo'></i> The Kinemancer Downloader</button>");
	button.on("click", () => {
		DownloaderApp.show();
	});
	app.element.find("#settings-game").append(button)
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
				game.video.play(statefulVideo.video);
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
		for (const statefulVideo of StatefulVideo.getAll().values()) {
			if (video === statefulVideo.video) {
				if (this.locked || statefulVideo.destroyed || statefulVideo.playing || statefulVideo.still) return;
				if (window.document.hidden) return video.pause();
				const newOptions = statefulVideo.getVideoPlaybackState();
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

}

