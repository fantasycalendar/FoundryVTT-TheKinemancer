<script>
  export let value;
  export let type;
  export let placeholder = "";
  export let showImage = false;
  export let showInput = true;
  export let preferredFolder = "";

  let filePicker = false;

  function handleClick() {
    if (!filePicker) {
      filePicker = new FilePicker({
        type: type,
        current: value || preferredFolder || "",
        callback: path => {
          value = path;
          filePicker = false;
        }
      });
    }

    filePicker.render(true, { focus: true });
  }

</script>

<div>
	{#if showImage}
		<div class="item-piles-img-container">
			<img class="item-piles-img" src={value}/>
		</div>
	{/if}
	{#if showInput}
		<input type="text" placeholder="{placeholder}" bind:value="{value}"/>
	{/if}
	<button on:click={handleClick} type="button"><i class="fas fa-file-import"></i></button>
</div>

<style lang="scss">

  div {
    width: 100%;
    display: inline-flex;
    flex-direction: row;
    align-items: center;

    input {
      height: 26px;
      margin-right: 0.25rem;
    }

    button {
      padding: 0.25rem 0.25rem;
      line-height: 1rem !important;
      flex: 0;
    }
  }

</style>
