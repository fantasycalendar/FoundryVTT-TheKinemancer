const CONSTANTS = {
	MODULE_NAME: "the-kinemancer",

	BEHAVIORS: {
		STILL: "still",
		STILL_HIDDEN: "still-hidden",
		LOOP: "loop",
		ONCE_NEXT: "once-next",
		ONCE_STILL: "once-still",
		ONCE_PREVIOUS: "once-previous",
		ONCE_PREVIOUS_ACTIVE: "once-previous-active",
		ONCE_SPECIFIC: "once-specific",
		ONCE_FILE: "once-file",
		RANDOM: "random",
		RANDOM_IF: "random-if"
	},
	START: {
		START: "start",
		MID: "mid",
		PREV: "prev",
		END: "end"
	},
	END: {
		NEXT: "next",
		MID: "mid",
		END: "end"
	},
	NUMBER_TYPES: {
		FRAMES: "frames",
		MILLISECONDS: "milliseconds",
		SECONDS: "seconds"
	}
}

CONSTANTS.HOOKS = {
	RENDER_UI: `${CONSTANTS.MODULE_NAME}.renderUI`,
}

CONSTANTS.SOCKET_NAME = `module.${CONSTANTS.MODULE_NAME}`;
CONSTANTS.MODULE_LOCATION = `modules/${CONSTANTS.MODULE_NAME}/`;

CONSTANTS.FLAG_KEYS = {
	BASE_FILE: "baseFile",
	FOLDER_PATH: "folderPath",
	USE_FILES: "useFiles",
	PREVIOUS_STATE: "previousState",
	CURRENT_STATE: "currentState",
	QUEUED_STATE: "queuedState",
	UPDATED: "updated",
	STATES: "states",
	NUMBER_TYPE: "numberType",
	FPS: "fps",
	DELEGATED_STATEFUL_VIDEOS: "delegatedStatefulVideos",
}

CONSTANTS.STATE_FLAGS = {
	id: null,
	name: null,
	icon: "",
	file: "",
	default: false,
	start: 0,
	end: "",
	behavior: CONSTANTS.BEHAVIORS.STILL,
	nextState: null,
	randomState: null,
	randomStart: null,
	randomEnd: null
}

CONSTANTS.FLAGS = `flags.${CONSTANTS.MODULE_NAME}`;
CONSTANTS.BASE_FILE_FLAG = `flags.${CONSTANTS.MODULE_NAME}.${CONSTANTS.FLAG_KEYS.BASE_FILE}`;
CONSTANTS.FOLDER_PATH_FLAG = `flags.${CONSTANTS.MODULE_NAME}.${CONSTANTS.FLAG_KEYS.FOLDER_PATH}`;
CONSTANTS.USE_FILES_FLAG = `flags.${CONSTANTS.MODULE_NAME}.${CONSTANTS.FLAG_KEYS.USE_FILES}`;
CONSTANTS.PREVIOUS_STATE_FLAG = `flags.${CONSTANTS.MODULE_NAME}.${CONSTANTS.FLAG_KEYS.PREVIOUS_STATE}`;
CONSTANTS.CURRENT_STATE_FLAG = `flags.${CONSTANTS.MODULE_NAME}.${CONSTANTS.FLAG_KEYS.CURRENT_STATE}`;
CONSTANTS.QUEUED_STATE_FLAG = `flags.${CONSTANTS.MODULE_NAME}.${CONSTANTS.FLAG_KEYS.QUEUED_STATE}`;
CONSTANTS.UPDATED_FLAG = `flags.${CONSTANTS.MODULE_NAME}.${CONSTANTS.FLAG_KEYS.UPDATED}`;
CONSTANTS.STATES_FLAG = `flags.${CONSTANTS.MODULE_NAME}.${CONSTANTS.FLAG_KEYS.STATES}`;
CONSTANTS.NUMBER_TYPE_FLAG = `flags.${CONSTANTS.MODULE_NAME}.${CONSTANTS.FLAG_KEYS.NUMBER_TYPE}`;
CONSTANTS.FPS_FLAG = `flags.${CONSTANTS.MODULE_NAME}.${CONSTANTS.FLAG_KEYS.FPS}`;
CONSTANTS.DELEGATED_STATEFUL_VIDEOS_FLAG = `flags.${CONSTANTS.MODULE_NAME}.${CONSTANTS.FLAG_KEYS.DELEGATED_STATEFUL_VIDEOS}`;

CONSTANTS.TRANSLATED_BEHAVIORS = {
	[CONSTANTS.BEHAVIORS.STILL]: "Still",
	[CONSTANTS.BEHAVIORS.STILL_HIDDEN]: "Still (hidden)",
	[CONSTANTS.BEHAVIORS.LOOP]: "Loop",
	[CONSTANTS.BEHAVIORS.ONCE_STILL]: "Once",
	[CONSTANTS.BEHAVIORS.ONCE_NEXT]: "Once, then next state",
	[CONSTANTS.BEHAVIORS.ONCE_PREVIOUS]: "Once, then previous state",
	[CONSTANTS.BEHAVIORS.ONCE_PREVIOUS_ACTIVE]: "Once, then previous active state",
	[CONSTANTS.BEHAVIORS.ONCE_SPECIFIC]: "Once, then specific state",
	[CONSTANTS.BEHAVIORS.RANDOM]: "Random",
	[CONSTANTS.BEHAVIORS.RANDOM_IF]: "Random if",
}

CONSTANTS.BEHAVIOR_COLOR = {
	[CONSTANTS.BEHAVIORS.STILL]: "rgb(125, 125, 125)",
	[CONSTANTS.BEHAVIORS.STILL_HIDDEN]: "rgb(125, 125, 125)",
	[CONSTANTS.BEHAVIORS.LOOP]: "rgb(0,179,210)",
	[CONSTANTS.BEHAVIORS.ONCE_NEXT]: "rgb(183,32,32)",
	[CONSTANTS.BEHAVIORS.ONCE_PREVIOUS]: "rgb(183,32,32)",
	[CONSTANTS.BEHAVIORS.ONCE_PREVIOUS_ACTIVE]: "rgb(183,32,32)",
	[CONSTANTS.BEHAVIORS.ONCE_SPECIFIC]: "rgb(183,32,32)",
	[CONSTANTS.BEHAVIORS.ONCE_STILL]: "rgb(183,32,32)",
	[CONSTANTS.BEHAVIORS.RANDOM]: "rgb(166,70,234)",
	[CONSTANTS.BEHAVIORS.RANDOM_IF]: "rgb(166,70,234)",
}

CONSTANTS.COLOR_CODE = {
	"none": "background: repeating-conic-gradient(#888 0% 25%, #333 0% 50%) 50% / 40px 40px;",
	"night": "background: url('modules/the-kinemancer/assets/color-night.svg');",
	"day": "background: url('modules/the-kinemancer/assets/color-day.svg');",
	"spring": "background: url('modules/the-kinemancer/assets/color-spring.svg');",
	"summer": "background: url('modules/the-kinemancer/assets/color-summer.svg');",
	"autumn": "background: url('modules/the-kinemancer/assets/color-autumn.svg');",
	"winter": "background: url('modules/the-kinemancer/assets/color-winter.svg');",
	"frozen": "background: url('modules/the-kinemancer/assets/color-winter.svg');",
	"cold": "background: url('modules/the-kinemancer/assets/color-winter.svg');",
	"fireflies": "background: url('modules/the-kinemancer/assets/color-fireflies.svg');",
	"blood": "background: url('modules/the-kinemancer/assets/color-massacre.svg');",
	"wounded": "background: url('modules/the-kinemancer/assets/color-massacre.svg');",
	"massacre": "background: url('modules/the-kinemancer/assets/color-massacre.svg');",
	"fae": "background: url('modules/the-kinemancer/assets/color-fae.svg');",
	"fire": "background: url('modules/the-kinemancer/assets/color-fire.svg');",
	"burning": "background: url('modules/the-kinemancer/assets/color-fire.svg');",
	"damaged": "background: url('modules/the-kinemancer/assets/color-damaged.svg');",
	"old": "background: url('modules/the-kinemancer/assets/color-damaged.svg');",
	"cracked": "background: url('modules/the-kinemancer/assets/color-damaged.svg');",
	"rusty": "background: url('modules/the-kinemancer/assets/color-rusty.svg');",
	"dirty": "background: url('modules/the-kinemancer/assets/color-dirty.svg');",
	"blue": "background-color: #0085fa;",
	"blue dark": "background-color: #0037fa;",
	"blue light": "background-color: #1ad7ff;",
	"brown": "background-color: #a2633f;",
	"brown dark": "background-color: #68422c;",
	"brown light": "background-color: #c8a384;",
	"green": "background-color: #12ff05;",
	"green dark": "background-color: #00944b;",
	"green light": "background-color: #86ff6b;",
	"green yellow": "background-color: #bbff0f;",
	"grey": "background-color: #7d7d7d;",
	"grey dark": "background-color: #4f4f4f;",
	"grey light": "background-color: #c2c2c2;",
	"pink": "background-color: #ff57f4;",
	"pink dark": "background-color: #bd00a8;",
	"pink light": "background-color: #ffb3fa;",
	"purple": "background-color: #cf57ff;",
	"purple dark": "background-color: #8a00c2;",
	"purple light": "background-color: #e9b3ff;",
	"orange": "background-color: #ff9a00;",
	"orange dark": "background-color: #db6000;",
	"orange light": "background-color: #ffc46b;",
	"red": "background-color: #ff4c47;",
	"red dark": "background-color: #c70500;",
	"red light": "background-color: #ff8d8a;",
	"yellow": "background-color: #fff633;",
	"yellow dark": "background-color: #e6db00;",
	"yellow light": "background-color: #fffa8a;",
	"gold": "background-color: #d4af37;",
	"white": "background-color: #ffffff;",
	"black": "background-color: #000000;",
	"dark": "background-color: #303030;",
	"light": "background-color: #ededed;",
	"multicolor": `background: linear-gradient(
      90deg,
      rgba(255, 0, 0, 1) 0%,
      rgba(255, 154, 0, 1) 10%,
      rgba(208, 222, 33, 1) 20%,
      rgba(79, 220, 74, 1) 30%,
      rgba(63, 218, 216, 1) 40%,
      rgba(47, 201, 226, 1) 50%,
      rgba(28, 127, 238, 1) 60%,
      rgba(95, 21, 242, 1) 70%,
      rgba(186, 12, 248, 1) 80%,
      rgba(251, 7, 217, 1) 90%,
      rgba(255, 0, 0, 1) 100%
  );`,
}

CONSTANTS.COLOR_NAME = {
	"none": "Default",
	"night": "Night",
	"day": "Day",
	"spring": "Spring",
	"summer": "Summer",
	"autumn": "Autumn",
	"winter": "Winter",
	"frozen": "Frozen",
	"cold": "Cold",
	"fireflies": "Fireflies",
	"blood": "Blood",
	"wounded": "Wounded",
	"massacre": "Massacre",
	"fae": "Fae",
	"fire": "Fire",
	"burning": "Burning",
	"damaged": "Damaged",
	"old": "Old",
	"cracked": "Cracked",
	"rusty": "Rusty",
	"dirty": "Dirty",
	"blue": "Blue",
	"blue dark": "Dark Blue",
	"blue light": "Light Blue",
	"brown": "Brown",
	"brown dark": "Dark Brown",
	"brown light": "Light Brown",
	"green": "Green",
	"green dark": "Dark Green",
	"green light": "Light Green",
	"green yellow": "Yellow Green",
	"grey": "Grey",
	"grey dark": "Dark Grey",
	"grey light": "Light Grey",
	"pink": "Pink",
	"pink dark": "Dark Pink",
	"pink light": "Light Pink",
	"purple": "Purple",
	"purple dark": "Dark Purple",
	"purple light": "Light Purple",
	"orange": "Orange",
	"orange dark": "Dark Orange",
	"orange light": "Light Orange",
	"red": "Red",
	"red dark": "Dark Red",
	"red light": "Light Red",
	"yellow": "Yellow",
	"yellow dark": "Dark Yellow",
	"yellow light": "Light Yellow",
	"gold": "Gold",
	"white": "White",
	"black": "Black",
	"dark": "Dark",
	"light": "Light",
	"multicolor": "Multicolor",
}

export default CONSTANTS;
