<script>

  import { ApplicationShell } from "@typhonjs-fvtt/runtime/svelte/component/core";
  import { localize } from '@typhonjs-fvtt/runtime/svelte/helper';
  import { getContext } from "svelte";
  import CONSTANTS from "../constants.js";
  import StateList from "./StateList.svelte";
  import { get, writable } from "svelte/store";
  import FilePicker from "./FilePicker.svelte";
  import Toggle from "svelte-toggle";
  import { getVideoDuration, validateStates } from "../lib/lib.js";
  import { TJSDocument } from "@typhonjs-fvtt/runtime/svelte/store";

  export let elementRoot;

  const { application } = getContext("#external")

  const tileDocument = application.options.tileDocument;

  const doc = new TJSDocument(tileDocument);

  let image = foundry.utils.deepClone(getProperty(tileDocument, CONSTANTS.SOURCE_FLAG) ?? "");
  let frames = foundry.utils.deepClone(getProperty(tileDocument, CONSTANTS.FRAMES_FLAG) ?? true);
  let fps = foundry.utils.deepClone(getProperty(tileDocument, CONSTANTS.FPS_FLAG) ?? 25);
  let statesStore = writable(foundry.utils.deepClone(getProperty(tileDocument, CONSTANTS.STATES_FLAG) ?? [{
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
  getVideoDuration(tileDocument.texture.src).then((videoDuration) => {
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

  $: duration = actualDuration * (frames ? 1000 / (fps || 25) : 1000)

  $: {
    const errors = validateStates($statesStore);
    isValid = !errors.length;
    if (isValid) {
      errorsStore.set([]);
    } else {
      updateErrors(errors);
    }
  }

  function updateStates() {
    const states = get(statesStore);
    if (!isValid) {
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

  export function exportData() {
    const states = get(statesStore);
    return {
      [CONSTANTS.STATES_FLAG]: states,
      [CONSTANTS.FRAMES_FLAG]: frames,
      [CONSTANTS.SOURCE_FLAG]: image,
      [CONSTANTS.FPS_FLAG]: fps,
      [CONSTANTS.CURRENT_STATE_FLAG]: Math.min(getProperty(tileDocument, CONSTANTS.CURRENT_STATE_FLAG), states.length - 1)
    }
  }

  export function importData(importedData) {
    if (!importedData?.states?.length) return false;
    statesStore.set(getProperty(importedData, CONSTANTS.STATES_FLAG));
    frames = getProperty(importedData, CONSTANTS.FRAMES_FLAG)
    image = getProperty(importedData, CONSTANTS.SOURCE_FLAG)
    fps = getProperty(importedData, CONSTANTS.FPS_FLAG)
    return true;
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

			<div style="display: flex; align-items: center; flex-direction: column;">

				<div style="display: flex; align-items: center;" class="ats-bottom-divider">

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
