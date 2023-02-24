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
    return (getProperty(b, CONSTANTS.UPDATED_FLAG) ?? 0) - (getProperty(a, CONSTANTS.UPDATED_FLAG) ?? 0);
  });

  activeUsers.sort((a, b) => b.isGM - a.isGM);

  return activeUsers[0];
}

export function isRealNumber(n) {
  const num = Number(n);
  return typeof num == 'number' && !isNaN(num) && isFinite(num);
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
      if (state.behavior === CONSTANTS.BEHAVIORS.STILL) {
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
