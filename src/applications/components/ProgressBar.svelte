<script>

	import { applyStyles } from "#runtime/svelte/action/dom";

	export let progress;
	export let text;
	export let backgroundColor = "var(--the-kinemancer-color)";
	export let textColor = "inherit";

	let divWidth;

	$: styles = {
		"--progress-width": `${divWidth ?? 0}px`,
		"--progress": `${progress * 100}%`,
		"color": textColor
	}

</script>

<div class="progress" bind:offsetWidth={divWidth} use:applyStyles={styles}>
	<div class="progress-bar" style="background-color: {backgroundColor};">
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
      font-weight: bold;
      z-index: 1;
    }

    .progress-bar {
      height: 100%;
      overflow: hidden;
      position: relative;
      width: var(--progress);
      z-index: 2;
    }
  }

</style>
