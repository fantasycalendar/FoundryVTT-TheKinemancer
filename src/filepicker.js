import * as lib from "./lib/lib.js";


export default function registerFilePicker() {

	Hooks.on('renderFilePicker', filePickerHandler);

	class KinemancerFilePicker extends FilePicker {

		filesWithColorVariants = {}

		async getData(options = {}) {

			this.filesWithColorVariants = {};

			const data = await super.getData(options);

			if (!data.target.startsWith("the-kinemancer")) return data;

			for (const [index, dir] of foundry.utils.deepClone(data.dirs).entries()) {

				const results = await FilePicker.browse("data", `${dir.path}/*.web*`, { wildcard: true });

				const packFiles = results.files.filter(file => {
					return !file.includes("__") && file.toLowerCase().endsWith(".webm");
				});
				const packColorVariantFiles = results.files.filter(file => {
					return file.includes("__");
				});

				if (packFiles.length) {

					for (const file of packFiles) {

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

					data.dirs.splice(index, 1);

				}

			}

			return data;
		}

	}

	FilePicker = KinemancerFilePicker;

}

export function filePickerHandler(filePicker, html) {

	html.find('img').each((idx, imgElem) => {

		const img = $(imgElem);
		const parent = img.closest('[data-path]');
		const path = parent.data('path');

		if (!path.startsWith("the-kinemancer") || !path.endsWith(".webm")) return;

		const width = img.attr('width');
		const height = img.attr('height');

		const video = $(`<video class="fas video-preview" loop width="${width}" height="${height}"></video>`);
		video.hide();
		parent.append(video);
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
