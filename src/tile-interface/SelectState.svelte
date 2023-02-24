<script>

  export let text = "";
  export let color = false;
  export let primary = false;

</script>

<div class="ats-select" class:ats-primary={primary}>
	{#if color}
		<div style="background-color: {color};"></div>
	{/if}
	<span>{text}</span>
	{#if primary}
		<i class="fas fa-caret-down"></i>
	{/if}
</div>


<style lang="scss">
  .ats-select {

    width: 100%;
    display: flex;
    align-items: center;

    cursor: pointer;
    color: var(--color-text-dark-primary);
    background: rgb(195 194 183);
    margin: 0;
    padding: 1px 3px;

    & > * {
      pointer-events: none;
    }

    &:hover {
      background-color: rgba(255, 255, 255, 0.5);
    }

    & > div {
      border: 1px solid rgb(60, 60, 84);
      border-radius: 9999px;
      min-width: 10px;
      min-height: 10px;
      display: inline-block;
      margin-right: 5px;
      margin-left: 3px;
      flex: 0;
    }

    & > span {
      flex: 1;
    }

    & > i {
      position: relative;
      top: -1px;
      left: -2px;
    }
  }

  .ats-primary {
    background: rgba(0, 0, 0, 0.05);
    border-radius: 3px;
    border: 1px solid var(--color-border-light-tertiary);

    &:hover {
      background-color: initial;
    }
  }
</style>
