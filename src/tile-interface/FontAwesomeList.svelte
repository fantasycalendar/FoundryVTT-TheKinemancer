<script>

  import { FONT_AWESOME_ICONS } from "../font-awesome-icons.js";
  import { writable } from "svelte/store";

  export let selected;

  const icons = writable(FONT_AWESOME_ICONS);
  let filter = "";

  $: filteredIcons = $icons.filter(icon => !filter || icon.toLowerCase().includes(filter.toLowerCase()))
    .map(icon => `fas fa-${icon}`);

</script>

<div class="ats-icon-select-container" on:click={(event) => {
  if(!event.target.classList.contains("ats-icon")){
  	event.stopPropagation();
  }
}}>
	<input type="text" bind:value={filter} placeholder="Type to search...">
	<div class="ats-icon-container">
		<div class="ats-icon" class:ats-selected-icon={!$selected} on:click={() => selected.set("")}>
			<i class=""></i>
		</div>
		{#each filteredIcons as icon}
			<div class="ats-icon" class:ats-selected-icon={icon === $selected} on:click={() => selected.set(icon)}>
				<i class={icon}></i>
			</div>
		{/each}
	</div>
</div>


<style lang="scss">

  .ats-icon-select-container {
    min-width: 198px;
    max-width: 198px;
    min-height: 198px;
    max-height: 198px;

    input {
      margin-bottom: 4px;
    }
  }

  .ats-icon-container {
    min-width: 198px;
    max-width: 198px;
    min-height: 168px;
    max-height: 168px;
    overflow-y: scroll;
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 5px;
    font-size: 18px;
    padding: 5px;

    .ats-icon {
      min-width: 25px;
      min-height: 25px;
      max-height: 25px;
      padding: 2px;
      display: flex;
      border-radius: 5px;
      text-align: center;
      justify-content: center;
      align-items: center;
      cursor: pointer;

      &:hover {
        background-color: rgba(255, 255, 255, 0.5);
      }

      i {
        pointer-events: none;
      }
    }
  }
</style>
