import CONSTANTS from "../constants.js";

export function isActiveGM(user) {
	return user.active && user.isGM;
}

export function getActiveGMs() {
	return game.users.filter(isActiveGM);
}

export function getActiveUsers() {
	return game.users.filter(user => user.active);
}

export function isResponsibleGM() {
	if (!game.user.isGM) {
		return false;
	}
	return !getResponsibleGM();
}

export function getResponsibleGM() {
	return getActiveGMs().find(other => other.id < game.user.id);
}

export function isGMConnected() {
	return !!Array.from(game.users).find(user => user.isGM && user.active);
}

export function getSceneDelegator() {

	const activeUsers = getActiveUsers().filter(user => {
		return user.viewedScene === game.user.viewedScene
	});

	activeUsers.sort((a, b) => {
		return (foundry.utils.getProperty(b, CONSTANTS.UPDATED_FLAG) ?? 0) - (foundry.utils.getProperty(a, CONSTANTS.UPDATED_FLAG) ?? 0);
	});

	activeUsers.sort((a, b) => b.isGM - a.isGM);

	return activeUsers[0];
}

export function isRealNumber(n) {
	const num = Number(n);
	return typeof num == 'number' && !isNaN(num) && isFinite(num);
}

/**
 *  Returns a floating point number between a minimum and maximum value
 *
 * @param  {number}     min                     The minimum value
 * @param  {number}     max                     The maximum value
 * @return {number}                             A random value between the range given
 */
export function randomFloatBetween(min, max) {
	const _max = Math.max(max, min);
	const _min = Math.min(max, min);
	return Math.random() * (_max - _min) + _min;
}

/**
 *  Returns an integer between a minimum and maximum value
 *
 * @param  {number}     min                     The minimum value
 * @param  {number}     max                     The maximum value
 * @return {int}                                A random integer between the range given
 */
export function randomIntegerBetween(min, max) {
	return Math.floor(randomFloatBetween(min, max));
}

export function transformNumber(num) {
	// Flip the input number
	const flippedNum = 1 - num;

	// Apply exponential transformation with base 2
	const transformedNum = 1 - Math.pow(2, -flippedNum);

	// Flip the output number
	return 1 - transformedNum;
}

export async function getWildCardFiles(inFile) {

	if (!inFile) return false;

	let source = 'data';
	const browseOptions = { wildcard: true };

	if (/\.s3\./.test(inFile)) {
		source = 's3'
		const { bucket, keyPrefix } = FilePicker.parseS3URL(inFile);
		if (bucket) {
			browseOptions.bucket = bucket;
			inFile = keyPrefix;
		}
	}

	try {
		return (await FilePicker.browse(source, inFile, browseOptions)).files;
	} catch (err) {
		return false;
	}
}

export function getVideoDuration(src) {
	return new Promise((resolve) => {
		const video = document.createElement('video');
		video.preload = 'metadata';
		video.onloadedmetadata = function () {
			resolve(video.duration);
		}
		video.src = src;
	});
}

export function validateStates(states) {

	const errors = [];

	for (const [index, state] of states.entries()) {

		if (!(isRealNumber(state.start) || Object.values(CONSTANTS.START).some(val => val === state.start))) {
			errors.push(`State "${state.name}" has an invalid value in its "start" setting`);
		}

		if (!(isRealNumber(state.end) || Object.values(CONSTANTS.END).some(val => val === state.end))) {
			if (state.behavior === CONSTANTS.BEHAVIORS.STILL || state.behavior === CONSTANTS.BEHAVIORS.STILL_HIDDEN) {
				state.end = "";
			} else {
				errors.push(`State "${state.name}" has an invalid value in its "end" setting`)
			}
		}

		switch (state.behavior) {
			case CONSTANTS.BEHAVIORS.ONCE_PREVIOUS:
				if (index === 0) {
					errors.push(`State "${state.name}" cannot have "once, previous" behavior because it is the first state`)
				}
				break;
			case CONSTANTS.BEHAVIORS.ONCE_NEXT:
				if (index === states.length - 1) {
					errors.push(`State "${state.name}" cannot have "once, next" behavior because it is the last state`)
				}
				break;
		}

		if (state.start === CONSTANTS.START.PREV) {
			const previousState = states?.[index - 1];
			if (previousState) {
				if (!isRealNumber(previousState.end)) {
					errors.push(`State "${state.name}" cannot have "prev" as its start time, because state "${previousState.name}" does not end at a specific time`)
				}
			} else {
				errors.push(`State "${state.name}" cannot have "prev" as its start time, because it is the first state`)
			}
		}

		if (state.end === CONSTANTS.END.NEXT) {
			const nextState = states?.[index + 1];
			if (nextState) {
				if (!isRealNumber(nextState.start)) {
					errors.push(`State "${state.name}" cannot have "next" as its end time, because state "${nextState.name}" does not start at a specific time`)
				}
			} else {
				errors.push(`State "${state.name}" cannot have "next" as its end time, because it is the last state`)
			}
		}
	}
	return errors;
}

export function determineFileColor(inFile) {

	const lowerCaseFile = decodeURI(inFile.toLowerCase());

	for (const [colorName, color] of Object.entries(CONSTANTS.COLOR_CODE)) {
		if (lowerCaseFile.endsWith(`__${colorName}.webm`)) {
			return { colorName, color, tooltip: CONSTANTS.COLOR_NAME[colorName] };
		}
	}

	return {
		colorName: false,
		color: CONSTANTS.COLOR_CODE["none"],
		tooltip: CONSTANTS.COLOR_NAME["none"]
	};

}

export function getThumbnailVariations(url) {
	return Object.keys(CONST.IMAGE_FILE_EXTENSIONS).map(ext => url.replace(".webm", "." + ext));
}

export function getVideoJsonPath(placeableDocument) {
	return decodeURI(placeableDocument.texture.src).split("  ")[0]
		.replace(".webm", "") + ".json";
}

export function createJsonFile(placeableDocument, inData) {
	const path = getVideoJsonPath(placeableDocument)
	const splitPath = path.split('/');
	const serializedData = JSON.stringify(inData, null, 4);
	const blob = new Blob([serializedData], { type: 'application/json' });
	const file = new File([blob], splitPath.pop());
	return FilePicker.upload("data", splitPath.join('/'), file, {}, { notify: false });
}


export function getFolder(path) {
	const folderParts = path.split("/");
	if (folderParts.length > 1) {
		folderParts.pop();
	}
	return folderParts.join("/")
}


export function bytesToSize(bytes, decimals) {
	if (bytes === 0) return '0 Bytes';
	const k = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function deltaTimeToString(deltaTime) {
	const sec_num = deltaTime / 1000; // don't forget the second param
	const hours = Math.floor(sec_num / 3600);
	const minutes = Math.floor((sec_num - (hours * 3600)) / 60);
	const seconds = Math.floor(sec_num - (hours * 3600) - (minutes * 60));
	const milliseconds = Math.floor(deltaTime);

	let string = "";
	if (hours) {
		string += `${hours}h`
	}
	if (minutes) {
		if (string.length) string += " ";
		string += `${minutes}m`
	}
	if (seconds) {
		if (string.length) string += " ";
		string += `${seconds}s`
	} else if (!hours && !minutes) {
		string += `${milliseconds}ms`
	}
	return string;
}

export function wait(ms = 150) {
	return new Promise(resolve => setTimeout(resolve, ms));
}
