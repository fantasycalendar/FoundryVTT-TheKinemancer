import { SvelteApplication } from '@typhonjs-fvtt/runtime/svelte/application';
import TileInterfaceShell from "./tile-interface-shell.svelte";
import { get } from "svelte/store";
import { copiedData } from "../StatefulTile.js";


export class TileInterface extends SvelteApplication {

  static registerHooks() {

    Hooks.on("getApplicationHeaderButtons", (app, buttons) => {
      if (!(app.document instanceof TileDocument)) return;
      buttons.unshift({
        label: "",
        class: "ats",
        icon: "the-kinemancer-icon",
        onclick: () => {
          TileInterface.show(app.document, { parentApp: app })
        }
      });
    });

    Hooks.on('closeTileConfig', (app) => TileInterface.closePaired(app))

  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      title: "The Kinemancer: Animated Tile States",
      svelte: {
        class: TileInterfaceShell,
        target: document.body
      },
      width: 680,
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

  _getHeaderButtons() {

    const buttons = super._getHeaderButtons();

    buttons.unshift({
      icon: 'fas fa-file-import',
      title: "Import",
      label: "",

      onclick: async () => {

        const input = document.createElement('input');
        input.type = 'file';

        input.onchange = e => {
          input.remove();

          const file = e.target.files[0];

          const reader = new FileReader();
          reader.addEventListener('load', async () => {
            try {
              const stateData = JSON.parse(reader.result);
              const success = this.svelte.applicationShell.importData(stateData);
              if (success) {
                ui.notifications.notify("Animated Tile States | Successfully imported tile state data")
              } else {
                ui.notifications.error("Animated Tile States | Could not determine states in this file!")
              }
            } catch (err) {
              ui.notifications.error("Animated Tile States | Something went wrong importing this file!\n" + err);
            }
          });

          reader.readAsText(file);

        }

        input.click();
      }
    });

    buttons.unshift({
      icon: 'fas fa-file-export',
      title: "Export",
      label: "",

      onclick: async () => {
        debugger;
        const fileName = this.options.tileDocument.texture.src
          .split('/')
          .pop()
          .replace(".webm", ".json");

        saveDataToFile(
          JSON.stringify(this.svelte.applicationShell.exportData()),
          "text/json",
          fileName
        )
      }
    });

    buttons.unshift({
      icon: 'fas fa-paste',
      title: "Paste",
      label: "",

      onclick: async () => {
        if (this.svelte.applicationShell.importData(get(copiedData))) {
          ui.notifications.notify("Animated Tile States | Pasted tile state data")
        } else {
          ui.notifications.notify("Animated Tile States | You haven't copied any animated tile state data!")
        }
      }
    });

    buttons.unshift({
      icon: 'fas fa-copy',
      title: "Copy",
      label: "",

      onclick: async () => {
        copiedData.set(this.svelte.applicationShell.exportData());
        ui.notifications.notify("Animated Tile States | Copied tile state data")
      }
    });

    return buttons;
  }

}
