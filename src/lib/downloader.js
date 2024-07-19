import JSZip from "jszip";
import JSZipUtils from "jszip-utils";
import ProgressBar from "./ProgressBarStore.js";
import * as lib from "./lib.js";
import { writable } from "svelte/store";
import GameSettings from "../settings.js";

class Downloader {

	startDeltaTime = 0;
	ready = writable(false);
	downloading = writable(false);
	failed = writable(false);

	totalSize = writable("");
	loadedSize = writable("");

	async initialize() {
		this.ready.set(true);
		this.downloading.set(false);
	}

	async downloadPack(url) {
		this.startDeltaTime = performance.now();
		this.downloading.set(true);
		this.failed.set(false);
		const contents = await this.fetchZipContents(url)
		await this.createFiles(contents);
		this.downloading.set(false);
		return contents;
	}

	async fetchZipContents(zipUrl, currentZip = 0, numZips = 1) {

		const numZipsText = numZips > 1 ? ` (${currentZip} out of ${numZips})` : "";
		return new Promise((resolve, reject) => {
			JSZipUtils.getBinaryContent(zipUrl, {
					progress: (data) => {
						const loadedSize = lib.bytesToSize(data.loaded, 2);
						const totalSize = lib.bytesToSize(data.total, 2);
						this.totalSize.set(totalSize);
						this.loadedSize.set(loadedSize);
						ProgressBar.text = `Downloading ZIP (${loadedSize} / ${totalSize})${numZipsText}`;
						ProgressBar.percent = data.percent / 100;
					}
				})
				.then(async (data) => {
					const totalSize = lib.bytesToSize(data.byteLength, 2);
					ProgressBar.text = `Downloading ZIP (${totalSize} / ${totalSize})${numZipsText}`;
					ProgressBar.percent = 100;
					await lib.wait();
					return data;
				})
				.then(data => {
					return JSZip.loadAsync(data)
				})
				.then(async function (zip) {

					const dirsToCheck = Object.values(zip.files).filter(f => f.dir)

					const dirs = dirsToCheck.reduce((acc, item) => {

						let parts = item.name.split("/");
						let totalPath = [];
						for (const part of parts) {
							if (!part) continue;
							totalPath = totalPath.concat(part);
							const finalPath = totalPath.join("/")
							if (acc.indexOf(finalPath) === -1) {
								acc.push(finalPath);
							}
						}
						return acc;
					}, []).sort((a, b) => {
						return a.length - b.length;
					});

					const dirsToCreate = [];
					for (const dir of dirs) {
						try {
							await FilePicker.browse("data", dir);
						} catch (err) {
							dirsToCreate.push(dir);
						}
					}

					const filesToCheck = Object.values(zip.files).filter(f => !f.dir && zip.file(f.name));

					const filesToCreate = [];
					let tags = {};
					for (const zipFile of filesToCheck) {
						let path = zipFile.name.split("/")
						const fileName = path.pop();
						path = path.join("/")
						if (zipFile.name.endsWith("tags.json")) {
							const jsonData = await zip.file(zipFile.name).async("string");
							tags[path] = JSON.parse(jsonData);
							continue;
						}
						const fileData = zip.file(zipFile.name);
						filesToCreate.push({ path, fileName, fileData, fullPath: zipFile.name });
					}

					resolve({
						dirsToCreate,
						filesToCreate,
						tags
					});
				})
				.catch((err) => {
					ui.notifications.error("The Kinemancer | Error: Could not fetch zip file! Are you sure you entered the right link?");
					reject(err);
					console.log(err)
					this.downloading.set(false);
					this.failed.set(true);
				})
		})
	}

	async createFiles({ dirsToCreate = [], filesToCreate = [], tags = [] } = {}) {

		const newTags = GameSettings.PACK_TAGS.get();
		for (const [path, name] of Object.entries(tags)) {
			newTags[path] = name;
		}
		await GameSettings.PACK_TAGS.set(newTags);

		if (dirsToCreate.length) {

			ProgressBar.setTotal(dirsToCreate.length);
			ProgressBar.text = `CREATING DIRECTORIES (0 / ${dirsToCreate.length})`;

			for (const dirPath of dirsToCreate) {
				await FilePicker.createDirectory("data", dirPath);
				const current = ProgressBar.incrementProgress();
				ProgressBar.text = `Creating directories (${current} / ${dirsToCreate.length})`;

			}

			await lib.wait();

		}

		ProgressBar.setTotal(filesToCreate.length);
		ProgressBar.text = `Saving files (0 / ${filesToCreate.length})`;
		let currentPromise = false;
		for (const { path, fileName, fileData } of filesToCreate) {
			const binaryData = await fileData.async("uint8array");
			const file = new File([binaryData], fileName);
			if (currentPromise) await currentPromise;
			currentPromise = FilePicker.upload("data", path, file, {}, { notify: false });
			const current = ProgressBar.incrementProgress();
			ProgressBar.text = `Saving files (${current} / ${filesToCreate.length})`;
		}

		await lib.wait();

		const deltaTime = performance.now() - this.startDeltaTime;
		ProgressBar.percent = 100;
		ProgressBar.text = `Done! Downloaded ${filesToCreate.length} files, which took ${lib.deltaTimeToString(deltaTime)}.`

	}
}

export default new Downloader();