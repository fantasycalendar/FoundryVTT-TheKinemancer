import CONSTANTS from "./constants.js";
import { StatefulVideo } from "./StatefulVideo.js";

export default class SocketHandler {

	static UPDATE_PLACEABLE_DOCUMENT = "update-placeable-document";
	static REPLAY_CURRENT_STATE = "replay-current-state";

	static handlers = {
		[this.UPDATE_PLACEABLE_DOCUMENT]: this._updatePlaceableDocument,
		[this.REPLAY_CURRENT_STATE]: this._replayCurrentState,
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

	static async _updatePlaceableDocument(data) {
		const { uuid, update, userId } = data;
		if (userId !== game.user.id) return;
		const placeableDocument = fromUuidSync(uuid);
		return placeableDocument.update(update);
	}

	static async _replayCurrentState(data) {
		const { uuid, userId } = data;
		if (userId !== game.user.id) return;
		const stateful = StatefulVideo.get(uuid);
		if (!stateful) return;
		stateful.replayCurrentState();
	}

}
