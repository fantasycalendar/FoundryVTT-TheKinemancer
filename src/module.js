import "./styles/module.scss";

import CONSTANTS from "./constants.js";

import StatefulTile from "./StatefulTile.js";
import SocketHandler from "./socket.js";
import { TileInterface } from "./tile-interface/tile-interface.js";

Hooks.once('init', async function () {
  registerLibwrappers();
  SocketHandler.initialize();
  StatefulTile.registerHooks();
});

Hooks.once('ready', async function () {

  TextureLoader.loader.loadImageTexture(CONSTANTS.MODULE_ICON);

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

  game.ats = {
    updateState: (uuid, options) => StatefulTile.changeTileState(uuid, options)
  };


});


Hooks.on('renderFilePicker', (filePicker, html) => {
  if (game.modules.get("animation-preview")?.active) return;
  html.find('[data-src="icons/svg/video.svg"]:visible').each((idx, img) => {
    const $img = $(img);
    const $parent = $img.closest('[data-path]');
    const path = $parent.data('path');
    const width = $img.attr('width');
    const height = $img.attr('height');
    const $video = $(`<video class="fas video-preview" loop width="${width}" height="${height}"></video>`);
    $img.replaceWith($video);

    const video = $video.get(0);
    let playTimeout = null;
    $parent.addClass('video-parent -loading');

    video.addEventListener('loadeddata', () => {
      $parent.removeClass('-loading');
    }, false);

    $parent.hover(
      () => {
        playTimeout = setTimeout(() => {
          if (!video.src) video.src = path;
          video.currentTime = 0;
          video.play().catch(e => console.error(e));
        }, !!video.src ? 0 : 750);
      },
      () => {
        clearTimeout(playTimeout);
        video.pause();
        video.currentTime = 0;
      },
    );
  });
});


function registerLibwrappers() {

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
          if (window.document.hidden) return video.pause();
          const newOptions = await tile.getVideoPlaybackState();
          if (!newOptions) return;
          return wrapped(video, newOptions);
        }
      }
      return wrapped(video, options);
    },
    "MIXED"
  );

}

