<script>

	import { applyStyles } from "#runtime/svelte/action/dom";

	export let progress;
	export let text;

	let divWidth;

	$: styles = {
		"--progress-width": `${divWidth ?? 0}px`,
		"--progress": `${progress * 100}%`
	}

</script>

<div class="progress" bind:offsetWidth={divWidth} use:applyStyles={styles}>
	<div class="progress-bar">
		<div class="progress-text">{text}</div>
	</div>
	<div class="progress-text">{text}</div>
</div>

<style lang="scss">

  .progress {
    position: relative;
    height: 20px;
    width: 100%;
    border-radius: 5px;
    border: 1px solid rgb(87, 83, 78);
    background-color: rgb(41 37 36);
    overflow: hidden;
    align-items: center;

    .progress-text {
      position: absolute;
      width: var(--progress-width);
      top: 1px;
      text-align: center;
      color: white;
      font-weight: bold;
    }

    .progress-bar {
      height: 100%;
      overflow: hidden;
      position: relative;
      background-color: #00c473;
      width: var(--progress);
      z-index: 2;

      .progress-text {
        color: black;
        z-index: 1;
      }
    }
  }

</style>
