import CONSTANTS from "./constants.js";
import TileInterface from "./tile-interface/tile-interface.js";
import * as lib from "./lib/lib.js";
import { getSceneDelegator } from "./lib/lib.js";
import SocketHandler from "./socket.js";

const _managedStatefulTiles = new Map();
let currentDelegator = false;
let delegateDebounce = false;

export default class StatefulTile {

  constructor(document, texture) {
    this.document = document;
    this.uuid = this.document.uuid;
    this.delegationUuid = this.uuid.split(".")[1] + "_" + this.uuid.split(".")[3];
    this.flags = {};
    this.offset = this.flags?.offset || 0;
    this.texture = texture;
    this.video = this.texture.baseTexture.resource.source;
    this.timeout = false;
    this.still = false;
    this.nextButton = false;
    this.prevButton = false;
    this.select = false;
    this.ready = !!currentDelegator;
  }

  static setAllReady(newDelegator) {
    this.getAll().forEach(tile => {
      if (!tile.ready) {
        tile.ready = true;
        tile.flags = tile.getFlags();
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
          updates[CONSTANTS.DELEGATED_TILES_FLAG + "." + tile.delegationUuid] = tile.getFlags();
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
      const tile = StatefulTile.get(app.object.document.uuid);
      if (!tile) return;
      tile.renderTileHUD(app, html);
    });

    Hooks.on("updateTile", (tileDoc, data) => {
      if (!hasProperty(data, CONSTANTS.FLAGS)) return;
      StatefulTile.onUpdate(tileDoc, data);
    });

  }

  static getAll() {
    return _managedStatefulTiles;
  }

  static get(uuid) {
    return _managedStatefulTiles.get(uuid) || false;
  }

  static make(document, texture) {
    const existingTile = this.get(document.uuid);
    if (existingTile) return existingTile;
    const newTile = new this(document, texture);
    _managedStatefulTiles.set(newTile.uuid, newTile);
    if (currentDelegator) {
      newTile.flags = newTile.getFlags();
    }
    return newTile;
  }

  get fps() {
    return this.flags?.frames ? 1000 / (this.flags?.fps || 25) : 1;
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

    controlsContainer.append(fastPrevButton)
    controlsContainer.append(prevButton)
    controlsContainer.append(nextButton)
    controlsContainer.append(fastNextButton)

    const selectContainer = $("<div class='ats-hud-select-container'></div>");
    const select = $("<select class='ats-tile-ui-button'></select>");
    select.on('change', function () {
      tile.changeState({ state: Number($(this).val()) });
    });

    for (const [index, state] of tile.flags.states.entries()) {
      select.append(`<option ${index === tile.currentState ? "selected" : ""} value="${index}">${state.name}</option>`);
    }

    const configButton = StatefulTile.makeHudButton("Configure Animated Tile States", "fas fa-cog");

    configButton.on('pointerdown', () => {
      TileInterface.show(tile.document);
    });

    const sourcesContainer = $(`<select class="ats-tile-ui-button ats-sources-container"></select>`);

    sourcesContainer.on("change", function () {
      sourcesContainer.css('visibility', 'hidden');
      tile.update({
        img: $(this).val()
      });
    })

    lib.getWildCardFiles(this.flags?.src).then(async (files) => {
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

    selectContainer.append(sourceButton);
    selectContainer.append(select);
    selectContainer.append(configButton);

    root.append(controlsContainer);
    root.append(selectContainer);
    root.append(sourcesContainer);

    tile.select = select;
    tile.prevButton = prevButton;
    tile.nextButton = nextButton;

    html.find(".col.middle").append(root);

  }

  updateSelect(select) {
    select.empty();
    for (const [index, state] of this.flags.states.entries()) {
      select.append(`<option ${index === this.currentState ? "selected" : ""} value="${index}">${state.name}</option>`)
    }
  }

  getFlags() {
    const documentFlags = getProperty(this.document, CONSTANTS.FLAGS);
    if (currentDelegator && !currentDelegator.isGM) {
      const userFlags = getProperty(currentDelegator, CONSTANTS.DELEGATED_TILES_FLAG + "." + this.delegationUuid);
      if (userFlags?.updated && documentFlags?.updated && userFlags?.updated > documentFlags?.updated) {
        return userFlags;
      }
    }
    return documentFlags;
  }

  static onUpdate(tileDoc, changes, firstUpdate = false) {
    const statefulTile = StatefulTile.get(tileDoc.uuid);
    if (!statefulTile) return;
    statefulTile.flags = statefulTile.getFlags();
    statefulTile.offset = Number(new Date()) - statefulTile.flags.updated;
    if (statefulTile.select?.length) {
      statefulTile.updateSelect(statefulTile.select);
    }
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
    return this.update({
      [CONSTANTS.QUEUED_STATE_FLAG]: newState
    });
  }

  async updateState(stateIndex) {
    return this.update({
      [CONSTANTS.PREVIOUS_STATE_FLAG]: this.currentState,
      [CONSTANTS.CURRENT_STATE_FLAG]: stateIndex,
      [CONSTANTS.QUEUED_STATE_FLAG]: this.determineNextState(stateIndex)
    });
  }

  determineNextState(stateIndex) {

    const index = Math.max(0, Math.min(stateIndex, this.flags.states.length - 1));

    const defaultIndex = this.flags.states.findIndex(state => state.default);

    const currentState = this.flags.states[index];

    switch (currentState.behavior) {

      case CONSTANTS.BEHAVIORS.ONCE_NEXT:
        return this.flags.states[index + 1] ? index + 1 : defaultIndex;

      case CONSTANTS.BEHAVIORS.ONCE_PREVIOUS:
        return this.flags.states[index - 1] ? index - 1 : defaultIndex;

      case CONSTANTS.BEHAVIORS.ONCE_PREVIOUS_ACTIVE:
        return this.previousState;

      case CONSTANTS.BEHAVIORS.ONCE_SPECIFIC:
        return this.flags.states[currentState.nextState] ? currentState.nextState : defaultIndex;
    }

    return index;

  }

  async changeState({ state = null, step = 1, fast = false } = {}) {

    const currentState = this.flags.states[this.currentState];

    if (this.nextButton) {
      this.nextButton.removeClass("active");
    }
    if (this.prevButton) {
      this.prevButton.removeClass("active");
    }

    if (!fast && currentState.behavior !== CONSTANTS.BEHAVIORS.STILL) {
      if (this.nextButton && this.prevButton && state === null) {
        this[step > 0 ? "nextButton" : "prevButton"].addClass("active");
      }
      return this.queueState(state ?? this.currentState + step);
    }

    clearTimeout(this.timeout);
    this.timeout = false;

    return this.updateState(state ?? this.currentState + step);

  }

  get previousState() {
    return Math.max(0, Math.min(this.flags.previousState ?? this.flags.currentState, this.flags.states.length - 1));
  }

  get currentState() {
    return Math.max(0, Math.min(this.flags.currentState, this.flags.states.length - 1));
  }

  get queuedState() {
    return this.flags.queuedState > -1 ? this.flags.queuedState : null;
  }

  determineStartTime(stateIndex) {

    const currState = this.flags.states?.[stateIndex];
    const currStart = lib.isRealNumber(currState?.start)
      ? Number(currState?.start) * this.fps
      : (currState?.start ?? 0);

    switch (currState.start) {

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
    const currStart = lib.isRealNumber(currState?.start)
      ? Number(currState?.start) * this.fps
      : (currState?.start ?? this.duration);

    switch (currState.end) {

      case CONSTANTS.END.END:
        return this.duration;

      case CONSTANTS.END.MID:
        return Math.floor(this.duration / 2);

      case CONSTANTS.END.NEXT:
        return this.determineStartTime(stateIndex + 1);

    }

    return currStart;

  }

  async getVideoPlaybackState() {

    if (!this.ready) return {
      playing: false,
      loop: false,
      currentTime: 0
    };

    if (!this.flags?.states || !this.document?.object) return;

    const currentState = this.flags.states[this.currentState];

    const startTime = this.determineStartTime(this.currentState);
    const endTime = this.determineEndTime(this.currentState);

    this.still = false;
    this.playing = true;

    switch (currentState.behavior) {

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
      if (this.queuedState !== null && this.queuedState !== this.currentState) {
        return this.updateState(this.queuedState);
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
      let queuedState = this.queuedState;
      if (queuedState === null) {
        queuedState = this.determineNextState(this.currentState);
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
