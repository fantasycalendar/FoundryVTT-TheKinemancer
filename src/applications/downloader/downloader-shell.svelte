<script>

	import { ApplicationShell } from "#runtime/svelte/component/core";
	import ProgressBarStore from "../../lib/ProgressBarStore.js"
	import ProgressBar from "../components/ProgressBar.svelte";
	import Downloader from "../../lib/downloader.js";
	import * as lib from "../../lib/lib.js";
	import { writable } from "svelte/store";

	export let elementRoot;

	let step = 1;
	let statusIcon = "";

	const url = writable("");

	const downloading = Downloader.downloading;
	const totalSize = Downloader.totalSize;
	const loadedSize = Downloader.loadedSize;

	const progress = ProgressBarStore.percentStore;
	const text = ProgressBarStore.textStore;
	ProgressBarStore.text = "";

	$: if ($downloading) step = 2;


	async function downloadPack() {
		statusIcon = "fa-spinner spinning"
		Downloader.downloadPack($url.trim())
			.then(async (result) => {
				console.log(result)
				if (result) {
					statusIcon = "fa-check"
					await lib.wait(1000);
				}
			}).catch(() => {
			statusIcon = "fa-times"
		});
	}

	function reset() {
		statusIcon = "";
		url.set("");
		step = 1;
	}

</script>

<svelte:options accessors={true}/>

<ApplicationShell bind:elementRoot>

	<div>

		{#if step === 1}

			<div class="form-control">
				<p style="font-size: 1rem; text-align: center; margin-bottom:0.65rem;">
					Get the download links from <a href="https://www.thekinemancer.com/patreon-top-viewer/" target="_blank">The
					Kinemancer's website</a>
				</p>
				<div>
					<input type="text" placeholder="https://www.thekinemancer.com/download/..." bind:value={$url}/>
				</div>
				<div>
					<button type="button" on:click={downloadPack}>Download</button>
				</div>
			</div>

		{/if}

		{#if step === 2}

			<h1>Downloading pack...</h1>

			<div class="release-metadata">
				<div>Download ZIP Size:</div>
				<div>{$totalSize}</div>
			</div>

			<ProgressBar progress={$progress} text={$text}/>

			{#if !$downloading}
				<button type="button" class="download-again-button" on:click={reset}>Download another pack</button>
			{/if}

		{/if}

	</div>

</ApplicationShell>

<style lang="scss">

  button:disabled {
    cursor: not-allowed;
  }

  button {
    margin-top: 0.65rem;
  }

  .release-description {
    border: 1px solid rgba(0, 0, 0, 0.5);
    border-radius: 5px;
    padding: 0.5rem;
    margin: 0.5rem 0;
  }

  .release-metadata {
    display: grid;
    grid-template-columns: auto 1fr;
    column-gap: 10px;
    row-gap: 0.25rem;
    margin: 0.5rem 0;
  }

  .form-control {
    > div {
      display: flex;
      align-items: center;

      > div {
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 5px;
        text-align: center;
        min-height: 26px;
        min-width: 26px;
        font-size: 1.2rem;
        margin-left: 0.25rem;
      }
    }
  }

  footer {
    display: flex;
  }

  .spinning {
    animation-name: spin;
    animation-duration: 1000ms;
    animation-iteration-count: infinite;
    animation-timing-function: linear;
  }

  .valid {
    background: green;
    color: white;
    border: 1px solid #193a09;
  }

  .invalid {
    background: #9b0a0d;
    color: white;
    border: 1px solid #3a0909;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

</style>
