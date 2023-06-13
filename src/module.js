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
        statefulVideo.offset = Number(Date.now()) - statefulVideo.flags.updated;
        game.video.play(statefulVideo.video);
      });
    }
  });

});


Hooks.on('renderFilePicker', (filePicker, html) => {

  const regex = new RegExp(/^.*?the-kinemancer\/.+__(.+).webm$/, "g")

  html.find('[data-src="icons/svg/video.svg"]:visible').each((idx, imgElem) => {

    const img = $(imgElem);
    const parent = img.closest('[data-path]');
    const path = parent.data('path');
    const width = img.attr('width');
    const height = img.attr('height');

    if (path.match(regex)) {
      parent.remove();
      return;
    }

    new Promise(async (resolve) => {
      let found = false;
      const splitPath = path.split("/");
      const file_name = splitPath.pop();
      const variationPath = splitPath.join("/") + "/stills/" + file_name.replace(".webm", ".webp");
      try {
        await FilePicker.browse("data", variationPath).then(() => {
          found = true;
          setTimeout(() => {
            img.attr("src", variationPath);
          }, 150);
        })
      } catch (err) {
      }
      resolve();
    });

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

