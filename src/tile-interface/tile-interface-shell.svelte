<script>

  import { ApplicationShell } from "@typhonjs-fvtt/runtime/svelte/component/core";
  import { localize } from '@typhonjs-fvtt/runtime/svelte/helper';
  import { getContext } from "svelte";
  import CONSTANTS from "../constants.js";
  import StateList from "./StateList.svelte";
  import { get, writable } from "svelte/store";
  import FilePicker from "./FilePicker.svelte";
  import Toggle from "svelte-toggle";
  import { isRealNumber } from "../lib/lib.js";

  export let elementRoot;

  const { application } = getContext("external")

  const tileDocument = application.options.tileDocument;

  let image = foundry.utils.deepClone(getProperty(tileDocument, CONSTANTS.SOURCE_FLAG) ?? "");
  let frames = foundry.utils.deepClone(getProperty(tileDocument, CONSTANTS.FRAMES_FLAG) ?? false);
  let fps = foundry.utils.deepClone(getProperty(tileDocument, CONSTANTS.FPS_FLAG) ?? 25);
  const statesStore = writable(foundry.utils.deepClone(getProperty(tileDocument, CONSTANTS.STATES_FLAG) ?? []));
  let errorsStore = writable([]);

  let form;

  function requestSubmit() {
    form.requestSubmit();
  }

  function updateStates() {
    const states = get(statesStore);
    const errors = [];
    for (const state of states) {
      if (!(isRealNumber(state.start) || Object.values(CONSTANTS.START).some(val => val === state.start))) {
        if (state.behavior === CONSTANTS.BEHAVIORS.STILL) {
          state.start = "";
        } else {
          errors.push(`State "${state.name}" has an invalid value in its "start" setting!`)
        }
      }
      if (!(isRealNumber(state.end) || Object.values(CONSTANTS.END).some(val => val === state.end))) {
        if (state.behavior === CONSTANTS.BEHAVIORS.STILL) {
          state.end = "";
        } else {
          errors.push(`State "${state.name}" has an invalid value in its "end" setting!`)
        }
      }
    }
    errorsStore.set(errors);
    if (errors.length) {
      return false;
    }
    tileDocument.update({
      [CONSTANTS.STATES_FLAG]: states,
      [CONSTANTS.FRAMES_FLAG]: frames,
      [CONSTANTS.SOURCE_FLAG]: image,
      [CONSTANTS.FPS_FLAG]: fps,
      [CONSTANTS.CURRENT_STATE_FLAG]: Math.min(getProperty(tileDocument, CONSTANTS.CURRENT_STATE_FLAG), states.length - 1),
      [CONSTANTS.UPDATED_FLAG]: Number(Date.now())
    });
    return true;
  }

  function updateClose() {
    if (!updateStates()) return false;
    closeApp();
  }

  function closeApp() {
    application.close();
  }

</script>

<svelte:options accessors={true}/>

<ApplicationShell bind:elementRoot>

	<form autocomplete=off bind:this={form} class="ats-config" on:submit|preventDefault={updateClose}>

		<div style="display: flex; gap: 1rem;">

			<div>

				<p>Here you can add a wild-card path that will add an additional button below the tile controls to quickly
					switch between similar assets:</p>

				<FilePicker bind:value={image} preferredFolder={tileDocument.texture.src}/>

			</div>

			<div style="display: flex; align-items: center">

				<div style="min-width: 125px; margin-right:1rem;">
					<Toggle
						bind:toggled={frames}
						label="Milliseconds or Frames"
						off="Milliseconds"
						on="Frames"
					/>
				</div>

				<div style="width: 40px;">
					<label
						style="flex: 1 0 auto; margin-right: 0.5rem; display: block; margin-bottom: 0.25rem; font-size: 0.75rem;">FPS</label>
					<input style="flex: 0 1 auto;" type="number" disabled={!frames} bind:value={fps}/>
				</div>


			</div>

		</div>

		<div class="ats-divider"></div>

		<StateList bind:items={$statesStore} errors={$errorsStore}/>

		<footer>
			<button on:click|once={requestSubmit} type="button">
				<i class="far fa-save"></i> Save & Close
			</button>
			<button on:click={updateStates} type="button">
				<i class="far fa-save"></i> Save
			</button>
			<button on:click|once={() => { application.close(); }} type="button">
				<i class="far fa-times"></i> { localize("Cancel") }
			</button>
		</footer>

	</form>

</ApplicationShell>
