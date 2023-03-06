import "./styles/module.scss";

import CONSTANTS from "./constants.js";

import { StatefulTile } from "./StatefulTile.js";
import SocketHandler from "./socket.js";
import { TileInterface } from "./tile-interface/tile-interface.js";
import * as lib from "./lib/lib.js";

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

  game.ats = {
    updateState: (uuid, options) => StatefulTile.changeTileState(uuid, options)
  };

});


Hooks.on('renderFilePicker', (filePicker, html, options) => {
  options.files.forEach(file => {
    if (!file.url.endsWith(".webm")) return;
    for (const variation of lib.getThumbnailVariations(file.url)) {
      const elem = html.find(`[data-path="${variation}"]`);
      if (elem.length) {
        elem.remove();
        return;
      }
    }
  });

  html.find('[data-src="icons/svg/video.svg"]:visible').each((idx, imgElem) => {
    const img = $(imgElem);
    const parent = img.closest('[data-path]');
    const path = parent.data('path');
    const width = img.attr('width');
    const height = img.attr('height');

    const thumbnailUrl = options.files.find(file => lib.getThumbnailVariations(path).includes(file.url))?.url;
    if (thumbnailUrl) {
      setTimeout(() => {
        img.attr("src", thumbnailUrl);
      }, 150)
    }

    const video = $(`<video class="fas video-preview" loop width="${width}" height="${height}"></video>`);
    video.hide();
    parent.append(video);
    const videoElem = video.get(0);
    let playTimeout = null;

    parent.addClass('video-parent');

    parent.on("mouseenter", () => {
      if (!videoElem.src) {
        parent.addClass(' -loading');
        videoElem.addEventListener('loadeddata', () => {
          parent.removeClass('-loading');
        }, false);
        videoElem.src = path;
      }
      img.hide();
      video.show();
      playTimeout = setTimeout(() => {
        videoElem.currentTime = 0;
        videoElem.play().catch(e => console.error(e));
      }, !!videoElem.src ? 0 : 750);
    }).on("mouseleave", () => {
      clearTimeout(playTimeout);
      videoElem.pause();
      videoElem.currentTime = 0;
      video.hide();
      img.show();
    });
  });
});


function registerLibwrappers() {

  libWrapper.register(CONSTANTS.MODULE_NAME, 'Tile.prototype._destroy', function (wrapped) {
    if (this.isVideo) {
      StatefulTile.tearDown(this.document.uuid);
    }
    return wrapped();
  }, "MIXED");

  libWrapper.register(CONSTANTS.MODULE_NAME, 'VideoHelper.prototype.play', async function (wrapped, video, options) {
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
  }, "MIXED");

}

