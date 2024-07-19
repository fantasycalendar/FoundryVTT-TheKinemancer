<script>

	import { ApplicationShell } from "#runtime/svelte/component/core";
	import ProgressBarStore from "../../lib/ProgressBarStore.js"
	import ProgressBar from "../components/ProgressBar.svelte";
	import Downloader from "../../lib/downloader.js";
	import { writable } from "svelte/store";

	export let elementRoot;

	let step = 1;

	const url = writable("");
	const downloadedPaths = writable([]);

	const downloading = Downloader.downloading;
	const failed = Downloader.failed;
	const totalSize = Downloader.totalSize;

	const progress = ProgressBarStore.percentStore;
	const text = ProgressBarStore.textStore;
	ProgressBarStore.text = "";

	$: if ($downloading) step = 2;

	async function downloadPack() {
		Downloader.downloadPack($url.trim())
			.then(async (result) => {
				if (result) {
					step = 3;
					downloadedPaths.set(Array.from(new Set(result.filesToCreate.map(file => file.path))));
				}
			});
	}

	function reset() {
		url.set("");
		step = 1;
	}

	function openFile(path) {
		const newPath = path.split("/");
		newPath.pop();
		new FilePicker({
			type: "imagevideo",
			current: newPath.join("/"),
			displayMode: "tiles"
		}).render(true);
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
					<button type="button" on:click={downloadPack} disabled="{!$url}">Download</button>
				</div>
			</div>

		{/if}

		{#if step === 2 && !$failed}

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

		{#if step === 2 && $failed}

			<h1>Failed to download pack!</h1>

			<div class="release-metadata">
				<div>Download ZIP Size:</div>
				<div>{$totalSize}</div>
			</div>

			<ProgressBar progress={$progress} text={$text} textColor="white" backgroundColor="#9b0a0d"/>

			<button type="button" class="download-again-button" on:click={reset}>Download another pack</button>

		{/if}

		{#if step === 3}

			<h1>Pack downloaded!</h1>

			<div class="release-metadata">
				<div>Downloaded ZIP Size:</div>
				<div>{$totalSize}</div>
			</div>

			<details>
				<summary>Click to show all downloaded files</summary>
				<ul>
					{#each $downloadedPaths as path}
						<li><a on:click={() => openFile(path)}>{path}</a></li>
					{/each}
				</ul>
			</details>

			<ProgressBar progress={$progress} text={$text}/>

			<button type="button" class="download-again-button" on:click={reset}>Download another pack</button>

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

  details {
    margin-bottom: 0.5rem;

    ul {
      max-height: 250px;
      overflow: auto;

      a {
        color: var(--color-text-hyperlink);
      }
    }
  }

  footer {
    display: flex;
  }

</style>
