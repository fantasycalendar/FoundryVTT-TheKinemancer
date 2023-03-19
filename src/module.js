import "./styles/module.scss";

import CONSTANTS from "./constants.js";

import { copiedData, StatefulVideo } from "./StatefulVideo.js";
import SocketHandler from "./socket.js";
import * as lib from "./lib/lib.js";

Hooks.once('init', async function () {
  registerLibwrappers();
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
        statefulVideo.offset = Number(Date.now()) - statefulVideo.updated;
        game.video.play(statefulVideo.video);
      });
    }
  });

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
        const newOptions = await statefulVideo.getVideoPlaybackState();
        if (!newOptions) return;
        return wrapped(video, newOptions);
      }
    }
    return wrapped(video, options);
  }, "MIXED");

}

