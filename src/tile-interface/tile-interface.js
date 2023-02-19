import { SvelteApplication } from '@typhonjs-fvtt/runtime/svelte/application';
import TileInterfaceShell from "./tile-interface-shell.svelte";

export default class TileInterface extends SvelteApplication {

  static registerHooks() {

    Hooks.on("getApplicationHeaderButtons", (app, buttons) => {
      if (!(app.document instanceof TileDocument)) return;
      buttons.unshift({
        label: "",
        class: "ats",
        icon: "fas fa-clapperboard",
        onclick: () => {
          TileInterface.show(app.document, { parentApp: app })
        }
      });
    });

    Hooks.on('closeTileConfig', (app) => TileInterface.closePaired(app))

  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      title: "Animated Tile State",
      svelte: {
        class: TileInterfaceShell,
        target: document.body
      },
      width: 650,
      height: "auto",
      classes: ["ats"]
    });
  }

  static getActiveApp(id) {
    return Object.values(ui.windows).find(app => {
      return app instanceof this && app.id.includes(id) && app._state > Application.RENDER_STATES.CLOSED;
    });
  }

  static async show(tileDocument, options = {}) {
    const existingApp = this.getActiveApp(tileDocument.id);
    if (existingApp) return existingApp.render(false, { focus: true });
    return new Promise((resolve) => {
      options.resolve = resolve;
      options.tileDocument = tileDocument;
      options.id = `ats-${tileDocument.id}-${randomID()}`;
      new this(options).render(true, { focus: true });
    })
  }

  static closePaired(app) {
    const tileId = app.document.id;
    const existingApp = this.getActiveApp(tileId);
    if (!existingApp || existingApp.options?.parentApp !== app) return;
    return existingApp.close();
  }

}
