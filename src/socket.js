import CONSTANTS from "./constants.js";

export default class SocketHandler {

  static UPDATE_TILE = "update-tile";

  static handlers = {
    [this.UPDATE_TILE]: this._updateTile
  }

  static initialize() {
    game.socket.on(CONSTANTS.SOCKET_NAME, (data) => {
      if (this.handlers[data.type]) {
        this.handlers[data.type](data.payload);
      }
    });
  }

  static emit(handler, data) {
    game.socket.emit(CONSTANTS.SOCKET_NAME, {
      type: handler,
      payload: data
    });
  }

  static async _updateTile(data) {
    const { uuid, update, userId } = data;
    if (userId !== game.user.id) return;
    const tileDocument = fromUuidSync(uuid);
    return tileDocument.update(update);
  }

}
