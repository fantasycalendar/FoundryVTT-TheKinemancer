import * as lib from "./lib/lib.js";
import CONSTANTS from "./constants.js";


export default function registerFilePicker() {

	Hooks.on('renderFilePicker', filePickerHandler);

	class KinemancerFilePicker extends FilePicker {

		filesWithColorVariants = {};
		deepSearch = "";

		async searchDir(dir, data) {

			const results = await FilePicker.browse("data", `${dir}/*`, { wildcard: true });

			const packFiles = results.files.filter(file => {
				return !file.includes("__")
					&& file.toLowerCase().endsWith(".webm")
					&& (!this.deepSearch || file.toLowerCase().includes(this.deepSearch.toLowerCase()));
			});

			for (const file of packFiles) {

				const fileName = file.split(".")[0];

				const packColorVariantFiles = results.files.filter(variantFile => {
					return variantFile.includes("__") && variantFile.startsWith(fileName);
				});

				const thumbnail = results.files.find(thumb => {
					return thumb.toLowerCase() === file.toLowerCase().replace(".webm", "_thumb.webp");
				});

				this.filesWithColorVariants[file] = packColorVariantFiles.map(path => {
					return lib.determineFileColor(path).color;
				});

				data.files.push({
					name: file.split("/").pop(),
					img: thumbnail || "icons/svg/video.svg",
					url: file
				});

			}

			if (this.deepSearch) {
				for (const subDir of results.dirs) {
					await this.searchDir(subDir, data);
				}
			}

			return !!packFiles.length;

		}

		async getData(options = {}) {

			this.filesWithColorVariants = {};

			const data = await super.getData(options);

			if (!data.target.startsWith(CONSTANTS.MODULE_NAME)) return data;

			for (const [index, dir] of foundry.utils.deepClone(data.dirs).entries()) {

				const foundMatches = await this.searchDir(dir.path, data);

				if (foundMatches) {
					data.dirs.splice(index, 1);
				}

			}

			if (this.deepSearch) {
				data.dirs = [];
			}

			return data;
		}

		async _render(force = false, options = {}) {

			let location = 0;
			if (options.preserveSearch) {
				location = this.element
					.find('input[type="search"]')
					.prop("selectionStart");
			}

			const result = await super._render(force, options);

			if (options.preserveSearch) {
				this.element
					.find('input[type="search"]')
					.trigger("focus")
					.prop("selectionStart", location)
					.prop("selectionEnd", location);
			}

			return result;
		}

		_onSearchFilter(event, query, rgx, html) {
			if (!this.result.target.startsWith(CONSTANTS.MODULE_NAME)) {
				this.deepSearch = "";
				return super._onSearchFilter(event, query, rgx, html);
			}
			if (query !== this.deepSearch) {
				this.deepSearch = query;
				this.render(true, { preserveSearch: true });
			}
		}
	}


	FilePicker = KinemancerFilePicker;

}

export function filePickerHandler(filePicker, html) {

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

		for (const [index, color] of (filePicker.filesWithColorVariants[path] ?? []).entries()) {
			parent.append($(`<div class="ats-color-circle" style="${color} right: ${(index * 8) + 3}px;"></div>`))
		}

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
}
