<script>

	let {
		progress,
		text,
		backgroundColor = "var(--the-kinemancer-color)",
		textColor = "inherit"
	} = $props();

	let divWidth = $state(0);

</script>

<div class="progress"
     bind:offsetWidth={divWidth}
     style:--progress-width="{divWidth ?? 0}px"
     style:--progress="{progress * 100}%"
     style:color={textColor}>
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
