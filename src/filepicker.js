import * as lib from "./lib/lib.js";
import CONSTANTS from "./constants.js";
import GameSettings from "./settings.js";


export default function registerFilePicker() {

    CONFIG.ux.FilePicker = KinemancerFilePicker;

    Hooks.on('renderFilePicker', filePickerHandler);

}

class KinemancerFilePicker extends foundry.applications.apps.FilePicker.implementation {

    filesWithColorVariants = {};
    filesWithInternalVariants = {};
    filesWithWebmThumbnails = {};
    webmsWithJsonData = {};
    deepSearch = "";
    filtersActive = false;
    tags = {};
    filters = {};

    static DEFAULT_OPTIONS = foundry.utils.mergeObject(foundry.applications.apps.FilePicker.DEFAULT_OPTIONS, {
        actions: {
            refreshTags: KinemancerFilePicker.refreshTags
        }
    })

    _getHeaderControls() {
        return super._getHeaderControls().concat([{
            action: "refreshTags",
            icon: "fa-solid fa-refresh",
            label: "Refresh Tags",
            visible: game.user.isGM
        }]);
    }

    async refreshTags() {
        const tags = {
            [GameSettings.SETTINGS.ASSET_TYPES]: {},
            [GameSettings.SETTINGS.TIME_PERIODS]: {},
            [GameSettings.SETTINGS.CATEGORIES]: {},
            [GameSettings.SETTINGS.TAGS]: {}
        };
        for (const [filePath, data] of Object.entries(this.webmsWithJsonData)) {
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
            await lib.updateFilters(settingsKey, values, true)
        }
        return this._render(false);
    }

    dirMatchesFilter(dir) {
        return Object.entries(this.filters).every(([settingsKey, filters]) => {
            const setting = game.settings.get(CONSTANTS.MODULE_NAME, settingsKey);
            return setting[dir] && Object.entries(filters).every(([tag, value]) => {
                const found = setting[dir].includes(tag);
                return found === value;
            });
        })
    }

    async searchDir(dir, data) {

        const results = await foundry.applications.apps.FilePicker.implementation.browse("data", `${dir}/*`, { wildcard: true });

        // Gather the main files in the pack
        let packFiles = results.files.map(decodeURIComponent).filter(file => {
            return !file.includes("__")
                && !file.includes("_(")
                && !file.includes("_[")
                && !file.includes("_thumb")
                && file.toLowerCase().endsWith(".webm")
        });

        for (const file of packFiles) {

            const fileWithoutExtension = file.split(".")[0];
            let dir = fileWithoutExtension.split("/");
            dir.pop();
            dir = dir.join("/")

            if (this.filtersActive) {
                if (!this.dirMatchesFilter(dir)) continue;
            }

            // Find the color variants
            const colorVariants = results.files.filter(variantFile => {
                return variantFile.includes("__") && variantFile.startsWith(fileWithoutExtension);
            }).map(path => {
                return lib.determineFileColor(path);
            }).sort((a, b) => {
                return a.order - b.order;
            });

            // Find the internal variants
            const internalVariants = results.files.filter(variantFile => {
                return variantFile.includes("_%5") && variantFile.startsWith(fileWithoutExtension);
            });

            if (this.deepSearch) {
                const parts = file.split("/");
                const fileName = parts.pop().split(".")[0].toLowerCase();
                const basePath = parts.join("/")

                const searchParts = this.deepSearch.split(" ").map(str => str.toLowerCase());
                const additionalValidSearchParts = this.tags[basePath]?.length
                    ? this.tags[basePath].map(str => str.toLowerCase())
                    : [];

                if (!searchParts.every(part => {
                    if (part.startsWith("color:")) {
                        const colorToFind = part.split(":")[1];
                        return colorVariants.some(color => color.colorName.includes(colorToFind))
                    }
                    return fileName.includes(part) || additionalValidSearchParts.includes(part)
                })) continue;
            }

            // Try to find the animated thumbnail webm file
            this.filesWithWebmThumbnails[file] = results.files.find(thumbWebm => {
                return thumbWebm.toLowerCase() === file.toLowerCase().replace(".webm", "_thumb.webm");
            });

            // Get the static webp thumbnail
            const thumbnail = results.files.find(thumb => {
                return thumb.toLowerCase() === file.toLowerCase().replace(".webm", "_thumb.webp");
            });

            const jsonPath = results.files.find(json => {
                return json.toLowerCase() === file.toLowerCase().replace(".webm", ".json");
            });

            if (jsonPath) {
                this.webmsWithJsonData[file] ??= await fetch(jsonPath)
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
            }

            this.filesWithColorVariants[file] = lib.uniqueArrayElements(colorVariants.map(config => config.color));
            this.filesWithInternalVariants[file] = !!internalVariants.length;

            data.files.push({
                name: file.split("/").pop(),
                img: thumbnail || "icons/svg/video.svg",
                url: file
            });

        }

        let foundResults = !!packFiles.length;

        for (const subDir of results.dirs) {
            let results = await this.searchDir(subDir, data);
            foundResults = foundResults || results;
        }

        return foundResults;

    }

    async _prepareContext(options = {}) {

        this.filesWithColorVariants = {};
        this.filesWithWebmThumbnails = {};
        this.webmsWithJsonData = {};
        this.filtersActive = false;
        this.tags = {};

        const data = await super._prepareContext(options);

        if (!data.target.startsWith(CONSTANTS.MODULE_NAME)) return data;

        this.tags = GameSettings.TAGS.get();

        this.filtersActive = !foundry.utils.isEmpty(this.filters);

        if (this.deepSearch || this.filtersActive) {
            data.files = [];
        }

        const indicesToRemove = [];

        for (const [index, dir] of foundry.utils.deepClone(data.dirs).entries()) {

            const foundMatches = await this.searchDir(dir.path, data);

            if (foundMatches) {
                indicesToRemove.push(index);
            }

        }

        indicesToRemove.reverse()
        for (const i of indicesToRemove) data.dirs.splice(i, 1);

        if (this.deepSearch || this.filtersActive) {
            data.dirs = [];
        }

        return data;
    }

    async _onRender(force = false, options = {}) {

        const result = await super._onRender(force, options);

        if (this.result.target.startsWith(CONSTANTS.MODULE_NAME)) {
            if (options.preserveSearch) {
                const searchElem = $(this.element).find('input[type="search"]');
                searchElem.trigger("focus");
                searchElem.prop("selectionStart", options.location).prop("selectionEnd", options.location);
                searchElem.val(this.deepSearch);
            }

            this.addTagRegion("Asset Types", GameSettings.SETTINGS.ASSET_TYPES);
            this.addTagRegion("Time Periods", GameSettings.SETTINGS.TIME_PERIODS);
            this.addTagRegion("Categories", GameSettings.SETTINGS.CATEGORIES);

        }

        return result;
    }

    addTagRegion(title, setting_key) {

        const tags = GameSettings.getUniqueTags(setting_key);

        if (!tags.length) return;

        const tagsParent = $(`<div class="form-group favorites kinemancer"><div class="flexrow"><span>${title}</span></div><div class="form-fields paths tags"></div></div>`);

        tags.forEach(tag => {

            const tagElem = $(`<div class="tag flexrow" style="padding:4px;"><a class="link">${tag}</a></div>`);

            const fp = this;
            const aElem = tagElem.find("a");

            tagElem.attr("class", "tag flexrow " + this.getTagClass(setting_key, tag));
            aElem.on("click", function () {
                fp.toggleFilter(setting_key, tag);
                fp.render(true);
            })
            tagsParent.find(".form-fields").append(tagElem);
        });

        tagsParent.insertAfter($(this.element).find("div.flexrow.set-favorite").parent());

    }

    toggleFilter(filterKey, tag) {
        if (this.filters[filterKey]?.[tag] === undefined) {
            if (!this.filters[filterKey]) this.filters[filterKey] = {}
            this.filters[filterKey][tag] = true;
        } else if (this.filters[filterKey]?.[tag]) {
            this.filters[filterKey][tag] = false;
        } else {
            delete this.filters[filterKey][tag];
            if (foundry.utils.isEmpty(this.filters[filterKey])) {
                delete this.filters[filterKey];
            }
        }
    }

    getTagClass(filterKey, tag) {
        if (this.filters[filterKey]?.[tag] === undefined) return "";
        if (this.filters[filterKey]?.[tag]) return "ats-tag-selected";
        return "ats-tag-deselected";
    }

    _onSearchFilter(event, query, rgx, html) {
        if (!this.result.target.startsWith(CONSTANTS.MODULE_NAME)) {
            this.deepSearch = "";
            return super._onSearchFilter(event, query, rgx, html);
        }
        if (this.deepSearch !== query) {
            this.deepSearch = query;

            const searchElem = $(this.element).find('input[type="search"]');
            const location = searchElem.prop("selectionStart");

            this.render(false, { preserveSearch: true, location });
        }
    }
}

function filePickerHandler(filePicker, html) {

    html = $(html);

    const location = html.find('input[name="target"]').val();

    if (!location.startsWith(CONSTANTS.MODULE_NAME)) return;

    html.find('ul.files-list li img').each((idx, imgElem) => {

        const img = $(imgElem);
        const parent = img.closest('[data-path]');
        const path = parent.data('path');

        if (!path.endsWith(".webm")) return;

        const width = img.attr('width');
        const height = img.attr('height');

        const webmPath = filePicker.filesWithWebmThumbnails[path] || path;
        const title = webmPath.split("/").pop().replaceAll("_", " ").replace(".webm", "").replace("thumb", "").trim();

        const video = $(`<video class="fas video-preview" loop width="${width}" height="${height}" title="${title}"></video>`);
        video.hide();
        parent.prepend(video);
        const videoElem = video.get(0);
        let playTimeout = null;

        parent.addClass('video-parent');

        const allColors = (filePicker.filesWithColorVariants[path] ?? []);
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
            }, !!videoElem.src ? 0 : 750);
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
