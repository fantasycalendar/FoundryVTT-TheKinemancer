import CONSTANTS from "./constants.js";
import * as lib from "./lib/lib.js";
import { getSceneDelegator, isRealNumber } from "./lib/lib.js";
import SocketHandler from "./socket.js";
import { get, writable } from "svelte/store";

const statefulVideoHudMap = new Map();
const managedStatefulVideos = new Map();
let currentDelegator = false;
let delegateDebounce = false;

export const copiedData = writable(false);
const hudScale = writable(0);

export class StatefulVideo {

  constructor(document, texture) {
    this.document = document;
    this.uuid = this.document.uuid;
    this.flags = new Flags(this.document);
    this.offset = this.flags.offset;
    this.texture = texture;
    this.video = this.texture.baseTexture.resource.source;
    this.timeout = false;
    this.still = false;
    this.nextButton = false;
    this.prevButton = false;
    this.select = false;
    this.newCurrentTime = null;
    this.ready = !!currentDelegator;
  }

  static setAllReady() {
    this.getAll().forEach(statefulVideo => {
      if (!statefulVideo.ready) {
        statefulVideo.ready = true;
        statefulVideo.flags.updateData();
        game.video.play(statefulVideo.video);
      }
    });
  }

  static determineCurrentDelegator() {

    if (delegateDebounce) delegateDebounce();

    delegateDebounce = foundry.utils.debounce(async () => {

      // When you first render a scene, determine which user should be the delegator
      const newDelegator = getSceneDelegator();

      // If the user isn't the delegator, they should clear their own info to avoid confusion
      if (!game.user.isGM && newDelegator !== game.user && lib.isGMConnected()) {
        await game.user.unsetFlag(CONSTANTS.MODULE_NAME, CONSTANTS.FLAG_KEYS.DELEGATED_STATEFUL_VIDEOS);
      }

      // If the delegator has changed to a non-GM, and the new delegator is you, whilst there are no GMs connected
      if (newDelegator !== currentDelegator && !newDelegator.isGM && newDelegator === game.user && !lib.isGMConnected()) {

        // Grab all stateful video's current state
        let updates = {};
        StatefulVideo.getAll().forEach(statefulVideo => {
          updates[CONSTANTS.DELEGATED_STATEFUL_VIDEOS_FLAG + "." + statefulVideo.delegationUuid] = statefulVideo.flags.getData();
        });

        currentDelegator = newDelegator;

        // Store the stateful video's current state on yourself
        await game.user.update(updates);

      }

      currentDelegator = newDelegator;

      StatefulVideo.setAllReady();

    }, 100);

  }

  static registerHooks() {

    Hooks.on('userConnected', () => {
      this.determineCurrentDelegator();
    });

    Hooks.on('getSceneNavigationContext', () => {
      this.determineCurrentDelegator();
    });

    let firstUpdate = true;
    Hooks.on('updateUser', (user, data) => {

      // If the user wasn't updated with delegated stateful videos, exit
      if (!hasProperty(data, CONSTANTS.DELEGATED_STATEFUL_VIDEOS_FLAG)) return;

      // If they were, but it was removed, exit
      const statefulVideos = getProperty(data, CONSTANTS.DELEGATED_STATEFUL_VIDEOS_FLAG);
      if (!statefulVideos) return;

      // If the current delegator is a GM, don't do anything, they will handle updates
      if (currentDelegator.isGM) return;

      // Otherwise, loop through each of the updated stateful videos
      Object.keys(statefulVideos).forEach(key => {
        // Get the stateful video based on the UUID that was updated on the user
        const statefulVideo = StatefulVideo.get(`Scene.${key.split("_").join(".")}`);
        if (!statefulVideo) return;
        // Call the update method, and pass the user that is the current delegator
        StatefulVideo.onUpdate(statefulVideo.document, // Construct a similar diff as normal video updates would create
          foundry.utils.mergeObject({
            [CONSTANTS.FLAGS]: statefulVideos[key]
          }, {}), firstUpdate);
      });
      firstUpdate = false;
    });

    Hooks.on("renderBasePlaceableHUD", (app, html) => {
      statefulVideoHudMap.set(app.object.document.uuid, app);
      StatefulVideo.renderStatefulVideoHud(app, html);
    });

    Hooks.on("preUpdateTile", (placeableDoc, data) => {
      StatefulVideo.onPreUpdate(placeableDoc, data);
    });

    Hooks.on("updateTile", (placeableDoc, data) => {
      StatefulVideo.onUpdate(placeableDoc, data);
    });

    Hooks.on("createTile", (placeableDoc) => {
      const path = lib.getVideoJsonPath(placeableDoc);
      fetch(path)
        .then(response => response.json())
        .then((result) => {
          setTimeout(() => {
            placeableDoc.update(result);
          }, 500);
        })
        .catch(err => {
        });
    });

    Hooks.on("preUpdateToken", (placeableDoc, data) => {
      StatefulVideo.onPreUpdate(placeableDoc, data);
    });

    Hooks.on("updateToken", (placeableDoc, data) => {
      StatefulVideo.onUpdate(placeableDoc, data);
    });

    Hooks.on("createToken", (placeableDoc) => {
      const path = lib.getVideoJsonPath(placeableDoc);
      fetch(path)
        .then(response => response.json())
        .then((result) => {
          placeableDoc.update(result);
        })
        .catch(err => {
        });
    });

    Hooks.on("canvasReady", () => {
      hudScale.set(canvas.stage.scale.x);
      setTimeout(() => {
        const placeableObjects = [...canvas.tiles.placeables, canvas.tokens.placeables];
        for (const placeable of placeableObjects) {
          if (!placeable.isVideo || !getProperty(placeable.document, CONSTANTS.STATES_FLAG)?.length) continue;
          const statefulVideo = StatefulVideo.make(placeable.document, placeable.texture);
          if (!statefulVideo) return;
          if (game?.video && statefulVideo.video) {
            game.video.play(statefulVideo.video);
          }
        }
      }, 200);
    })

    Hooks.on("canvasPan", () => {
      hudScale.set(canvas.stage.scale.x);
    });

    hudScale.subscribe(() => {
      StatefulVideo.getAll().forEach(statefulVideo => statefulVideo.updateHudScale());
    });

    const refreshDebounce = foundry.utils.debounce((statefulVideo) => {
      if (game?.video && statefulVideo.video) {
        statefulVideo.updateVideo();
        statefulVideo.playing = false;
        statefulVideo.still = false;
        game.video.play(statefulVideo.video);
      }
    }, 200);

    Hooks.on("refreshTile", (placeableObject) => {
      if (!placeableObject.isVideo || !getProperty(placeableObject.document, CONSTANTS.STATES_FLAG)?.length) return;
      const statefulVideo = StatefulVideo.make(placeableObject.document, placeableObject.texture);
      if (!statefulVideo) return;
      statefulVideo.evaluateVisibility();
      refreshDebounce(statefulVideo);
    });

    Hooks.on("refreshToken", (placeableObject) => {
      if (!placeableObject.isVideo || !getProperty(placeableObject.document, CONSTANTS.STATES_FLAG)?.length) return;
      const statefulVideo = StatefulVideo.make(placeableObject.document, placeableObject.texture);
      if (!statefulVideo) return;
      statefulVideo.evaluateVisibility();
      refreshDebounce(statefulVideo);

    });

  }

  static getAll() {
    return managedStatefulVideos;
  }

  static get(uuid) {
    return managedStatefulVideos.get(uuid) || false;
  }

  static make(document, texture) {
    const existingStatefulVideo = this.get(document.uuid);
    if (!existingStatefulVideo?.app || existingStatefulVideo?.app?._state <= Application.RENDER_STATES.CLOSED) {

    }
    if (existingStatefulVideo) return existingStatefulVideo;
    const newStatefulVideo = new this(document, texture);
    managedStatefulVideos.set(newStatefulVideo.uuid, newStatefulVideo);
    if (currentDelegator) {
      newStatefulVideo.flags.updateData();
    }
    return newStatefulVideo;
  }

  get duration() {
    return this.video.duration * 1000;
  }

  static tearDown(uuid) {
    const statefulVideo = StatefulVideo.get(uuid);
    if (!statefulVideo) return;
    if (statefulVideo.timeout) clearTimeout(statefulVideo.timeout);
    managedStatefulVideos.delete(uuid);
  }

  static makeHudButton(tooltip, icon, style = "") {
    return $(`<div class="ats-hud-control-icon ats-stateful-video-ui-button" style="${style}" data-tooltip-direction="UP" data-tooltip="${tooltip}">
      <i class="fas ${icon}"></i>
    </div>`);
  }

  /**
   * Adds additional control elements to the tile HUD relating to Animated Tile States
   *
   * @param app
   * @param html
   */
  static renderStatefulVideoHud(app, html) {

    const placeableDocument = app.object.document;
    const statefulVideo = StatefulVideo.get(placeableDocument.uuid);

    const root = $("<div class='ats-hud'></div>");

    if (statefulVideo) {

      const selectContainer = $("<div class='ats-hud-select-container'></div>");

      for (const [index, state] of statefulVideo.flags.states.entries()) {
        if (!state.icon) continue;
        const stateBtn = StatefulVideo.makeHudButton(state.name, state.icon);
        stateBtn.on("pointerdown", () => {
          statefulVideo.changeState({ state: index, fast: true });
        });
        selectContainer.append(stateBtn);
      }

      const select = $("<select class='ats-stateful-video-ui-button'></select>");
      select.on('change', function () {
        statefulVideo.changeState({ state: Number($(this).val()), fast: true });
      });

      for (const [index, state] of statefulVideo.flags.states.entries()) {
        select.append(`<option ${index === statefulVideo.flags.currentStateIndex ? "selected" : ""} value="${index}">${state.name}</option>`);
      }

      const statefulVideoColor = lib.determineFileColor(statefulVideo.document.texture.src);

      const selectButtonContainer = $("<div></div>");

      const selectColorButton = $(`<div class="ats-hud-control-icon ats-stateful-video-ui-button" data-tooltip-direction="UP" data-tooltip="Change Color">
      ${statefulVideoColor.icon ? `<i class="fas ${statefulVideoColor.icon}"></i>` : ""}
      ${statefulVideoColor.color ? `<div class="ats-color-button" style="${statefulVideoColor.color}"></div>` : ""}
    </div>`);

      const selectColorContainer = $(`<div class="ats-color-container"></div>`);

      const baseFile = decodeURI(statefulVideo.document.texture.src).split("  ")[0].replace(".webm", "") + "*.webm";
      lib.getWildCardFiles(baseFile).then((results) => {
        const width = results.length * 34;
        selectColorContainer.css({ left: width * -0.33, width });
        for (const filePath of results) {
          const { colorName, color } = lib.determineFileColor(filePath);
          const button = $(`<div class="ats-color-button" style="${color}"></div>`)
          if (!colorName) {
            selectColorContainer.prepend(button);
          } else {
            selectColorContainer.append(button);
          }
          button.on("pointerdown", async () => {
            selectColorButton.html(`<div class="ats-color-button" style="${color}"></div>`);
            selectColorButton.trigger("pointerdown");
            statefulVideo.document.update({
              img: filePath
            });
          });
        }
      });

      selectColorButton.on('pointerdown', () => {
        const newState = selectColorContainer.css('visibility') === "hidden" ? "visible" : "hidden";
        selectColorContainer.css("visibility", newState);
      });

      selectButtonContainer.append(selectColorButton);
      selectButtonContainer.append(selectColorContainer);

      selectContainer.append(select);
      selectContainer.append(selectButtonContainer);

      root.append(selectContainer);

      statefulVideo.select = select;

      statefulVideo.updateHudScale();

    }

    Hooks.call(CONSTANTS.HOOKS.RENDER_UI, app, root, placeableDocument, statefulVideo);

    if (root.children().length) {
      html.find(".col.middle").append(root);
    }

  }

  updateVideo() {
    this.texture = this.document.object.texture;
    this.video = this.document.object.texture.baseTexture.resource.source;
  }

  updateHudScale() {
    if (!this.select) return;
    const scale = get(hudScale) + 0.25;
    const fontSize = scale >= 1.0 ? 1.0 : Math.min(1.0, Math.max(0.25, lib.transformNumber(scale)))
    this.select.children().css("font-size", `${fontSize}rem`)
  }

  updateSelect() {
    if (!this.select?.length) return;
    this.select.empty();
    for (const [index, state] of this.flags.states.entries()) {
      this.select.append(`<option ${index === this.flags.currentStateIndex ? "selected" : ""} value="${index}">${state.name}</option>`)
    }
    this.updateHudScale();
  }

  static onPreUpdate(placeableDoc, changes) {
    let statefulVideo = StatefulVideo.get(placeableDoc.uuid);
    if (hasProperty(changes, "texture.src") && statefulVideo) {
      statefulVideo.newCurrentTime = statefulVideo.video.currentTime * 1000;
    }
  }

  static onUpdate(placeableDoc, changes, firstUpdate = false) {
    let statefulVideo = StatefulVideo.get(placeableDoc.uuid);
    if (hasProperty(changes, "texture.src") && statefulVideo) {
      setTimeout(() => {
        statefulVideo.texture = placeableDoc.object.texture;
        statefulVideo.video = placeableDoc.object.texture.baseTexture.resource.source;
        statefulVideo.still = false;
        statefulVideo.playing = false;
        clearTimeout(statefulVideo.timeout);
        game.video.play(statefulVideo.video);
      }, 100);
    }
    if (!hasProperty(changes, CONSTANTS.FLAGS)) return;
    if (!statefulVideo) {
      if (!placeableDoc.object.isVideo || !getProperty(placeableDoc, CONSTANTS.STATES_FLAG)?.length) return;
      statefulVideo = StatefulVideo.make(placeableDoc, placeableDoc.object.texture);
    }
    statefulVideo.flags.updateData();
    Hooks.call("ats.updateState", placeableDoc, statefulVideo.flags.data, changes);
    if (!statefulVideo.flags.states.length) {
      this.tearDown(placeableDoc.uuid);
      statefulVideoHudMap.get(placeableDoc.uuid)?.render(true);
      return;
    }
    statefulVideo.offset = Number(new Date()) - statefulVideo.flags.updated;
    if (hasProperty(changes, CONSTANTS.STATES_FLAG)) {
      statefulVideoHudMap.get(placeableDoc.uuid)?.render(true);
      statefulVideo.still = false;
      statefulVideo.playing = false;
      clearTimeout(statefulVideo.timeout);
      game.video.play(statefulVideo.video);
      statefulVideo.flags.data.queuedState = statefulVideo.flags.determineNextStateIndex();
      return placeableDoc.update({
        [CONSTANTS.QUEUED_STATE_FLAG]: statefulVideo.flags.data.queuedState
      });
    }
    statefulVideo.updateSelect();
    if (hasProperty(changes, CONSTANTS.CURRENT_STATE_FLAG) || firstUpdate) {
      if (statefulVideo.nextButton) {
        statefulVideo.nextButton.removeClass("active");
      }
      if (statefulVideo.prevButton) {
        statefulVideo.prevButton.removeClass("active");
      }
      statefulVideo.still = false;
      statefulVideo.playing = false;
      game.video.play(statefulVideo.video);
    }
  }

  static async changeVideoState(uuid, { state = null, step = 1, queue = false } = {}) {
    const placeableDoc = fromUuidSync(uuid);
    if (!placeableDoc) return false;
    const flags = new Flags(placeableDoc);
    flags.updateData();
    if (!flags.states.length) {
      return false;
    }
    if (state !== null && !queue) {
      if (!isRealNumber(state)) {
        return false;
      }
      return placeableDoc.update({
        [CONSTANTS.UPDATED_FLAG]: Number(Date.now()),
        [CONSTANTS.PREVIOUS_STATE_FLAG]: flags.currentStateIndex,
        [CONSTANTS.CURRENT_STATE_FLAG]: state,
        [CONSTANTS.QUEUED_STATE_FLAG]: flags.determineNextStateIndex()
      });
    }
    if (!isRealNumber(step)) {
      return false;
    }
    if (queue && !isRealNumber(state)) {
      return false;
    }
    return placeableDoc.update({
      [CONSTANTS.UPDATED_FLAG]: Number(Date.now()),
      [CONSTANTS.QUEUED_STATE_FLAG]: queue ? state : flags.getStateIndexFromSteps(step)
    });
  }

  async update(data) {
    if (game.user !== currentDelegator) return;

    data[CONSTANTS.UPDATED_FLAG] = Number(Date.now());

    if (game.user.isGM) {
      return this.document.update(data);
    } else if (lib.getResponsibleGM()) {
      return SocketHandler.emit(SocketHandler.UPDATE_PLACEABLE_DOCUMENT, {
        uuid: this.uuid, update: data, userId: lib.getResponsibleGM().id
      });
    }

    const deconstructedData = Object.fromEntries(Object.entries(data)
      .map(([key, value]) => {
        const newKey = key.split(".");
        return [newKey[newKey.length - 1], value];
      }));

    const key = `${this.document.parent.id}_${this.document.documentName}_${this.document.id}`;
    return game.user.update({
      [`${CONSTANTS.DELEGATED_STATEFUL_VIDEOS_FLAG}.${key}`]: deconstructedData
    });
  }

  async queueState(newState) {
    const updates = {
      [CONSTANTS.QUEUED_STATE_FLAG]: newState
    };
    if (Hooks.call("ats.preUpdateQueuedState", this.document, this.flags.data, updates) === false) {
      return;
    }
    return this.update(updates);
  }

  async updateState(stateIndex) {
    const updates = {
      [CONSTANTS.PREVIOUS_STATE_FLAG]: this.flags.currentStateIndex,
      [CONSTANTS.CURRENT_STATE_FLAG]: stateIndex,
      [CONSTANTS.QUEUED_STATE_FLAG]: this.flags.determineNextStateIndex(stateIndex)
    };
    if (Hooks.call("ats.preUpdateCurrentState", this.document, this.flags.data, updates) === false) {
      return;
    }
    return this.update(updates);
  }

  async changeState({ state = null, step = 1, fast = false } = {}) {

    if (this.nextButton) {
      this.nextButton.removeClass("active");
    }
    if (this.prevButton) {
      this.prevButton.removeClass("active");
    }

    if (!fast && this.flags.currentState.behavior !== CONSTANTS.BEHAVIORS.STILL) {
      if (this.nextButton && this.prevButton && state === null) {
        this[step > 0 ? "nextButton" : "prevButton"].addClass("active");
      }
      return this.queueState(state ?? this.flags.currentStateIndex + step);
    }

    clearTimeout(this.timeout);
    this.timeout = false;

    return this.updateState(state ?? this.flags.currentStateIndex + step);

  }

  determineStartTime(stateIndex) {

    const currState = this.flags.states?.[stateIndex];
    const currStart = lib.isRealNumber(currState?.start) ? Number(currState?.start) * this.flags.fps : (currState?.start ?? 0);

    switch (currStart) {

      case CONSTANTS.START.START:
        return 0;

      case CONSTANTS.START.END:
        return this.duration;

      case CONSTANTS.START.MID:
        return Math.floor(this.duration / 2);

      case CONSTANTS.START.PREV:
        return this.determineEndTime(stateIndex - 1);

    }

    return currStart;
  }

  determineEndTime(stateIndex) {

    const currState = this.flags.states?.[stateIndex];
    const currEnd = lib.isRealNumber(currState?.end) ? Number(currState?.end) * this.flags.fps : (currState?.end ?? this.duration);

    switch (currEnd) {

      case CONSTANTS.END.END:
        return this.duration;

      case CONSTANTS.END.MID:
        return Math.floor(this.duration / 2);

      case CONSTANTS.END.NEXT:
        return this.determineStartTime(stateIndex + 1);

    }

    return currEnd;

  }

  evaluateVisibility() {
    const hidden = this.flags.currentState.behavior === CONSTANTS.BEHAVIORS.STILL_HIDDEN;
    this.document.object.renderable = !hidden || game.user.isGM;
    this.document.object.mesh.alpha = hidden ? (game.user.isGM ? 0.5 : 0.0) : this.document.alpha;
    return hidden;
  }

  async getVideoPlaybackState() {

    if (!this.ready) return {
      playing: false, loop: false, currentTime: 0
    };

    if (!this.flags?.states?.length || !this.document?.object) return;

    const startTime = this.newCurrentTime ?? this.determineStartTime(this.flags.currentStateIndex) ?? 0;
    const endTime = this.determineEndTime(this.flags.currentStateIndex) ?? this.duration;
    this.newCurrentTime = null;

    this.evaluateVisibility();

    this.still = false;
    this.playing = true;
    this.texture.update();

    switch (this.flags.currentState.behavior) {

      case CONSTANTS.BEHAVIORS.STILL:
      case CONSTANTS.BEHAVIORS.STILL_HIDDEN:
        return this.handleStillBehavior(startTime);

      case CONSTANTS.BEHAVIORS.LOOP:
        return this.handleLoopBehavior(startTime, endTime);

      default:
        return this.handleOnceBehavior(startTime, endTime);

    }
  }

  setTimeout(callback, waitDuration) {
    clearTimeout(this.timeout);
    this.timeout = setTimeout(() => {
      this.timeout = false;
      callback();
    }, waitDuration);
  }

  async handleStillBehavior(startTime) {

    this.still = true;

    const fn = () => {
      this.video.removeEventListener("seeked", fn);
      this.texture.update();
    }
    this.video.addEventListener("seeked", fn);

    this.video.play();
    this.video.currentTime = startTime / 1000;
    this.video.pause();

    return false;

  }

  async handleLoopBehavior(startTime, endTime = 0) {

    const loopDuration = (endTime - startTime);
    const offsetLoopTime = this.offset % loopDuration;
    const offsetStartTime = (startTime + offsetLoopTime);

    this.offset = 0;

    this.setTimeout(() => {
      this.playing = false;
      if (this.flags.queuedStateIndexIsDifferent) {
        return this.updateState(this.flags.queuedStateIndex);
      }
      game.video.play(this.video);
    }, loopDuration - offsetLoopTime);

    return {
      playing: true, loop: false, offset: offsetStartTime / 1000
    }

  }

  async handleOnceBehavior(startTime, endTime) {

    this.setTimeout(async () => {
      let queuedState = this.flags.queuedStateIndex;
      if (queuedState === null) {
        queuedState = this.flags.determineNextStateIndex();
      }
      this.playing = false;
      this.video.pause();
      return this.updateState(queuedState);
    }, (endTime - startTime));

    this.offset = 0;

    return {
      playing: true, loop: false, offset: startTime / 1000
    }

  }

}

class Flags {

  constructor(doc) {
    this.doc = doc;
    this.uuid = doc.uuid;
    this.delegationUuid = this.uuid.split(".").slice(1).join("_");
    this._data = false;
  }

  get data() {
    if (!this._data) {
      this._data = this.getData();
    }
    return this._data;
  }

  get states() {
    return this.data?.states ?? [];
  }

  get offset() {
    return this.data?.offset ?? 0;
  }

  get updated() {
    return this.data?.updated ?? 0;
  }

  get previousState() {
    return this.states[this.previousStateIndex];
  }

  get previousStateIndex() {
    return Math.max(0, Math.min(this.data.previousState ?? this.currentStateIndex, this.data.states.length - 1));
  }

  get currentState() {
    return this.states[this.currentStateIndex];
  }

  get currentStateIndex() {
    const defaultStateIndex = this.data.states.findIndex(state => state.default) ?? 0;
    return Math.max(0, Math.min(this.data.currentState ?? defaultStateIndex, this.data.states.length - 1));
  }

  get queuedState() {
    return this.states[this.queuedStateIndex];
  }

  get queuedStateIndex() {
    return this.data.queuedState > -1 ? this.data.queuedState : null;
  }

  get fps() {
    return this.data?.frames ? 1000 / (this.data?.fps || 25) : 1;
  }

  get queuedStateIndexIsDifferent() {
    return this.queuedStateIndex !== null && this.queuedStateIndex !== this.currentStateIndex;
  }

  getData() {
    const documentFlags = getProperty(this.doc, CONSTANTS.FLAGS);
    if (currentDelegator && !currentDelegator.isGM) {
      const userFlags = getProperty(currentDelegator, CONSTANTS.DELEGATED_STATEFUL_VIDEOS_FLAG + "." + this.delegationUuid);
      if (userFlags?.updated && documentFlags?.updated && userFlags?.updated > documentFlags?.updated) {
        return userFlags;
      }
    }
    return documentFlags;
  }

  copyData() {
    copiedData.set({
      [CONSTANTS.STATES_FLAG]: this.data.states,
      [CONSTANTS.FRAMES_FLAG]: this.data.frames,
      [CONSTANTS.FPS_FLAG]: this.data.fps,
      [CONSTANTS.CURRENT_STATE_FLAG]: this.currentStateIndex
    });
    ui.notifications.notify("The Kinemancer | Copied video state data")
  }

  pasteData() {
    const localCopyData = get(copiedData);
    if (!localCopyData) return;
    if (foundry.utils.isEmpty(localCopyData)) return;
    this.doc.update({
      ...foundry.utils.deepClone(localCopyData)
    });
    ui.notifications.notify("The Kinemancer | Pasted video state data")
  }

  updateData() {
    this._data = this.getData();
  }

  getStateById(id) {
    const index = this.states.findIndex(state => state.id === id);
    return index >= 0 ? index : false;
  }

  getStateIndexFromSteps(steps = 1) {
    return Math.max(0, Math.min(this.currentStateIndex + steps, this.data.states.length - 1));
  }

  determineNextStateIndex(stateIndex = null) {

    stateIndex ??= this.currentStateIndex;

    const state = this.states[stateIndex];

    const index = Math.max(0, Math.min(stateIndex, this.states.length - 1));

    const defaultIndex = this.states.findIndex(s => s.default);

    switch (state?.behavior) {

      case CONSTANTS.BEHAVIORS.ONCE_NEXT:
        return this.states[index + 1] ? index + 1 : defaultIndex;

      case CONSTANTS.BEHAVIORS.ONCE_PREVIOUS:
        return this.states[index - 1] ? index - 1 : defaultIndex;

      case CONSTANTS.BEHAVIORS.ONCE_PREVIOUS_ACTIVE:
        return this.previousStateIndex;

      case CONSTANTS.BEHAVIORS.ONCE_SPECIFIC:
        const nextIndex = this.getStateById(state.nextState);
        return nextIndex >= 0 ? nextIndex : defaultIndex;
    }

    return index;

  }

}
