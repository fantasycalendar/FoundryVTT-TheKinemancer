const CONSTANTS = {
  MODULE_NAME: "the-kinemancer",

  BEHAVIORS: {
    STILL: "still",
    STILL_HIDDEN: "still-hidden",
    LOOP: "loop",
    ONCE_NEXT: "once-next",
    ONCE_PREVIOUS: "once-previous",
    ONCE_PREVIOUS_ACTIVE: "once-previous-active",
    ONCE_SPECIFIC: "once-specific"
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
  }
}

CONSTANTS.HOOKS = {
  RENDER_UI: `${CONSTANTS.MODULE_NAME}.renderUI`,
}

CONSTANTS.SOCKET_NAME = `module.${CONSTANTS.MODULE_NAME}`;
CONSTANTS.MODULE_LOCATION = `modules/${CONSTANTS.MODULE_NAME}/`;

CONSTANTS.FLAG_KEYS = {
  PREVIOUS_STATE: "previousState",
  CURRENT_STATE: "currentState",
  QUEUED_STATE: "queuedState",
  UPDATED: "updated",
  STATES: "states",
  FRAMES: "frames",
  FPS: "fps",
  DELEGATED_STATEFUL_VIDEOS: "delegatedStatefulVideos",
}

CONSTANTS.FLAGS = `flags.${CONSTANTS.MODULE_NAME}`;
CONSTANTS.PREVIOUS_STATE_FLAG = `flags.${CONSTANTS.MODULE_NAME}.${CONSTANTS.FLAG_KEYS.PREVIOUS_STATE}`;
CONSTANTS.CURRENT_STATE_FLAG = `flags.${CONSTANTS.MODULE_NAME}.${CONSTANTS.FLAG_KEYS.CURRENT_STATE}`;
CONSTANTS.QUEUED_STATE_FLAG = `flags.${CONSTANTS.MODULE_NAME}.${CONSTANTS.FLAG_KEYS.QUEUED_STATE}`;
CONSTANTS.UPDATED_FLAG = `flags.${CONSTANTS.MODULE_NAME}.${CONSTANTS.FLAG_KEYS.UPDATED}`;
CONSTANTS.STATES_FLAG = `flags.${CONSTANTS.MODULE_NAME}.${CONSTANTS.FLAG_KEYS.STATES}`;
CONSTANTS.FRAMES_FLAG = `flags.${CONSTANTS.MODULE_NAME}.${CONSTANTS.FLAG_KEYS.FRAMES}`;
CONSTANTS.FPS_FLAG = `flags.${CONSTANTS.MODULE_NAME}.${CONSTANTS.FLAG_KEYS.FPS}`;
CONSTANTS.DELEGATED_STATEFUL_VIDEOS_FLAG = `flags.${CONSTANTS.MODULE_NAME}.${CONSTANTS.FLAG_KEYS.DELEGATED_STATEFUL_VIDEOS}`;

CONSTANTS.TRANSLATED_BEHAVIORS = {
  [CONSTANTS.BEHAVIORS.STILL]: "Still",
  [CONSTANTS.BEHAVIORS.STILL_HIDDEN]: "Still (hidden)",
  [CONSTANTS.BEHAVIORS.LOOP]: "Loop",
  [CONSTANTS.BEHAVIORS.ONCE_NEXT]: "Once, then next state",
  [CONSTANTS.BEHAVIORS.ONCE_PREVIOUS]: "Once, then previous state",
  [CONSTANTS.BEHAVIORS.ONCE_PREVIOUS_ACTIVE]: "Once, then previous active state",
  [CONSTANTS.BEHAVIORS.ONCE_SPECIFIC]: "Once, then specific state",
}

CONSTANTS.BEHAVIOR_COLOR = {
  [CONSTANTS.BEHAVIORS.STILL]: "rgb(125, 125, 125)",
  [CONSTANTS.BEHAVIORS.STILL_HIDDEN]: "rgb(125, 125, 125)",
  [CONSTANTS.BEHAVIORS.LOOP]: "rgb(0,179,210)",
  [CONSTANTS.BEHAVIORS.ONCE_NEXT]: "rgb(183,32,32)",
  [CONSTANTS.BEHAVIORS.ONCE_PREVIOUS]: "rgb(183,32,32)",
  [CONSTANTS.BEHAVIORS.ONCE_PREVIOUS_ACTIVE]: "rgb(183,32,32)",
  [CONSTANTS.BEHAVIORS.ONCE_SPECIFIC]: "rgb(183,32,32)",
}

CONSTANTS.COLOR_CODE = {
  "none": "background: repeating-conic-gradient(#888 0% 25%, #333 0% 50%) 50% / 40px 40px",
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

export default CONSTANTS;
