import "./styles/module.scss";

import CONSTANTS from "./constants.js";

import StatefulTile from "./StatefulTile.js";
import SocketHandler from "./socket.js";
import TileInterface from "./tile-interface/tile-interface.js";

Hooks.once('init', async function () {
  registerLibwrappers();
  SocketHandler.initialize();
  StatefulTile.registerHooks();
});

Hooks.once('ready', async function () {

  TileInterface.registerHooks();

  setTimeout(() => {
    StatefulTile.determineCurrentDelegator();
  }, 250);

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      StatefulTile.getAll().forEach(tile => {
        tile.video.pause();
      });
    } else {
      StatefulTile.getAll().forEach(tile => {
        tile.offset = Number(Date.now()) - tile.updated;
        game.video.play(tile.video);
      });
    }
  });
});

function registerLibwrappers() {

  const refreshDebounce = foundry.utils.debounce((placeableTile) => {

    if (!placeableTile.isVideo) return;

    const tile = StatefulTile.make(placeableTile.document, placeableTile.texture);

    if (!tile) return;

    if (game?.video && tile.video && !tile.playing) {
      game.video.play(tile.video);
    }

  }, 100);

  Hooks.on("refreshTile", refreshDebounce);

  libWrapper.register(CONSTANTS.MODULE_NAME, 'Tile.prototype._destroy', function (wrapped) {
    if (this.isVideo) {
      StatefulTile.tearDown(this.document.uuid);
    }
    return wrapped();
  }, "MIXED");

  libWrapper.register(
    CONSTANTS.MODULE_NAME,
    'VideoHelper.prototype.play',
    async function (wrapped, video, options) {
      for (const tile of StatefulTile.getAll().values()) {
        if (video === tile.video) {
          if (this.locked || tile.destroyed || tile.playing || tile.still) return;
          const newOptions = await tile.getVideoPlaybackState();
          if (!newOptions) return;
          if (window.document.hidden) {
            return video.pause();
          }
          return wrapped(video, newOptions);
        }
      }
      return wrapped(video, options);
    },
    "MIXED"
  );

}
