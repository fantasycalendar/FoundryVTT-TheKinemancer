import { SvelteApplication } from '@typhonjs-fvtt/runtime/svelte/application';
import StatefulVideoInterfaceShell from "./stateful-video-interface-shell.svelte";
import { get } from "svelte/store";
import { copiedData } from "../StatefulVideo.js";


export class StatefulVideoInterface extends SvelteApplication {

  static registerHooks() {

    Hooks.on("getApplicationHeaderButtons", (app, buttons) => {
      if (!(app.document instanceof TileDocument || app.document instanceof TokenDocument)) return;
      buttons.unshift({
        label: "",
        class: "ats",
        icon: "the-kinemancer-icon",
        onclick: () => {
          StatefulVideoInterface.show(app.document, { parentApp: app })
        }
      });
    });

    Hooks.on('closeTileConfig', (app) => StatefulVideoInterface.closePaired(app))
    Hooks.on('closeTokenConfig', (app) => StatefulVideoInterface.closePaired(app))

  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      title: "The Kinemancer: Animated Video States",
      svelte: {
        class: StatefulVideoInterfaceShell,
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

  static async show(placeableDocument, options = {}) {
    const existingApp = this.getActiveApp(placeableDocument.id);
    if (existingApp) return existingApp.render(false, { focus: true });
    return new Promise((resolve) => {
      options.resolve = resolve;
      options.placeableDocument = placeableDocument;
      options.id = `ats-${placeableDocument.id}-${randomID()}`;
      new this(options).render(true, { focus: true });
    })
  }

  static closePaired(app) {
    const placeableDocumentId = app.document.id;
    const existingApp = this.getActiveApp(placeableDocumentId);
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
                ui.notifications.notify("The Kinemancer | Successfully imported video state data")
              } else {
                ui.notifications.error("The Kinemancer | Could not determine states in this file!")
              }
            } catch (err) {
              ui.notifications.error("The Kinemancer | Something went wrong importing this file!\n" + err);
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
        const fileName = this.options.placeableDocument.texture.src
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
          ui.notifications.notify("The Kinemancer | Pasted video state data")
        } else {
          ui.notifications.notify("The Kinemancer | You haven't copied any animated video state data!")
        }
      }
    });

    buttons.unshift({
      icon: 'fas fa-copy',
      title: "Copy",
      label: "",

      onclick: async () => {
        copiedData.set(this.svelte.applicationShell.exportData());
        ui.notifications.notify("The Kinemancer | Copied video state data")
      }
    });

    return buttons;
  }

}
