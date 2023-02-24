import CONSTANTS from "./constants.js";
import { copiedData, TileInterface } from "./tile-interface/tile-interface.js";
import * as lib from "./lib/lib.js";
import { getSceneDelegator, isRealNumber } from "./lib/lib.js";
import SocketHandler from "./socket.js";
import { get } from "svelte/store";

const tileHudMap = new Map();
const _managedStatefulTiles = new Map();
let currentDelegator = false;
let delegateDebounce = false;

export default class StatefulTile {

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
    this.ready = !!currentDelegator;
  }

  static setAllReady() {
    this.getAll().forEach(tile => {
      if (!tile.ready) {
        tile.ready = true;
        tile.flags.updateData();
        game.video.play(tile.video);
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
        await game.user.unsetFlag(CONSTANTS.MODULE_NAME, CONSTANTS.FLAG_KEYS.DELEGATED_TILES);
      }

      // If the delegator has changed to a non-GM, and the new delegator is you, whilst there are no GMs connected
      if (newDelegator !== currentDelegator && !newDelegator.isGM && newDelegator === game.user && !lib.isGMConnected()) {

        // Grab all tile's current state
        let updates = {};
        StatefulTile.getAll().forEach(tile => {
          updates[CONSTANTS.DELEGATED_TILES_FLAG + "." + tile.delegationUuid] = tile.flags.getData();
        });

        currentDelegator = newDelegator;

        // Store the tile's current state on yourself
        await game.user.update(updates);

      }

      currentDelegator = newDelegator;

      StatefulTile.setAllReady();

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

      // If the user wasn't updated with delegated tiles, exit
      if (!hasProperty(data, CONSTANTS.DELEGATED_TILES_FLAG)) return;

      // If they were, but it was removed, exit
      const updatedTiles = getProperty(data, CONSTANTS.DELEGATED_TILES_FLAG);
      if (!updatedTiles) return;

      // If the current delegator is a GM, don't do anything, they will handle updates
      if (currentDelegator.isGM) return;

      // Otherwise, loop through each of the updated tiles
      Object.keys(updatedTiles).forEach(key => {
        // Get the stateful tile based on the UUID that was updated on the user
        const [sceneId, tileId] = key.split("_");
        const tile = StatefulTile.get(`Scene.${sceneId}.Tile.${tileId}`);
        if (!tile) return;
        // Call the update method, and pass the user that is the current delegator
        StatefulTile.onUpdate(
          tile.document,
          // Construct a similar diff as normal tile updates would create
          foundry.utils.mergeObject({
            [CONSTANTS.FLAGS]: updatedTiles[key]
          }, {}),
          firstUpdate
        );
      });
      firstUpdate = false;
    });

    Hooks.on("renderTileHUD", (app, html) => {
      tileHudMap.set(app.object.document.uuid, app);
      const tile = StatefulTile.get(app.object.document.uuid);
      if (!tile) return;
      tile.renderTileHUD(app, html);
    });

    Hooks.on("updateTile", (tileDoc, data) => {
      if (!hasProperty(data, CONSTANTS.FLAGS)) return;
      StatefulTile.onUpdate(tileDoc, data);
    });

    Hooks.on("canvasReady", () => {
      setTimeout(() => {
        for (const placeableTile of canvas.tiles.placeables) {
          if (!placeableTile.isVideo || !getProperty(placeableTile.document, CONSTANTS.STATES_FLAG)?.length) continue;
          const tile = StatefulTile.make(placeableTile.document, placeableTile.texture);
          if (!tile) return;
          if (game?.video && tile.video) {
            game.video.play(tile.video);
          }
        }
      }, 200);
    })

    const refreshDebounce = foundry.utils.debounce((placeableTile) => {
      if (!placeableTile.isVideo || !getProperty(placeableTile.document, CONSTANTS.STATES_FLAG)?.length) return;
      const tile = StatefulTile.make(placeableTile.document, placeableTile.texture);
      if (!tile) return;
      if (game?.video && tile.video) {
        game.video.play(tile.video);
      }
    }, 200);

    Hooks.on("refreshTile", refreshDebounce);

  }

  static getAll() {
    return _managedStatefulTiles;
  }

  static get(uuid) {
    return _managedStatefulTiles.get(uuid) || false;
  }

  static make(document, texture) {
    const existingTile = this.get(document.uuid);
    if (!existingTile?.app || existingTile?.app?._state <= Application.RENDER_STATES.CLOSED) {

    }
    if (existingTile) return existingTile;
    const newTile = new this(document, texture);
    _managedStatefulTiles.set(newTile.uuid, newTile);
    if (currentDelegator) {
      newTile.flags.updateData();
    }
    return newTile;
  }

  get duration() {
    return this.video.duration * 1000;
  }

  static tearDown(uuid) {
    const tile = StatefulTile.get(uuid);
    if (!tile) return;
    if (tile.timeout) clearTimeout(tile.timeout);
    _managedStatefulTiles.delete(uuid);
  }

  static makeHudButton(tooltip, icon) {
    return $(`<div class="ats-hud-control-icon ats-tile-ui-button" data-tooltip-direction="UP" data-tooltip="${tooltip}">
      <i class="fas ${icon}"></i>
    </div>`);
  }

  /**
   * Adds additional control elements to the tile HUD relating to Animated Tile States
   *
   * @param app
   * @param html
   */
  renderTileHUD(app, html) {

    const tile = this;

    const root = $("<div class='ats-hud'></div>");

    const controlsContainer = $("<div class='ats-hud-controls-container'></div>")

    const configButton = $(`<div class="ats-hud-control-icon ats-tile-ui-button" data-tooltip-direction="UP" data-tooltip="Configure Tile States">
      <img src="${CONSTANTS.MODULE_ICON}"/>
    </div>`);

    configButton.on('pointerdown', () => {
      TileInterface.show(tile.document);
    });

    const fastPrevButton = StatefulTile.makeHudButton("Go To Previous State", "fas fa-backward-fast");
    const prevButton = StatefulTile.makeHudButton("Queue Previous State", "fas fa-backward-step");
    const nextButton = StatefulTile.makeHudButton("Queue Next State", "fas fa-step-forward");
    const fastNextButton = StatefulTile.makeHudButton("Go To Next State", "fas fa-fast-forward");

    fastPrevButton.on('pointerdown', () => {
      tile.changeState({ step: -1, fast: true });
    });

    prevButton.on('pointerdown', () => {
      tile.changeState({ step: -1 });
    });

    nextButton.on('pointerdown', () => {
      tile.changeState();
    });

    fastNextButton.on('pointerdown', () => {
      tile.changeState({ fast: true });
    });

    const copyButton = StatefulTile.makeHudButton("Copy", "fas fa-copy");
    const pasteButton = StatefulTile.makeHudButton("Paste", "fas fa-paste");

    copyButton.on('pointerdown', () => {
      tile.flags.copyData();
    });

    pasteButton.on('pointerdown', () => {
      tile.flags.pasteData();
    });

    controlsContainer.append(configButton);
    controlsContainer.append(fastPrevButton)
    controlsContainer.append(prevButton)
    controlsContainer.append(nextButton)
    controlsContainer.append(fastNextButton)
    controlsContainer.append(copyButton)
    controlsContainer.append(pasteButton)

    const selectContainer = $("<div class='ats-hud-select-container'></div>");
    const select = $("<select class='ats-tile-ui-button'></select>");
    select.on('change', function () {
      tile.changeState({ state: Number($(this).val()), fast: true });
    });

    for (const [index, state] of tile.flags.states.entries()) {
      select.append(`<option ${index === tile.flags.currentStateIndex ? "selected" : ""} value="${index}">${state.name}</option>`);
    }

    const sourcesContainer = $(`<select class="ats-tile-ui-button ats-sources-container"></select>`);

    sourcesContainer.on("change", function () {
      sourcesContainer.css('visibility', 'hidden');
      tile.update({
        img: $(this).val()
      });
    })

    lib.getWildCardFiles(this.flags.src).then(async (files) => {
      if (!files?.length) return;
      for (const file of files) {
        const fileNameParts = file.split("/");
        const option = $(`<option value="${file}">${fileNameParts[fileNameParts.length - 1]}</option>`);
        sourcesContainer.append(option);
      }
    });

    const sourceButton = StatefulTile.makeHudButton("Select New Source", "fas fa-file-pen");

    sourceButton.on("pointerdown", () => {
      const state = sourcesContainer.css('visibility');
      sourceButton.toggleClass('active', state !== 'visible');
      sourcesContainer.css('visibility', state === 'visible' ? "hidden" : "visible");
    });

    selectContainer.append(select);
    selectContainer.append(sourceButton);

    root.append(controlsContainer);
    root.append(selectContainer);
    root.append(sourcesContainer);

    tile.select = select;
    tile.prevButton = prevButton;
    tile.nextButton = nextButton;

    html.find(".col.middle").append(root);

  }

  updateSelect() {
    if (!this.select?.length) return;
    this.select.empty();
    for (const [index, state] of this.flags.states.entries()) {
      this.select.append(`<option ${index === this.flags.currentStateIndex ? "selected" : ""} value="${index}">${state.name}</option>`)
    }
  }

  static onUpdate(tileDoc, changes, firstUpdate = false) {
    let statefulTile = StatefulTile.get(tileDoc.uuid);
    if (!statefulTile) {
      if (!tileDoc.object.isVideo || !getProperty(tileDoc, CONSTANTS.STATES_FLAG)?.length) return;
      statefulTile = StatefulTile.make(tileDoc, tileDoc.object.texture);
    }
    statefulTile.flags.updateData();
    Hooks.call("ats.updateState", tileDoc, statefulTile.flags.data, changes);
    if (!statefulTile.flags.states.length) {
      this.tearDown(tileDoc.uuid);
      tileHudMap.get(tileDoc.uuid)?.render(true);
      return;
    }
    if (hasProperty(changes, CONSTANTS.STATES_FLAG)) {
      tileHudMap.get(tileDoc.uuid)?.render(true);
      statefulTile.flags.data.queuedState = statefulTile.flags.determineNextStateIndex();
      return tileDoc.update({
        [CONSTANTS.QUEUED_STATE_FLAG]: statefulTile.flags.data.queuedState
      });
    }
    statefulTile.offset = Number(new Date()) - statefulTile.flags.updated;
    statefulTile.updateSelect();
    if (hasProperty(changes, CONSTANTS.CURRENT_STATE_FLAG) || firstUpdate) {
      if (statefulTile.nextButton) {
        statefulTile.nextButton.removeClass("active");
      }
      if (statefulTile.prevButton) {
        statefulTile.prevButton.removeClass("active");
      }
      statefulTile.still = false;
      statefulTile.playing = false;
      game.video.play(statefulTile.video);
    }
  }

  static async changeTileState(uuid, { state = null, step = 1, queue = false } = {}) {
    const tile = fromUuidSync(uuid);
    if (!tile) return false;
    const flags = new Flags(tile);
    flags.updateData();
    if (!flags.states.length) {
      return false;
    }
    if (state !== null && !queue) {
      if (!isRealNumber(state)) {
        return false;
      }
      return tile.update({
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
    return tile.update({
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
      return SocketHandler.emit(SocketHandler.UPDATE_TILE, {
        uuid: this.uuid,
        update: data,
        userId: lib.getResponsibleGM().id
      });
    }

    const deconstructedData = Object.fromEntries(Object.entries(data)
      .map(([key, value]) => {
        const newKey = key.split(".");
        return [newKey[newKey.length - 1], value];
      }));

    return game.user.update({
      [`${CONSTANTS.DELEGATED_TILES_FLAG}.${this.document.parent.id}_${this.document.id}`]: deconstructedData
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
    const currStart = lib.isRealNumber(currState?.start)
      ? Number(currState?.start) * this.flags.fps
      : (currState?.start ?? 0);

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
    const currEnd = lib.isRealNumber(currState?.end)
      ? Number(currState?.end) * this.flags.fps
      : (currState?.end ?? this.duration);

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

  async getVideoPlaybackState() {

    if (!this.ready) return {
      playing: false,
      loop: false,
      currentTime: 0
    };

    if (!this.flags?.states?.length || !this.document?.object) return;

    const startTime = this.determineStartTime(this.flags.currentStateIndex) ?? 0;
    const endTime = this.determineEndTime(this.flags.currentStateIndex) ?? this.duration;

    this.still = false;
    this.playing = true;
    this.texture.update();

    switch (this.flags.currentState.behavior) {

      case CONSTANTS.BEHAVIORS.STILL:
        return this.handleStillBehavior(startTime, endTime);

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
      playing: true,
      loop: false,
      offset: offsetStartTime / 1000
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
      playing: true,
      loop: false,
      offset: startTime / 1000
    }

  }

}

class Flags {

  constructor(doc) {
    this.doc = doc;
    this.uuid = doc.uuid;
    this.delegationUuid = this.uuid.split(".")[1] + "_" + this.uuid.split(".")[3];
    this.data = {};
  }

  get src() {
    return this.data?.src ?? "";
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
    return Math.max(0, Math.min(this.data.previousState ?? this.data.currentState, this.data.states.length - 1));
  }

  get currentState() {
    return this.states[this.currentStateIndex];
  }

  get currentStateIndex() {
    return Math.max(0, Math.min(this.data.currentState, this.data.states.length - 1));
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
      const userFlags = getProperty(currentDelegator, CONSTANTS.DELEGATED_TILES_FLAG + "." + this.delegationUuid);
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
      [CONSTANTS.SOURCE_FLAG]: this.data.src,
      [CONSTANTS.FPS_FLAG]: this.data.fps,
      [CONSTANTS.CURRENT_STATE_FLAG]: this.currentStateIndex
    });
  }

  pasteData() {
    if (!copiedData) return;
    this.doc.update({
      ...foundry.utils.deepClone(get(copiedData))
    });
  }

  updateData() {
    this.data = this.getData();
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
