<script>

  import { ApplicationShell } from "@typhonjs-fvtt/runtime/svelte/component/core";
  import { localize } from '@typhonjs-fvtt/runtime/svelte/helper';
  import { getContext } from "svelte";
  import CONSTANTS from "../constants.js";
  import StateList from "./StateList.svelte";
  import { get, writable } from "svelte/store";
  import { createJsonFile, getVideoDuration, validateStates } from "../lib/lib.js";
  import { TJSDocument } from "@typhonjs-fvtt/runtime/svelte/store";

  export let elementRoot;

  const { application } = getContext("#external")

  const placeableDocument = application.options.placeableDocument;

  const doc = new TJSDocument(placeableDocument);

  let frames = foundry.utils.deepClone(getProperty(placeableDocument, CONSTANTS.FRAMES_FLAG) ?? true);
  let fps = foundry.utils.deepClone(getProperty(placeableDocument, CONSTANTS.FPS_FLAG) ?? 25);
  let statesStore = writable(foundry.utils.deepClone(getProperty(placeableDocument, CONSTANTS.STATES_FLAG) ?? [{
    id: randomID(),
    name: "New State",
    start: 0,
    end: "",
    behavior: CONSTANTS.BEHAVIORS.STILL,
    nextState: null,
    default: true
  }]));
  let errorsStore = writable([]);

  let form;

  function requestSubmit() {
    form.requestSubmit();
  }

  let isValid = true;
  const updateErrors = foundry.utils.debounce((errors) => {
    errorsStore.set(errors);
  }, 250)

  let actualDuration = null;
  getVideoDuration(placeableDocument.texture.src).then((videoDuration) => {
    actualDuration = videoDuration;
  });
  $: {
    $doc;
    const { data } = doc.updateOptions;
    const videoSrc = getProperty(data, "texture.src");
    if (videoSrc) {
      getVideoDuration(videoSrc).then((videoDuration) => {
        actualDuration = videoDuration;
      });
    }
  }

  $: duration = actualDuration * (frames ? (fps || 25) : 1000);

  $: {
    const errors = validateStates($statesStore);
    errorsStore.set([]);
    isValid = !errors.length;
    if (!isValid) {
      updateErrors(errors);
    }
  }

  function updateStates() {
    const states = get(statesStore);
    if (!isValid) {
      return false;
    }
    const data = {
      [CONSTANTS.STATES_FLAG]: states,
      [CONSTANTS.FRAMES_FLAG]: frames,
      [CONSTANTS.FPS_FLAG]: fps
    };
    placeableDocument.update({
      ...data,
      [CONSTANTS.CURRENT_STATE_FLAG]: Math.min(getProperty(placeableDocument, CONSTANTS.CURRENT_STATE_FLAG), states.length - 1),
      [CONSTANTS.UPDATED_FLAG]: Number(Date.now())
    });
    createJsonFile(placeableDocument, data);
    return true;
  }

  function updateClose() {
    if (!updateStates()) return false;
    closeApp();
  }

  function closeApp() {
    application.close();
  }

  export function exportData() {
    const states = get(statesStore);
    return {
      [CONSTANTS.STATES_FLAG]: states,
      [CONSTANTS.FRAMES_FLAG]: frames,
      [CONSTANTS.FPS_FLAG]: fps,
      [CONSTANTS.CURRENT_STATE_FLAG]: Math.min(getProperty(placeableDocument, CONSTANTS.CURRENT_STATE_FLAG), states.length - 1)
    }
  }

  export function importData(importedData) {
    const data = foundry.utils.mergeObject(importedData, {});
    const states = getProperty(data, CONSTANTS.STATES_FLAG);
    if (!states?.length) return false;
    statesStore.set(states);
    frames = getProperty(data, CONSTANTS.FRAMES_FLAG)
    fps = getProperty(data, CONSTANTS.FPS_FLAG)
    return true;
  }

</script>

<svelte:options accessors={true}/>

<ApplicationShell bind:elementRoot>

	<form autocomplete=off bind:this={form} class="ats-config" on:submit|preventDefault={updateClose}>

		<div style="display: flex; gap: 1rem;">

			<div style="display: flex; flex-direction: column; padding: 0.15rem;">

				<div style="display: flex; align-items: center; margin-bottom: 0.5rem;">

					<div style="margin-right: 0.25rem;">

						<label
							style="flex: 1 0 auto; margin-right: 0.5rem; display: block; margin-bottom: 0.25rem; font-size: 0.75rem;">
							Time Type
						</label>
						<select style="" on:change={(e) => { frames = e.target.value === "frames"}}>
							<option value="frames" selected={frames}>Frames</option>
							<option value="milliseconds" selected={!frames}>Milliseconds</option>
						</select>
					</div>

					<div style="width: 40px;">
						<label
							style="flex: 1 0 auto; margin-right: 0.5rem; display: block; margin-bottom: 0.25rem; font-size: 0.75rem;">FPS</label>
						<input style="flex: 0 1 auto;" type="number" disabled={!frames} bind:value={fps}/>
					</div>

				</div>

				<div>

					{#if duration}
						This video {frames ? "has" : "is"} <strong>{duration}</strong> {frames ? "frames" : "ms long"}
					{/if}

				</div>

			</div>

		</div>

		<div class="ats-divider"></div>

		<StateList bind:items={$statesStore} errors={$errorsStore} {duration}/>

		<footer>
			<button on:click|once={requestSubmit} disabled={!isValid} type="button">
				<i class="far fa-save"></i> Save & Close
			</button>
			<button on:click={updateStates} disabled={!isValid} type="button">
				<i class="far fa-save"></i> Save
			</button>
			<button on:click|once={() => { application.close(); }} type="button">
				<i class="far fa-times"></i> { localize("Cancel") }
			</button>
		</footer>

	</form>

</ApplicationShell>
