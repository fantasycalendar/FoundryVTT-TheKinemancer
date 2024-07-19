import * as lib from "./lib/lib.js";
import CONSTANTS from "./constants.js";
import GameSettings from "./settings.js";


export default function registerFilePicker() {

	Hooks.on('renderFilePicker', filePickerHandler);

	FilePicker = KinemancerFilePicker;

}

class KinemancerFilePicker extends FilePicker {

	filesWithColorVariants = {};
	filesWithWebmThumbnails = {};
	tags = {};
	deepSearch = "";

	async searchDir(dir, data, validPacks) {

		const results = await FilePicker.browse("data", `${dir}/*`, { wildcard: true });

		// Gather the main files in the pack
		const packFiles = results.files.filter(file => {
			return !file.includes("__")
				&& !file.includes("_thumb")
				&& file.toLowerCase().endsWith(".webm")
		});

		for (const file of packFiles) {

			const fileWithoutExtension = file.split(".")[0];
			let dir = fileWithoutExtension.split("/");
			dir.pop();
			dir = dir.join("/")

			if (validPacks && !validPacks.has(dir)) continue;

			// Find the color variants
			const colorVariants = results.files.filter(variantFile => {
				return variantFile.includes("__") && variantFile.startsWith(fileWithoutExtension);
			}).map(path => {
				return lib.determineFileColor(path);
			});

			if (this.deepSearch) {
				const parts = file.split("/");
				const fileName = parts.pop().split(".")[0].toLowerCase();
				const searchParts = this.deepSearch.split(" ").map(str => str.toLowerCase());
				if (!searchParts.every(part => {
					if (part.startsWith("color:")) {
						return colorVariants.some(color => color.colorName.includes(part.split(":")[1]))
					}
					return fileName.includes(part)
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

			this.filesWithColorVariants[file] = colorVariants;

			data.files.push({
				name: file.split("/").pop(),
				img: thumbnail || "icons/svg/video.svg",
				url: file
			});

		}

		if (this.deepSearch || validPacks) {
			for (const subDir of results.dirs) {
				await this.searchDir(subDir, data, validPacks);
			}
		}

		return !!packFiles.length;

	}

	async getData(options = {}) {

		this.filesWithColorVariants = {};
		this.filesWithWebmThumbnails = {};

		const data = await super.getData(options);

		if (!data.target.startsWith(CONSTANTS.MODULE_NAME)) return data;

		const validPacks = foundry.utils.isEmpty(this.tags) ? false : new Set();
		const blackListed = new Set();
		if (validPacks) {
			const packTags = Object.entries(GameSettings.PACK_TAGS.get());
			Object.entries(this.tags).forEach(([tag, filter]) => {
				for (const [dir, tags] of packTags) {
					if (filter) {
						const packHasTag = tags.some(packTag => packTag === tag);
						if (!packHasTag) continue;
						if (!blackListed.has(dir)) validPacks.add(dir);
					} else {
						blackListed.add(dir);
						validPacks.delete(dir);
					}
				}
			})
		}

		if (this.deepSearch || validPacks) {
			data.files = [];
		}

		for (const [index, dir] of foundry.utils.deepClone(data.dirs).entries()) {

			const foundMatches = await this.searchDir(dir.path, data, validPacks);

			if (foundMatches) {
				data.dirs.splice(index, 1);
			}

		}

		if (this.deepSearch || validPacks) {
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

			const tags = GameSettings.getUniquePackTags();

			if (tags.length) {

				const tagsParent = $(`<div class="form-group favorites"><label><span>Tags</span></label><div class="form-fields paths tags"></div></div>`);

				tags.forEach(tag => {

					const tagElem = $(`<span class="path tag"><a class="link">${tag}</a></span>`);

					const fp = this;
					const aElem = tagElem.find("a");

					tagElem.attr("class", "path tag " + this.getTagClass(tag));
					aElem.on("click", function () {
						fp.toggleTag(tag);
						fp.render(true);
					})
					tagsParent.find(".form-fields").append(tagElem);
				});

				tagsParent.insertAfter(this.element.find("div.filter-dir"));

				this.position.height = null;
				this.element.css({ height: "" });

			}

		}

		return result;
	}

	toggleTag(tag) {
		if (this.tags[tag] === undefined) {
			this.tags[tag] = true;
		} else if (this.tags[tag]) {
			this.tags[tag] = false;
		} else {
			delete this.tags[tag];
		}
	}

	getTagClass(tag) {
		if (this.tags[tag] === undefined) return "";
		if (this.tags[tag]) return "ats-tag-selected";
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
		const icons = allColors.filter(config => config.color.includes("url"));
		const colors = allColors.filter(config => !config.color.includes("url"));
		for (const [index, config] of icons.entries()) {
			parent.append($(`<div class="ats-color-circle" style="${config.color} right: ${(index * 8) + 3}px; top: 3px;"></div>`))
		}
		for (const [index, config] of colors.entries()) {
			parent.append($(`<div class="ats-color-circle" style="${config.color} right: ${(index * 8) + 3}px;"></div>`))
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
