import CONSTANTS from "./constants.js";
import * as lib from "./lib/lib.js";
import { getVideoDimensions } from "./lib/lib.js";
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
        this.video = this.texture?.baseTexture?.resource?.source;
        this.timeout = null;
        this.still = false;
        this.playing = false;
        this.ignoreDate = false;
        this.nextButton = false;
        this.prevButton = false;
        this.select = false;
        this.newCurrentTime = null;
        this.randomTimers = {};
        this.ready = !!currentDelegator;
        this.allColorVariations = {};
        this.allVariationDurations = {};
        this.preloadAssets();
        if (!this.video) {
            this.waitUntilReady();
        }
    }

    static setAllReady() {
        this.getAll().forEach(statefulVideo => {
            if (!statefulVideo.ready) {
                statefulVideo.ready = true;
                statefulVideo.flags.updateData();
                statefulVideo.setupRandomTimers();
                statefulVideo.play();
            }
        });
    }

    static determineCurrentDelegator() {

        if (delegateDebounce) {
            return delegateDebounce();
        }

        delegateDebounce = foundry.utils.debounce(async () => {

            // When you first render a scene, determine which user should be the delegator
            const newDelegator = lib.getSceneDelegator();

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

        delegateDebounce();

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
            if (!foundry.utils.hasProperty(data, CONSTANTS.DELEGATED_STATEFUL_VIDEOS_FLAG)) return;

            // If they were, but it was removed, exit
            const statefulVideos = foundry.utils.getProperty(data, CONSTANTS.DELEGATED_STATEFUL_VIDEOS_FLAG);
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

        Hooks.on("preUpdateToken", (placeableDoc, data) => {
            StatefulVideo.onPreUpdate(placeableDoc, data);
        });

        Hooks.on("updateToken", (placeableDoc, data) => {
            StatefulVideo.onUpdate(placeableDoc, data);
        });

        Hooks.on("createTile", (placeableDoc) => {
            StatefulVideo.createPlaceable(placeableDoc);
        });

        Hooks.on("createToken", (placeableDoc) => {
            StatefulVideo.createPlaceable(placeableDoc);
        });

        let firstUserGesture = false;
        let canvasReady = false
        Hooks.once("canvasFirstUserGesture", () => {
            firstUserGesture = true;
            if (canvasReady) {
                StatefulVideo.canvasReady();
            }
        });

        Hooks.on("canvasReady", () => {
            canvasReady = true;
            if (firstUserGesture) {
                StatefulVideo.canvasReady();
            } else {
                StatefulVideo.canvasNotReady();
            }
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
                statefulVideo.play();
            }
        }, 200);

        Hooks.on("refreshTile", (placeableObject) => {
            if (!placeableObject.isVideo || !foundry.utils.getProperty(placeableObject.document, CONSTANTS.STATES_FLAG)?.length) return;
            const statefulVideo = StatefulVideo.make(placeableObject.document, placeableObject.texture);
            if (!statefulVideo) return;
            statefulVideo.evaluateVisibility();
            refreshDebounce(statefulVideo);
        });

        Hooks.on("refreshToken", (placeableObject) => {
            if (!placeableObject.isVideo || !foundry.utils.getProperty(placeableObject.document, CONSTANTS.STATES_FLAG)?.length) return;
            const statefulVideo = StatefulVideo.make(placeableObject.document, placeableObject.texture);
            if (!statefulVideo) return;
            statefulVideo.evaluateVisibility();
            refreshDebounce(statefulVideo);
        });

    }

    static createPlaceable(placeableDoc) {
        const hasFlags = foundry.utils.getProperty(placeableDoc, CONSTANTS.STATES_FLAG)?.length;
        if (hasFlags) {
            return StatefulVideo.make(placeableDoc, placeableDoc.object.texture)
        }
        if (!lib.isResponsibleGM()) return;
        const path = lib.getVideoJsonPath(placeableDoc);
        fetch(path)
            .then(response => response.json())
            .then((result) => {
                const jsonData = foundry.utils.mergeObject(result, {});
                const states = foundry.utils.getProperty(jsonData, CONSTANTS.STATES_FLAG);
                jsonData[CONSTANTS.CURRENT_STATE_FLAG] = states.findIndex(s => s.default);
                const currentState = states[jsonData[CONSTANTS.CURRENT_STATE_FLAG]];
                if (jsonData[CONSTANTS.FOLDER_PATH_FLAG] && currentState.file) {
                    jsonData["texture.src"] = jsonData[CONSTANTS.FOLDER_PATH_FLAG] + "/" + currentState.file;
                }
                placeableDoc.update(jsonData);
            })
            .catch(err => {
            });
    }

    static getValidPlaceables() {
        return [...canvas.tiles.placeables, canvas.tokens.placeables].filter(placeable => {
            return placeable.isVideo && foundry.utils.getProperty(placeable.document, CONSTANTS.STATES_FLAG)?.length;
        });
    }

    static canvasReady() {
        hudScale.set(canvas.stage.scale.x);
        for (const placeable of this.getValidPlaceables()) {
            const statefulVideo = this.make(placeable.document, placeable.texture);
            if (!statefulVideo) return;
            if (game?.video && statefulVideo.video) {
                statefulVideo.play();
            }
        }
    }

    static canvasNotReady() {
        for (const placeable of this.getValidPlaceables()) {
            placeable.renderable = false;
            placeable.mesh.renderable = false;
        }
    }

    static getAll() {
        return managedStatefulVideos;
    }

    static get(uuid) {
        return managedStatefulVideos.get(uuid) || false;
    }

    static make(document, texture) {
        const existingStatefulVideo = this.get(document.uuid);
        if (existingStatefulVideo) return existingStatefulVideo;
        const newStatefulVideo = new this(document, texture);
        managedStatefulVideos.set(newStatefulVideo.uuid, newStatefulVideo);
        if (currentDelegator) {
            newStatefulVideo.flags.updateData();
        }
        return newStatefulVideo;
    }

    get duration() {
        if (this.allVariationDurations[this.document.texture.src]) {
            return Math.max(0, this.allVariationDurations[this.document.texture.src] - this.flags.singleFrameDuration);
        }
        return Math.max(0, (this.video.duration * 1000) - this.flags.singleFrameDuration);
    }

    static tearDown(uuid) {
        const statefulVideo = StatefulVideo.get(uuid);
        if (!statefulVideo) return;
        if (statefulVideo.timeout) clearTimeout(statefulVideo.timeout);
        statefulVideo.clearRandomTimers();
        managedStatefulVideos.delete(uuid);
    }

    static makeHudButton(tooltip, icon, style = "") {
        return $(`<div class="ats-hud-control-icon ats-stateful-video-ui-button" style="${style}" data-tooltip-direction="UP" data-tooltip="${tooltip}">
      <i class="fas ${icon}"></i>
    </div>`);
    }


    static makeStateSelect(statefulVideo) {
        if (!statefulVideo.flags.states.length) return false;
        const select = $("<select class='ats-stateful-select'></select>");
        select.on('change', function () {
            statefulVideo.changeState({ state: Number($(this).val()), fast: true });
        });

        for (const [index, state] of statefulVideo.flags.states.entries()) {
            select.append(`<option ${index === statefulVideo.flags.currentStateIndex ? "selected" : ""} value="${index}">${state.name}</option>`);
        }
        return select;
    }

    /**
     * Adds additional control elements to the tile HUD relating to Animated Tile States
     *
     * @param app
     * @param html
     */
    static async renderStatefulVideoHud(app, html) {

        const placeable = app.object;
        const placeableDocument = placeable.document;
        const statefulVideo = StatefulVideo.get(placeableDocument.uuid);

        const root = $("<div class='ats-hud'></div>");

        const selectContainer = $("<div class='ats-hud-select-container'></div>");

        const statefulVideoColor = lib.determineFileColor(placeableDocument.texture?.src || "");

        const selectButtonContainer = $("<div class='ats-color-variations-button-container'></div>");

        const selectColorButton = $(`<div class="ats-hud-control-icon ats-stateful-video-ui-button" data-tooltip-direction="UP" data-tooltip="Change Color & Variant">
      ${statefulVideoColor.icon ? `<i class="fas ${statefulVideoColor.icon}"></i>` : ""}
      ${statefulVideoColor.color ? `<div class="ats-color-button" style="${statefulVideoColor.color}"></div>` : ""}
    </div>`);

        if (statefulVideo) {

            const iconContainer = $("<div class='ats-hud-icon-container'></div>");
            selectContainer.append(iconContainer);

            for (const [index, state] of statefulVideo.flags.states.entries()) {
                if (!state.icon) continue;
                const currentState = statefulVideo.flags.currentStateIndex === index;
                const stateBtn = StatefulVideo.makeHudButton(state.name, state.icon, currentState ? "background-color: #048d6e;" : "");
                stateBtn.on("pointerdown", () => {
                    statefulVideo.changeState({ state: index, fast: true });
                });
                iconContainer.append(stateBtn);
            }

            if (statefulVideo.flags.clientDropdown && statefulVideo.flags.states.length) {
                const select = StatefulVideo.makeStateSelect(statefulVideo);
                selectContainer.append(select);
                statefulVideo.select = select;
            }

            if (statefulVideo.flags.states.some(state => state.icon)) {
                selectButtonContainer.addClass("ats-left-padding");
            }
        }

        const fileSearchQuery = lib.getCleanWebmPath(placeableDocument)
            .replace(".webm", "*.webm")

        const cleanTexturePath = decodeURIComponent(placeableDocument.texture.src);

        const baseVariation = cleanTexturePath.includes("_(")
            ? cleanTexturePath.split("_(")[1].split(")")[0]
            : "base";

        const internalVariation = cleanTexturePath.includes("_[")
            ? cleanTexturePath.split("_[")[1].split("]")[0]
            : "base";

        const colorVariation = cleanTexturePath.includes("__")
            ? cleanTexturePath.split("__")[1].split(".")[0]
            : "base";

        await lib.getWildCardFiles(fileSearchQuery)
            .then((results) => {
                return results.map(decodeURIComponent);
            })
            .then((results) => {

                const nonThumbnails = results.filter(filePath => !filePath.includes("_thumb")).sort((a, b) => {
                    const a_value = (a.includes("_[")) + (a.includes("_(") * 10) + (a.includes("__") * 100);
                    const b_value = (b.includes("_[")) + (b.includes("_(") * 10) + (b.includes("__") * 100);
                    return a_value - b_value;
                });

                const internalVariations = Object.values(nonThumbnails.reduce((acc, filePath) => {
                    const specificInternalVariation = filePath.includes("_[")
                        ? filePath.split("_[")[1].split("]")[0].replace("_", " ").trim()
                        : "base";
                    const specificBaseVariation = filePath.includes("_(")
                        ? filePath.split("_(")[1].split(")")[0]
                        : "base";
                    const specificColorVariation = filePath.includes("__")
                        ? filePath.split("__")[1].split(".")[0]
                        : "base";

                    acc[specificInternalVariation] ??= filePath;
                    if (baseVariation === specificBaseVariation && colorVariation === specificColorVariation) {
                        acc[specificInternalVariation] = filePath;
                    }
                    return acc;
                }, {}));

                if (statefulVideo) {
                    statefulVideo.allInternalVariations = nonThumbnails.reduce((acc, filePath) => {

                        const specificBaseVariation = filePath.includes("_(")
                            ? filePath.split("_(")[1].split(")")[0]
                            : "base";

                        const specificInternalVariation = filePath.includes("_[")
                            ? filePath.split("_[")[1].split("]")[0]
                            : false;

                        if (specificInternalVariation) {
                            acc[specificBaseVariation] ??= new Set()
                            acc[specificBaseVariation].add(specificInternalVariation);
                        }

                        return acc;
                    }, {})

                    statefulVideo.allColorVariations = nonThumbnails.reduce((acc, filePath) => {
                        const colorConfig = lib.determineFileColor(filePath);

                        const colorSpecificBaseVariation = filePath.includes("_(")
                            ? filePath.split("_(")[1].split(")")[0]
                            : "base";

                        acc[colorSpecificBaseVariation] ??= new Set()
                        acc[colorSpecificBaseVariation].add(colorConfig.colorName || 'original');
                        return acc;
                    }, {})
                }

                const colorVariations = Object.values(nonThumbnails.reduce((acc, filePath) => {
                    const colorSpecificBaseVariation = filePath.includes("_(")
                        ? filePath.split("_(")[1].split(")")[0]
                        : "base";
                    if (baseVariation !== colorSpecificBaseVariation) {
                        return acc;
                    }
                    const colorSpecificInternalVariation = filePath.includes("_[")
                        ? filePath.split("_[")[1].split("]")[0]
                        : "base";
                    if (internalVariation !== colorSpecificInternalVariation) {
                        return acc;
                    }
                    const colorConfig = lib.determineFileColor(filePath);
                    if (!acc[colorConfig.colorName]) {
                        acc[colorConfig.colorName] = {
                            ...colorConfig,
                            filePath
                        };
                    }
                    return acc;
                }, {})).sort((a, b) => {
                    return a.order - b.order;
                });

                if (internalVariations.length <= 1 && colorVariations.length <= 1) return;

                const parentContainer = $(`<div class="ats-variation-container"></div>`);

                const width = internalVariations.length > 1 ? 300 : Math.min(204, colorVariations.length * 34);
                parentContainer.css({ left: width * -0.4, width });

                selectColorButton.on('pointerdown', () => {
                    const newState = parentContainer.css('visibility') === "hidden" ? "visible" : "hidden";
                    parentContainer.css("visibility", newState);
                });

                selectContainer.append(selectButtonContainer);
                selectButtonContainer.append(selectColorButton);
                selectButtonContainer.append(parentContainer);

                if (internalVariations.length > 1) {
                    const variationContainer = $(`<div class="ats-variations ${colorVariations.length > 1 ? "ats-bottom-white-divider" : ""}"></div>`);
                    parentContainer.append(variationContainer);

                    let currentVariation = cleanTexturePath.includes("_[")
                        ? cleanTexturePath.split("[")[1].split("]")[0]
                        : "original";
                    currentVariation = currentVariation.replace("_", " ")

                    for (const variation of internalVariations) {
                        let name = variation.includes("_[") ? variation.split("[")[1].split("]")[0] : "original";
                        name = name.replace("_", " ")
                        const button = $(`<a style="${currentVariation === name ? 'color: #048d6e;' : ''}">${name}</a>`)
                        variationContainer.append(button);

                        button.on("pointerdown", async () => {

                            const videoDimension = Math.max(statefulVideo.video.videoWidth, statefulVideo.video.videoHeight);
                            const placeableDimension = Math.max(placeableDocument.width, placeableDocument.height);
                            const currentRatio = placeableDimension / videoDimension;

                            const { width, height } = await getVideoDimensions(variation);

                            await placeableDocument.update({
                                "texture.src": variation,
                                "width": width * currentRatio,
                                "height": height * currentRatio
                            });

                            const hud = placeable instanceof foundry.canvas.placeables.Token
                                ? canvas.tokens.hud
                                : canvas.tiles.hud;
                            placeable.control();
                            hud.bind(placeable);
                        });
                    }
                }

                if (colorVariations.length > 1) {
                    const colorContainer = $(`<div class="ats-color-container ${internalVariations.length > 1 ? "ats-top-divider" : ""}"></div>`);
                    parentContainer.append(colorContainer);
                    for (const colorConfig of colorVariations) {
                        const { colorName, color, tooltip, filePath } = colorConfig;
                        const button = $(`<div class="ats-color-button" style="${color}" data-tooltip="${tooltip}"></div>`)
                        if (!colorName) {
                            colorContainer.prepend(button);
                        } else {
                            colorContainer.append(button);
                        }
                        button.on("pointerdown", async () => {
                            selectColorButton.html(`<div class="ats-color-button" style="${color}"></div>`);
                            selectColorButton.trigger("pointerdown");
                            await placeableDocument.update({
                                "texture.src": filePath
                            });
                            const hud = placeable instanceof foundry.canvas.placeables.Token
                                ? canvas.tokens.hud
                                : canvas.tiles.hud;
                            placeable.control();
                            hud.bind(placeable);
                        });
                    }
                }
            });

        if (statefulVideo || selectButtonContainer.children().length) {
            root.append(selectContainer);
        }

        if (statefulVideo) {
            statefulVideo.updateHudScale();
        }

        Hooks.call(CONSTANTS.HOOKS.RENDER_UI, app, root, placeableDocument, statefulVideo);

        if (root.children().length) {
            $(html).find(".col.middle").append(root);
        }

    }

    preloadAssets() {
        if (!this.flags.useFiles) return;
        const textures = this.flags.states.map(state => {
            return state.file
                ? this.flags.folderPath + "/" + state.file
                : this.flags.baseFile;
        });
        for (let path of textures) {
            foundry.canvas.TextureLoader.loader.loadTexture(path).then(texture => {
                this.allVariationDurations[path] = texture.resource.source.duration * 1000;
            });
        }
    }

    play() {
        return game.video.play(this.video);
    }

    async waitUntilReady() {
        while (!this.video) {
            this.document.renderable = false;
            if (this.document?.mesh) this.document.mesh.renderable = false;
            this.updateVideo();
            await lib.wait(10);
        }
        this.play();
    }

    updateVideo() {
        if (!this.document.object) return;
        this.texture = this.document.object.texture;
        this.video = this.document.object?.texture?.baseTexture?.resource?.source;
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
        const diff = foundry.utils.diffObject(placeableDoc, changes);
        if (foundry.utils.hasProperty(diff, "texture.src") && !foundry.utils.hasProperty(diff, CONSTANTS.CURRENT_STATE_FLAG) && statefulVideo) {
            statefulVideo.newCurrentTime = statefulVideo.video.currentTime * 1000;
        }
        placeableDoc.updateSource({
            "flags.core.randomizeVideo": false
        });
    }

    refreshVideo() {
        this.texture = this.texture;
        this.video = this.texture.baseTexture.resource.source;
        this.still = false;
        this.playing = false;
        clearTimeout(this.timeout);
    }

    static onUpdate(placeableDoc, changes, firstUpdate = false) {
        let statefulVideo = StatefulVideo.get(placeableDoc.uuid);
        if (foundry.utils.hasProperty(changes, "texture.src") && statefulVideo) {
            if (placeableDoc.object.texture.valid) {
                statefulVideo.refreshVideo();
            } else {
                placeableDoc.object.texture.on("update", () => {
                    statefulVideo.refreshVideo();
                })
            }
        }
        if (!foundry.utils.hasProperty(changes, CONSTANTS.FLAGS)) return;
        if (!statefulVideo) {
            if (!placeableDoc.object.isVideo || !foundry.utils.getProperty(placeableDoc, CONSTANTS.STATES_FLAG)?.length) return;
            statefulVideo = StatefulVideo.make(placeableDoc, placeableDoc.object.texture);
        }
        statefulVideo.flags.updateData();
        Hooks.call("ats.updateState", placeableDoc, statefulVideo.flags.data, changes);
        if (!statefulVideo.flags.states.length) {
            this.tearDown(placeableDoc.uuid);
            statefulVideoHudMap.get(placeableDoc.uuid)?.render(true);
            return;
        }
        statefulVideo.offset = Number(Date.now()) - statefulVideo.flags.updated;
        if (foundry.utils.hasProperty(changes, CONSTANTS.STATES_FLAG)) {
            statefulVideoHudMap.get(placeableDoc.uuid)?.render(true);
            statefulVideo.still = false;
            statefulVideo.playing = false;
            statefulVideo.clearRandomTimers();
            statefulVideo.setupRandomTimers();
            clearTimeout(statefulVideo.timeout);
            statefulVideo.flags.data.queuedState = statefulVideo.flags.determineNextStateIndex();
            return placeableDoc.update({
                [CONSTANTS.CURRENT_STATE_FLAG]: statefulVideo.flags.currentState.behavior === CONSTANTS.BEHAVIORS.RANDOM_STATE
                    ? statefulVideo.flags.data.queuedState
                    : statefulVideo.flags.data.currentStateIndex,
                [CONSTANTS.QUEUED_STATE_FLAG]: statefulVideo.flags.data.queuedState
            });
        }
        statefulVideo.updateSelect();
        if (foundry.utils.hasProperty(changes, CONSTANTS.CURRENT_STATE_FLAG) || firstUpdate || statefulVideo.flags.previousState.behavior === CONSTANTS.BEHAVIORS.RANDOM_STATE) {
            statefulVideo.setupRandomTimers();
            if (statefulVideo.nextButton) {
                statefulVideo.nextButton.removeClass("active");
            }
            if (statefulVideo.prevButton) {
                statefulVideo.prevButton.removeClass("active");
            }
            statefulVideo.still = false;
            statefulVideo.playing = false;
            if (!foundry.utils.hasProperty(changes, "texture.src")) {
                statefulVideo.play()
            }
        } else if (foundry.utils.hasProperty(changes, CONSTANTS.CURRENT_STATE_FLAG) && statefulVideo.flags.currentState.behavior === CONSTANTS.BEHAVIORS.STILL_HIDDEN) {
            statefulVideo.play()
        }
    }

    static isDataValid(flags, data) {
        const previousStateFlagDifferent = (data?.[CONSTANTS.PREVIOUS_STATE_FLAG] !== undefined && (flags.data[CONSTANTS.FLAG_KEYS.PREVIOUS_STATE] !== data?.[CONSTANTS.PREVIOUS_STATE_FLAG]));
        const currentStateFlagDifferent = (data?.[CONSTANTS.CURRENT_STATE_FLAG] !== undefined && (flags.data[CONSTANTS.FLAG_KEYS.CURRENT_STATE] !== data?.[CONSTANTS.CURRENT_STATE_FLAG]));
        const queuedStateFlagDifferent = (data?.[CONSTANTS.QUEUED_STATE_FLAG] !== undefined && (flags.data[CONSTANTS.FLAG_KEYS.QUEUED_STATE] !== data?.[CONSTANTS.QUEUED_STATE_FLAG]));
        const previousFlagIsRandomState = flags.data.states[(data?.[CONSTANTS.PREVIOUS_STATE_FLAG] ?? flags.data[CONSTANTS.FLAG_KEYS.CURRENT_STATE])]?.behavior === CONSTANTS.BEHAVIORS.RANDOM_STATE;
        return previousStateFlagDifferent || currentStateFlagDifferent || queuedStateFlagDifferent || previousFlagIsRandomState;
    }

    async update(data) {
        if (game.user !== currentDelegator) return;

        if (!StatefulVideo.isDataValid(this.flags, data)) return;

        data[CONSTANTS.UPDATED_FLAG] = data[CONSTANTS.UPDATED_FLAG] ?? Number(Date.now());

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
        let previousStateIndex = this.flags.currentStateIndex;
        if (this.flags.states[stateIndex].behavior === CONSTANTS.BEHAVIORS.RANDOM_STATE) {
            previousStateIndex = stateIndex;
            stateIndex = this.flags.determineNextStateIndex(stateIndex);
        }
        const updates = {
            [CONSTANTS.UPDATED_FLAG]: Number(Date.now()),
            [CONSTANTS.PREVIOUS_STATE_FLAG]: previousStateIndex,
            [CONSTANTS.CURRENT_STATE_FLAG]: stateIndex,
            [CONSTANTS.QUEUED_STATE_FLAG]: this.flags.determineNextStateIndex(stateIndex),
            "texture.src": this.flags.determineFile(stateIndex, this)
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

        this.clearRandomTimers();

        if (!fast && this.flags.currentState.behavior !== CONSTANTS.BEHAVIORS.STILL) {
            if (this.nextButton && this.prevButton && state === null) {
                this[step > 0 ? "nextButton" : "prevButton"].addClass("active");
            }
            return this.queueState(state ?? this.flags.currentStateIndex + step);
        }

        clearTimeout(this.timeout);
        this.timeout = null;

        const currentStateIndex = this.flags.currentStateIndex;

        return this.updateState(state ?? currentStateIndex + step).then(() => {
            if (currentStateIndex !== state) return;
            SocketHandler.emit(SocketHandler.REPLAY_CURRENT_STATE, { uuid: this.uuid, userId: game.userId });
            this.replayCurrentState();
        });

    }

    setupRandomTimers() {

        if (game.user !== currentDelegator) return;

        if (!(
            this.flags.currentState.behavior === CONSTANTS.BEHAVIORS.STILL
            || this.flags.currentState.behavior === CONSTANTS.BEHAVIORS.STILL_HIDDEN
            || this.flags.currentState.behavior === CONSTANTS.BEHAVIORS.LOOP
        )) {
            return false;
        }

        for (const stateIndex of this.flags.determineNextRandomStates()) {
            if (this.randomTimers[stateIndex]) continue;
            const state = this.flags.states[stateIndex];
            const delayStart = Number(state.randomStart) * 1000;
            const delayEnd = Number(state.randomEnd) * 1000;
            const delay = lib.randomIntegerBetween(delayStart, delayEnd);
            if (CONFIG.debug.kinemancer) ui.notifications.notify(`Next random state in ${delay / 1000}s`)
            let timerId = null;
            timerId = setTimeout(() => {
                delete this.randomTimers[stateIndex];
                if (this.flags.currentStateIsRandom) return;
                if (this.flags.currentStateIsStill) {
                    this.updateState(stateIndex);
                } else if (this.flags.currentStateIsLoop) {
                    this.queueState(stateIndex);
                }
            }, delay)
            this.randomTimers[stateIndex] = timerId;
        }

    }

    clearRandomTimers() {
        Object.values(this.randomTimers).forEach(timerId => clearTimeout(timerId));
        this.randomTimers = {};
    }

    determineStartTime(stateIndex) {

        const currState = this.flags.states?.[stateIndex];
        const currStart = lib.isRealNumber(currState?.start)
            ? Number(currState?.start) * this.flags.durationMultiplier
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
            ? Number(currState?.end) * this.flags.durationMultiplier
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

    evaluateVisibility() {
        const hidden = this.flags.currentState.behavior === CONSTANTS.BEHAVIORS.STILL_HIDDEN || !this.ready;
        if (this.document.object) this.document.object.renderable = !hidden || game.user.isGM;
        if (this.document.object.mesh) {
            this.document.object.mesh.renderable = !hidden || game.user.isGM;
            this.document.object.mesh.alpha = hidden ? (game.user.isGM ? 0.5 : 0.0) : this.document.alpha;
        }
        return hidden;
    }

    replayCurrentState() {
        this.still = false;
        this.playing = false;
        this.ignoreDate = true;
        clearTimeout(this.timeout);
        this.play()
    }

    getVideoPlaybackState(options) {

        if (!this.ready) {
            return {
                playing: false, loop: false, offset: 0
            };
        }

        if (!this.flags?.states?.length || !this.document?.object) return;

        const startTime = this.newCurrentTime ?? this.determineStartTime(this.flags.currentStateIndex);
        const endTime = this.determineEndTime(this.flags.currentStateIndex) ?? this.duration;
        this.newCurrentTime = null;

        this.evaluateVisibility();

        this.still = false;
        this.playing = options.playing;
        this.texture.update();

        switch (this.flags.currentState.behavior) {

            case CONSTANTS.BEHAVIORS.STILL:
            case CONSTANTS.BEHAVIORS.STILL_HIDDEN:
                return this.handleStillBehavior(options, startTime);

            case CONSTANTS.BEHAVIORS.LOOP:
                return this.handleLoopBehavior(options, startTime, endTime);

            default:
                return this.handleOnceBehavior(options, startTime, endTime);

        }
    }

    setTimeout(callback, waitDuration) {
        clearTimeout(this.timeout);
        this.timeout = setTimeout(() => {
            this.timeout = null;
            callback();
        }, Math.ceil(waitDuration));
    }

    async handleStillBehavior(options, startTime) {

        this.setupRandomTimers();

        this.still = true;

        const fn = () => {
            this.video.removeEventListener("seeked", fn);
            this.texture.update();
        }
        this.video.addEventListener("seeked", fn);

        await this.video.play();
        this.video.loop = false;
        this.video.currentTime = (startTime ?? 0) / 1000;
        this.video.pause();

        return false;
    }

    handleLoopBehavior(options, startTime, endTime = 0) {

        this.setupRandomTimers();

        let loopDuration = (endTime - startTime);

        if ((startTime + loopDuration) > this.duration) {
            loopDuration = (this.duration - startTime);
        }

        const offsetLoopTime = ((this.offset ?? 0) % loopDuration) ?? 0;
        const offsetStartTime = (startTime + offsetLoopTime);

        const noRandomTimers = foundry.utils.isEmpty(this.randomTimers);

        if (startTime === 0 && loopDuration === this.duration && !this.flags.queuedStateIndexIsDifferent && noRandomTimers) {
            return {
                loop: true, offset: offsetStartTime / 1000
            };
        }

        this.offset = 0;

        this.setTimeout(() => {
            this.playing = false;
            if (this.flags.queuedStateIndexIsDifferent) {
                return this.updateState(this.flags.queuedStateIndex);
            }
            this.play();
        }, loopDuration - offsetLoopTime);

        return {
            playing: options.playing, loop: false, offset: offsetStartTime / 1000
        }

    }

    handleOnceBehavior(options, startTime, endTime) {

        this.clearRandomTimers();

        this.setTimeout(async () => {
            let queuedState = this.flags.queuedStateIndex;
            if (queuedState === null) {
                queuedState = this.flags.determineNextStateIndex();
            }
            this.playing = false;
            this.video.pause();
            if (!this.flags.currentStateIsOnceThenStill) {
                return this.updateState(queuedState);
            } else {
                this.still = true;
            }
        }, (endTime - startTime));

        this.offset = 0;

        if (this.flags.currentStateIsOnceThenStill && Number(Date.now()) >= (this.flags.data.updated + endTime) && !this.ignoreDate) {
            this.playing = false;
            this.still = true;
            this.video.currentTime = endTime / 1000;
            this.video.pause();
            this.texture.update();
            return {
                playing: false, loop: false, offset: endTime / 1000
            };
        }

        this.ignoreDate = false;

        return {
            playing: options.playing, loop: false, offset: startTime / 1000
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

    get currentFile() {
        return decodeURIComponent(this.doc.texture.src);
    }

    get baseFile() {
        return foundry.utils.getProperty(this.doc, CONSTANTS.BASE_FILE_FLAG) ?? this.currentFile;
    }

    get clientDropdown() {
        return foundry.utils.getProperty(this.doc, CONSTANTS.CLIENT_DROPDOWN) ?? false;
    }

    get folderPath() {
        return foundry.utils.getProperty(this.doc, CONSTANTS.FOLDER_PATH_FLAG) ?? lib.getFolder(this.baseFile);
    }

    get useFiles() {
        return this.data?.useFiles ?? false;
    }

    get states() {
        return this.data?.states ?? [];
    }

    get offset() {
        return (Number(Date.now()) - this.updated) - this.singleFrameDuration;
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

    get currentStateIsStill() {
        return this.currentState.behavior === CONSTANTS.BEHAVIORS.STILL || this.currentState.behavior === CONSTANTS.BEHAVIORS.STILL_HIDDEN
    }

    get currentStateIsLoop() {
        return this.currentState.behavior === CONSTANTS.BEHAVIORS.LOOP
    }

    get currentStateIsRandom() {
        return this.currentState.behavior === CONSTANTS.BEHAVIORS.RANDOM || this.currentState.behavior === CONSTANTS.BEHAVIORS.RANDOM_IF
    }

    get currentStateIsOnceThenStill() {
        return this.currentState.behavior === CONSTANTS.BEHAVIORS.ONCE_STILL;
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

    get durationMultiplier() {
        switch (this.data?.numberType ?? CONSTANTS.NUMBER_TYPES.FRAMES) {
            case CONSTANTS.NUMBER_TYPES.MILLISECONDS:
                return 1;
            case CONSTANTS.NUMBER_TYPES.SECONDS:
                return 1000;
            case CONSTANTS.NUMBER_TYPES.FRAMES:
                return 1000 / this.fps;
        }
    }

    get fps() {
        return (this.data?.fps || 24);
    }

    get singleFrameDuration() {
        return (1000 / this.fps);
    }

    get queuedStateIndexIsDifferent() {
        return this.queuedStateIndex !== null && this.queuedStateIndex !== this.currentStateIndex;
    }

    getData() {
        const documentFlags = foundry.utils.getProperty(this.doc, CONSTANTS.FLAGS);
        if (currentDelegator && !currentDelegator.isGM) {
            const userFlags = foundry.utils.getProperty(currentDelegator, CONSTANTS.DELEGATED_STATEFUL_VIDEOS_FLAG + "." + this.delegationUuid);
            if (userFlags?.updated && documentFlags?.updated && userFlags?.updated > documentFlags?.updated) {
                return userFlags;
            }
        }
        return documentFlags;
    }

    copyData() {
        copiedData.set({
            [CONSTANTS.STATES_FLAG]: this.data.states,
            [CONSTANTS.NUMBER_TYPE_FLAG]: this.data.numberType,
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

    determineNextRandomStates(stateIndex = null) {

        stateIndex ??= this.currentStateIndex;

        const state = this.states[stateIndex];

        return this.states.filter(s => {
            return s.behavior === CONSTANTS.BEHAVIORS.RANDOM || (s.behavior === CONSTANTS.BEHAVIORS.RANDOM_IF && s.randomState === state.id);
        }).map(s => this.states.indexOf(s));

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

            case CONSTANTS.BEHAVIORS.ONCE_STILL:
            case CONSTANTS.BEHAVIORS.ONCE_PREVIOUS_ACTIVE:
            case CONSTANTS.BEHAVIORS.RANDOM:
                return this.currentStateIndex;

            case CONSTANTS.BEHAVIORS.RANDOM_IF:
                const nextSpecific = this.getStateById(state.randomState);
                return nextSpecific >= 0 ? nextSpecific : defaultIndex;

            case CONSTANTS.BEHAVIORS.ONCE_SPECIFIC:
                const nextIndex = this.getStateById(state.nextState);
                return nextIndex >= 0 ? nextIndex : defaultIndex;

            case CONSTANTS.BEHAVIORS.RANDOM_STATE:
                const nextStates = state.randomState.map(id => this.states.findIndex(s => s.id === id)).filter(i => i > -1);
                if (nextStates.indexOf(this.previousStateIndex) > -1) {
                    nextStates.splice(nextStates.indexOf(this.previousStateIndex), 1);
                }
                return nextStates.length ? lib.randomArrayElement(nextStates) : defaultIndex;
        }

        return index;

    }

    determineFile(stateIndex, statefulVideo) {
        const state = this.states[stateIndex];
        if (this.useFiles && this.folderPath) {
            let filePath = state.file
                ? this.folderPath + "/" + state.file
                : this.baseFile;

            const baseVariation = filePath.includes("_(")
                ? filePath.split("_(")[1].split(")")[0]
                : "base";

            if (this.currentFile.includes("_[")) {
                const internalVariation = this.currentFile.split("_[")[1].split("]")[0];
                if (statefulVideo.allInternalVariations[baseVariation].has(internalVariation)) {
                    if (baseVariation === "base") {
                        filePath = filePath.replace(`.webm`, `_[${internalVariation}].webm`);
                    } else {
                        filePath = filePath.replace(`_(${baseVariation})`, `_[${internalVariation}]_(${baseVariation})`);
                    }
                }
            }

            if (this.currentFile.includes("__")) {
                const colorVariation = this.currentFile.split("__")[1].split(".")[0];
                if (statefulVideo.allColorVariations[baseVariation].has(colorVariation)) {
                    filePath = filePath.replace(".webm", `__${colorVariation}.webm`)
                }
            }

            return filePath;
        }
        if (this.currentFile.includes("__") || this.currentFile.includes("_[")) {
            return this.currentFile;
        }
        return this.baseFile;
    }

}
