import * as lib from "./lib/lib.js";
import CONSTANTS from "./constants.js";
import GameSettings from "./settings.js";
import { uniqueArrayElements } from "./lib/lib.js";


export default function registerFilePicker() {

    Hooks.on('renderFilePicker', filePickerHandler);

    FilePicker = KinemancerFilePicker;

}

class KinemancerFilePicker extends FilePicker {

    filesWithColorVariants = {};
    filesWithInternalVariants = {};
    filesWithWebmThumbnails = {};
    webmsWithJsonData = {};
    deepSearch = "";
    filtersActive = false;
    tags = {};
    filters = {};

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

        const results = await FilePicker.browse("data", `${dir}/*`, { wildcard: true });

        // Gather the main files in the pack
        const packFiles = results.files.filter(file => {
            return !file.includes("__")
                && !file.includes("_(")
                && !file.includes("_%5B")
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
                this.webmsWithJsonData[file] = await fetch(jsonPath)
                    .then(response => response.json())
                    .then((result) => {
                        const states = foundry.utils.getProperty(result, CONSTANTS.STATES_FLAG);
                        result[CONSTANTS.CURRENT_STATE_FLAG] = states.findIndex(s => s.default);
                        const currentState = states[result[CONSTANTS.CURRENT_STATE_FLAG]];
                        if (result[CONSTANTS.FOLDER_PATH_FLAG] && currentState.file) {
                            result["texture.src"] = result[CONSTANTS.FOLDER_PATH_FLAG] + "/" + currentState.file;
                        }
                        return result
                    })
                    .catch(err => {
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

        if (this.deepSearch || this.filtersActive) {
            for (const subDir of results.dirs) {
                await this.searchDir(subDir, data);
            }
        }

        return !!packFiles.length;

    }

    async getData(options = {}) {

        this.filesWithColorVariants = {};
        this.filesWithWebmThumbnails = {};
        this.webmsWithJsonData = {};
        this.filtersActive = false;
        this.tags = {};

        const data = await super.getData(options);

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

    async _render(force = false, options = {}) {

        let location = 0;
        let value = "";

        if (this.result.target.startsWith(CONSTANTS.MODULE_NAME)) {

            if (options.preserveSearch) {
                const searchElem = this.element.find('input[type="search"]');
                location = searchElem.prop("selectionStart");
                value = searchElem.val();
            }

        }

        const result = await super._render(force, options);

        if (this.result.target.startsWith(CONSTANTS.MODULE_NAME)) {
            if (options.preserveSearch) {
                const searchElem = this.element.find('input[type="search"]');
                searchElem.trigger("focus");
                searchElem.prop("selectionStart", location).prop("selectionEnd", location);
                searchElem.val(value);
            }

            this.addTagRegion("Asset Types", GameSettings.SETTINGS.ASSET_TYPES);
            this.addTagRegion("Time Periods", GameSettings.SETTINGS.TIME_PERIODS);
            this.addTagRegion("Categories", GameSettings.SETTINGS.CATEGORIES);

            this.position.height = null;
            this.element.css({ height: "" });

        }

        return result;
    }

    addTagRegion(title, setting_key) {

        const tags = GameSettings.getUniqueTags(setting_key);

        if (!tags.length) return;

        const tagsParent = $(`<div class="form-group favorites"><label><span>${title}</span></label><div class="form-fields paths tags"></div></div>`);

        tags.forEach(tag => {

            const tagElem = $(`<span class="path tag"><a class="link">${tag}</a></span>`);

            const fp = this;
            const aElem = tagElem.find("a");

            tagElem.attr("class", "path tag " + this.getTagClass(setting_key, tag));
            aElem.on("click", function () {
                fp.toggleFilter(setting_key, tag);
                fp.render(true);
            })
            tagsParent.find(".form-fields").append(tagElem);
        });

        tagsParent.insertBefore(this.element.find("div.form-fields.display-modes").parent());

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
            this.render(true, { preserveSearch: true });
        }
    }

    _onDragStart(event) {
        super._onDragStart(event);
        if (!this.result.target.startsWith(CONSTANTS.MODULE_NAME)) return;
        const li = event.currentTarget;
        const jsonData = this.webmsWithJsonData[li.dataset.path];
        if (!jsonData) return;
        const eventBaseData = JSON.parse(event.dataTransfer.getData("text/plain"));
        const newData = foundry.utils.mergeObject(eventBaseData, jsonData);
        event.dataTransfer.setData("text/plain", JSON.stringify(newData));
    }
}

function filePickerHandler(filePicker, html) {

    html.find('ol:not(.details-list) li img').each((idx, imgElem) => {

        const img = $(imgElem);
        const parent = img.closest('[data-path]');
        const path = parent.data('path');

        if (!path.startsWith(CONSTANTS.MODULE_NAME) || !path.endsWith(".webm")) return;

        const width = img.attr('width');
        const height = img.attr('height');

        const video = $(`<video class="fas video-preview" loop width="${width}" height="${height}"></video>`);
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

        const webmPath = filePicker.filesWithWebmThumbnails[path] || path;

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
