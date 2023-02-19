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
  return typeof n == 'number' && !isNaN(n) && isFinite(n);
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
