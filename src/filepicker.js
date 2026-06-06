import * as lib from "./lib/lib.js";
import CONSTANTS from "./constants.js";
import GameSettings from "./settings.js";
import { isV12, getFilePicker, registerFilePickerOverride } from "./compat/index.js";


const BROWSE_CACHE_TTL_MS = 5 * 60 * 1000;
const SEARCH_DEBOUNCE_MS = 200;

const browseCache = new Map();
const jsonDataCache = new Map();
const colorVariantsCache = new Map();
const webmThumbnailsCache = new Map();

function cacheGet(map, key) {
    const entry = map.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
        map.delete(key);
        return undefined;
    }
    return entry.value;
}

function cacheSet(map, key, value) {
    map.set(key, { value, expiresAt: Date.now() + BROWSE_CACHE_TTL_MS });
    return value;
}

function invalidateBrowseCache() {
    browseCache.clear();
    jsonDataCache.clear();
    colorVariantsCache.clear();
    webmThumbnailsCache.clear();
}


// Shared picker helpers

function dirMatchesFilterFn(filters, dir) {
    return Object.entries(filters).every(([settingsKey, tagFilters]) => {
        const setting = game.settings.get(CONSTANTS.MODULE_NAME, settingsKey);
        return setting[dir] && Object.entries(tagFilters).every(([tag, value]) => {
            const found = setting[dir].includes(tag);
            return found === value;
        });
    });
}

function toggleFilterFn(filters, filterKey, tag, direction = 1) {
    const current = filters[filterKey]?.[tag];
    let next;
    if (direction === 1) {
        if (current === undefined) next = true;
        else if (current === true) next = false;
        else next = undefined;
    } else {
        if (current === undefined) next = false;
        else if (current === false) next = true;
        else next = undefined;
    }

    if (next === undefined) {
        if (filters[filterKey]) {
            delete filters[filterKey][tag];
            if (foundry.utils.isEmpty(filters[filterKey])) {
                delete filters[filterKey];
            }
        }
        return;
    }

    if (!filters[filterKey]) filters[filterKey] = {};
    filters[filterKey][tag] = next;
}

function getTagClassFn(filters, filterKey, tag) {
    if (filters[filterKey]?.[tag] === undefined) return "";
    if (filters[filterKey]?.[tag]) return "ats-tag-selected";
    return "ats-tag-deselected";
}

async function processFileFn(file, data, results, picker) {

    const fileWithoutExtension = file.split(".")[0];
    let dir = fileWithoutExtension.split("/");
    dir.pop();
    dir = dir.join("/")

    if (picker.filtersActive) {
        if (!dirMatchesFilterFn(picker.filters, dir)) {
            return false;
        }
    }


    const colorVariants = results.files.filter(variantFile => {
        return variantFile.includes("__") && variantFile.startsWith(fileWithoutExtension);
    }).map(path => {
        return lib.determineFileColor(path);
    }).sort((a, b) => {
        return a.order - b.order;
    });
    cacheSet(colorVariantsCache, file, lib.uniqueArrayElements(colorVariants.map(config => config.color)));

    if (picker.deepSearch) {
        const parts = file.split("/");
        const fileName = parts.pop().split(".")[0].toLowerCase();
        const basePath = parts.join("/")

        const searchParts = picker.deepSearch.split(" ").map(str => str.toLowerCase());
        const additionalValidSearchParts = picker.tags[basePath]?.length
            ? picker.tags[basePath].map(str => str.toLowerCase())
            : [];

        if (!searchParts.every(part => {
            if (part.startsWith("color:")) {
                const colorToFind = part.split(":")[1];
                return colorVariants.some(color => color.colorName.includes(colorToFind))
            }
            return fileName.includes(part) || additionalValidSearchParts.includes(part)
        })) {
            return false;
        }
    }

    // Try to find the animated thumbnail webm file
    let webmThumb = cacheGet(webmThumbnailsCache, file);
    if (webmThumb === undefined) {
        webmThumb = results.files.find(thumbWebm => {
            return thumbWebm.toLowerCase() === file.toLowerCase().replace(".webm", "_thumb.webm");
        }) ?? null;
        cacheSet(webmThumbnailsCache, file, webmThumb);
    }

    // Get the static webp thumbnail
    const thumbnail = results.files.find(thumb => {
        return thumb.toLowerCase() === file.toLowerCase().replace(".webm", "_thumb.webp");
    });

    const jsonPath = results.files.find(json => {
        return json.toLowerCase() === file.toLowerCase().replace(".webm", ".json");
    });

    if (jsonPath && !cacheGet(jsonDataCache, jsonPath)) {
        const fetched = await fetch(jsonPath)
            .then(response => response.json())
            .then((result) => {
                result = foundry.utils.mergeObject(result, {});
                const states = foundry.utils.getProperty(result, CONSTANTS.STATES_FLAG);
                result[CONSTANTS.CURRENT_STATE_FLAG] = states.findIndex(s => s.default);
                const currentState = states[result[CONSTANTS.CURRENT_STATE_FLAG]];
                if (result[CONSTANTS.FOLDER_PATH_FLAG] && currentState.file) {
                    result["texture.src"] = result[CONSTANTS.FOLDER_PATH_FLAG] + "/" + currentState.file;
                }
                return result
            })
            .catch(err => {
                console.log(err);
            });
        if (fetched) cacheSet(jsonDataCache, jsonPath, fetched);
    }

    data.files.push({
        name: file.split("/").pop(),
        img: thumbnail || "icons/svg/video.svg",
        icon: "fa-solid fa-file-video",
        url: file
    });
}

async function searchDirFn(dir, data, picker) {

    let results = cacheGet(browseCache, dir);
    if (!results) {
        results = await getFilePicker().browse("data", `${dir}/*`, { wildcard: true });
        cacheSet(browseCache, dir, results);
    }

    // Gather the main files in the pack
    let packFiles = results.files.map(decodeURIComponent).filter(file => {
        return !file.includes("__")
            && !file.includes("_(")
            && !file.includes("_[")
            && !file.includes("_thumb")
            && file.toLowerCase().endsWith(".webm")
    });

    for (const file of packFiles) {
        await processFileFn(file, data, results, picker);
    }

    let foundResults = !!packFiles.length;

    for (const subDir of results.dirs) {
        let subResults = await searchDirFn(subDir, data, picker);
        foundResults = foundResults || subResults;
    }

    return foundResults;
}

// Native picker path: data.files already populated by Foundry, just filter and reprocess.
async function processNativeContext(data, picker) {
    const mainFiles = data.files.filter(file => {
        return !file.url.includes("__")
            && !file.url.includes("_(")
            && !file.url.includes("_[")
            && !file.url.includes("_thumb")
            && file.url.toLowerCase().endsWith(".webm")
    }).map(file => file.url);
    const results = { files: data.files.map(f => f.url) }
    data.files = [];
    for (const file of mainFiles) {
        await processFileFn(file, data, results, picker);
    }
}

// Custom picker path: recurse into each directory and pull files up to the top level.
async function processCustomContext(data, picker) {
    const indicesToRemove = [];

    for (const [index, dir] of foundry.utils.deepClone(data.dirs).entries()) {

        const foundMatches = await searchDirFn(dir.path, data, picker);

        if (foundMatches) {
            indicesToRemove.push(index);
        }

    }

    indicesToRemove.reverse()
    for (const i of indicesToRemove) data.dirs.splice(i, 1);
}

function addTagRegionFn(picker, title, settingKey) {
    if (GameSettings.USE_NATIVE_FILEPICKER.get()) return;

    const tags = GameSettings.getUniqueTags(settingKey);

    if (!tags.length) return;

    const tagsParent = $(`<div class="form-group favorites kinemancer"><label>${title}</label><div class="form-fields paths tags"></div></div>`);

    tags.forEach(tag => {

        const tagElem = $(`<div class="tag flexrow"><a class="link">${tag}</a></div>`);

        const aElem = tagElem.find("a");

        tagElem.attr("class", "tag flexrow " + getTagClassFn(picker.filters, settingKey, tag));
        aElem.on("click", function () {
            toggleFilterFn(picker.filters, settingKey, tag, 1);
            picker.render(true);
        })
        aElem.on("contextmenu", function (event) {
            event.preventDefault();
            toggleFilterFn(picker.filters, settingKey, tag, -1);
            picker.render(true);
        })
        tagsParent.find(".form-fields").append(tagElem);
    });

    let element = $(picker.element).find(".favorites.kinemancer").length
        ? $(picker.element).find(".favorites.kinemancer").last()
        : $(picker.element).find("#file-picker-filter").parent().parent()

    tagsParent.insertAfter(element);

    $(picker.element).find(".window-content").css("overflow-y", "scroll");
    $(picker.element).find(".window-content").find("section").css("min-height", "351px");
}

function renderTagRegions(picker) {
    addTagRegionFn(picker, "Asset Types", GameSettings.SETTINGS.ASSET_TYPES);
    addTagRegionFn(picker, "Time Periods", GameSettings.SETTINGS.TIME_PERIODS);
    addTagRegionFn(picker, "Categories", GameSettings.SETTINGS.CATEGORIES);
}

function restoreSearchInput(picker, location) {
    const searchElem = $(picker.element).find('input[type="search"]');
    searchElem.trigger("focus");
    searchElem.prop("selectionStart", location).prop("selectionEnd", location);
    searchElem.val(picker.deepSearch);
}

async function rebuildTagSettingsFromCache() {
    const tags = {
        [GameSettings.SETTINGS.ASSET_TYPES]: {},
        [GameSettings.SETTINGS.TIME_PERIODS]: {},
        [GameSettings.SETTINGS.CATEGORIES]: {},
        [GameSettings.SETTINGS.TAGS]: {}
    };
    for (const [filePath, entry] of jsonDataCache.entries()) {
        if (Date.now() > entry.expiresAt) continue;
        const data = entry.value;
        const dirPath = lib.getFolder(filePath);
        if (foundry.utils.getProperty(data, CONSTANTS.ASSET_TYPES_FLAG)?.length) {
            tags[GameSettings.SETTINGS.ASSET_TYPES][dirPath] = foundry.utils.getProperty(data, CONSTANTS.ASSET_TYPES_FLAG);
        }
        if (foundry.utils.getProperty(data, CONSTANTS.TIME_PERIODS_FLAG)?.length) {
            tags[GameSettings.SETTINGS.TIME_PERIODS][dirPath] = foundry.utils.getProperty(data, CONSTANTS.TIME_PERIODS_FLAG);
        }
        if (foundry.utils.getProperty(data, CONSTANTS.CATEGORIES_FLAG)?.length) {
            tags[GameSettings.SETTINGS.CATEGORIES][dirPath] = foundry.utils.getProperty(data, CONSTANTS.CATEGORIES_FLAG);
        }
        if (foundry.utils.getProperty(data, CONSTANTS.TAGS_FLAG)?.length) {
            tags[GameSettings.SETTINGS.TAGS][dirPath] = foundry.utils.getProperty(data, CONSTANTS.TAGS_FLAG);
        }
    }
    for (const [settingsKey, values] of Object.entries(tags)) {
        await lib.updateFilters(settingsKey, values, true);
    }
}


export default function registerFilePicker() {

    if (isV12()) {
        patchV1FilePicker();
    } else {
        registerFilePickerOverride(buildPickerV2());
    }

    Hooks.on('renderFilePicker', filePickerHandler);
    Hooks.on(CONSTANTS.HOOKS.INVALIDATE_FILEPICKER_CACHE, invalidateBrowseCache);

}

function buildPickerV2() {

    return class KinemancerFilePickerV2 extends foundry.applications.apps.FilePicker.implementation {

        deepSearch = "";
        filtersActive = false;
        tags = {};
        filters = {};
        _searchDebounceHandle = null;

        static async _onRefreshTags() {
            invalidateBrowseCache();
            await rebuildTagSettingsFromCache();
            return this.render(true);
        }

        static DEFAULT_OPTIONS = foundry.utils.mergeObject(foundry.applications.apps.FilePicker.DEFAULT_OPTIONS, {
            actions: {
                refreshTags: this._onRefreshTags
            }
        })

        _getHeaderControls() {
            return super._getHeaderControls().concat([{
                action: "refreshTags",
                icon: "fa-solid fa-refresh",
                label: "Refresh",
                visible: game.user.isGM
            }]);
        }

        async _prepareContext(options = {}) {

            this.filtersActive = false;
            this.tags = {};

            const data = await super._prepareContext(options);

            if (!data.target.startsWith(CONSTANTS.MODULE_NAME)) return data;

            this.tags = GameSettings.TAGS.get();
            this.filtersActive = !foundry.utils.isEmpty(this.filters);

            if (this.deepSearch || this.filtersActive) {
                data.files = [];
            }

            if (GameSettings.USE_NATIVE_FILEPICKER.get()) {
                await processNativeContext(data, this);
            } else {
                await processCustomContext(data, this);
            }

            if (this.deepSearch || this.filtersActive) {
                data.dirs = [];
            }

            return data;
        }

        async _onRender(force = false, options = {}) {

            const result = await super._onRender(force, options);

            if (this.result.target.startsWith(CONSTANTS.MODULE_NAME) && !GameSettings.USE_NATIVE_FILEPICKER.get()) {
                if (options.preserveSearch) {
                    restoreSearchInput(this, options.location);
                }
                renderTagRegions(this);
            }

            return result;
        }

        _onSearchFilter(event, query, rgx, html) {
            if (!this.result.target.startsWith(CONSTANTS.MODULE_NAME) || GameSettings.USE_NATIVE_FILEPICKER.get()) {
                this.deepSearch = "";
                return super._onSearchFilter(event, query, rgx, html);
            }
            if (this.deepSearch !== query) {
                this.deepSearch = query;

                const searchElem = $(this.element).find('input[type="search"]');
                const location = searchElem.prop("selectionStart");

                clearTimeout(this._searchDebounceHandle);
                this._searchDebounceHandle = setTimeout(() => {
                    this.render(false, { preserveSearch: true, location });
                }, SEARCH_DEBOUNCE_MS);
            }
        }
    };
}


function patchV1FilePicker() {

    const originalGetHeaderButtons = FilePicker.prototype._getHeaderButtons;
    const originalGetData = FilePicker.prototype.getData;
    const originalRender = FilePicker.prototype._render;
    const originalSearchFilter = FilePicker.prototype._onSearchFilter;

    FilePicker.prototype._getHeaderButtons = function () {
        const buttons = originalGetHeaderButtons.call(this);
        if (game.user.isGM) {
            buttons.unshift({
                label: "Refresh",
                class: "kinemancer-refresh-tags",
                icon: "fa-solid fa-refresh",
                onclick: async () => {
                    invalidateBrowseCache();
                    await rebuildTagSettingsFromCache();
                    return this.render(true);
                }
            });
        }
        return buttons;
    };

    FilePicker.prototype.getData = async function (options = {}) {

        this.filters ??= {};
        this.filtersActive = false;
        this.tags = {};

        const data = await originalGetData.call(this, options);

        if (!data.target.startsWith(CONSTANTS.MODULE_NAME)) return data;

        this.tags = GameSettings.TAGS.get();
        this.filtersActive = !foundry.utils.isEmpty(this.filters);

        if (this.deepSearch || this.filtersActive) {
            data.files = [];
        }

        if (GameSettings.USE_NATIVE_FILEPICKER.get()) {
            await processNativeContext(data, this);
        } else {
            await processCustomContext(data, this);
        }

        if (this.deepSearch || this.filtersActive) {
            data.dirs = [];
        }

        return data;
    };

    FilePicker.prototype._render = async function (force = false, options = {}) {

        await originalRender.call(this, force, options);

        if (this.result.target?.startsWith(CONSTANTS.MODULE_NAME) && !GameSettings.USE_NATIVE_FILEPICKER.get()) {
            if (options.preserveSearch) {
                restoreSearchInput(this, options.location);
            }
            renderTagRegions(this);
        }
    };

    FilePicker.prototype._onSearchFilter = function (event, query, rgx, html) {
        if (!this.result.target?.startsWith(CONSTANTS.MODULE_NAME) || GameSettings.USE_NATIVE_FILEPICKER.get()) {
            this.deepSearch = "";
            return originalSearchFilter.call(this, event, query, rgx, html);
        }
        if (this.deepSearch !== query) {
            this.deepSearch = query;

            const searchElem = $(this.element).find('input[type="search"]');
            const location = searchElem.prop("selectionStart");

            clearTimeout(this._searchDebounceHandle);
            this._searchDebounceHandle = setTimeout(() => {
                this.render(false, { preserveSearch: true, location });
            }, SEARCH_DEBOUNCE_MS);
        }
    };
}

function filePickerHandler(filePicker, html) {

    html = $(html);

    const location = html.find('input[name="target"]').val();

    if (!location.startsWith(CONSTANTS.MODULE_NAME)) return;

    html.find('.files-list li img').each((idx, imgElem) => {

        const img = $(imgElem);
        const parent = img.closest('[data-path]');
        const path = parent.data('path');

        if (!path.endsWith(".webm")) return;

        const width = img.attr('width');
        const height = img.attr('height');
        const sizeAttrs = (width && height) ? `width="${width}" height="${height}"` : '';

        const webmPath = cacheGet(webmThumbnailsCache, path) || path;
        const title = webmPath.split("/").pop().replaceAll("_", " ").replace(".webm", "").replace("thumb", "").trim();

        const video = $(`<video class="fas video-preview" loop ${sizeAttrs} title="${title}"></video>`);
        video.hide();
        parent.prepend(video);
        const videoElem = video.get(0);
        let playTimeout = null;

        parent.addClass('video-parent');

        const allColors = cacheGet(colorVariantsCache, path) ?? [];
        const icons = allColors.filter(color => color.includes("url"));
        const colors = allColors.filter(color => !color.includes("url"));
        for (const [index, element] of colors.concat(icons).entries()) {
            parent.append($(`<div class="ats-color-circle" style="${element} right: ${(index * 5) + 3}px;"></div>`))
        }

        parent.on("mouseenter", () => {
            parent.find(".ats-color-circle").hide();
            if (!videoElem.src) {
                parent.addClass(' -loading');
                videoElem.addEventListener('loadeddata', () => {
                    parent.removeClass('-loading');
                }, false);
                videoElem.src = webmPath;
            }
            img.hide();
            video.show();
            playTimeout = setTimeout(() => {
                videoElem.currentTime = 0;
                videoElem.play().catch(e => console.error(e));
            }, videoElem.src ? 0 : 750);
        }).on("mouseleave", () => {
            parent.find(".ats-color-circle").show();
            clearTimeout(playTimeout);
            videoElem.pause();
            videoElem.currentTime = 0;
            video.hide();
            img.show();
        });
    });
}
