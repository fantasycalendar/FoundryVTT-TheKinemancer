<script>

  import CONSTANTS from "../constants.js";
  import { dndzone, SOURCES, TRIGGERS } from 'svelte-dnd-action';
  import { createEventDispatcher } from "svelte";

  export let items;
  export let errors;

  const dispatch = createEventDispatcher();

  function addState() {
    items = [
      ...items,
      {
        id: randomID(),
        name: "New State",
        start: 0,
        behavior: CONSTANTS.BEHAVIORS.STILL,
        end: "",
        nextState: null,
        default: !items.length
      }
    ]
  }

  function removeState(index) {
    items.splice(index, 1);
    if (!items.find(item => item.default) && items.length) {
      items[0].default = true;
    }
    items = items;
    validateLastState();
  }

  const flipDurationMs = 300;
  let dragDisabled = true;

  function handleConsider(e) {
    const { items: newItems, info: { source, trigger } } = e.detail;
    items = newItems;
    // Ensure dragging is stopped on drag finish via keyboard
    if (source === SOURCES.KEYBOARD && trigger === TRIGGERS.DRAG_STOPPED) {
      dragDisabled = true;
    }
  }

  function handleFinalize(e) {
    const { items: newItems, info: { source } } = e.detail;
    items = newItems;
    validateLastState();
    // Ensure dragging is stopped on drag finish via pointer (mouse, touch)
    if (source === SOURCES.POINTER) {
      dragDisabled = true;
    }
  }

  function validateLastState() {
    if (!items.length) return;
    const lastState = items[items.length - 1];
    lastState.behavior = lastState.behavior === CONSTANTS.BEHAVIORS.ONCE_NEXT
      ? CONSTANTS.BEHAVIORS.STILL
      : lastState.behavior;
  }

  function startDrag(e) {
    // preventing default to prevent lag on touch devices (because of the browser checking for screen scrolling)
    e.preventDefault();
    dragDisabled = false;
  }

  function handleKeyDown(e) {
    if ((e.key === "Enter" || e.key === " ") && dragDisabled) dragDisabled = false;
  }

</script>


<div class="ats-parent-container">

	<div class="ats-grid">
		<div></div>
		<div>State Name</div>
		<div>Start</div>
		<div>End</div>
		<div>Behavior</div>
		<div></div>
		<div>
			<a on:click={() => addState()}><i class="fas fa-plus"></i></a>
		</div>
	</div>

	<section on:consider="{handleConsider}" on:finalize="{handleFinalize}"
					 use:dndzone="{{items, dragDisabled, flipDurationMs}}">

		{#each items as state, index (state.id)}

			<div class="ats ats-grid ats-grid-odd-even">

				<div>
					<a tabIndex={dragDisabled ? 0 : -1}
						 aria-label="drag-handle"
						 style={dragDisabled ? 'cursor: grab' : 'cursor: grabbing'}
						 on:mousedown={startDrag}
						 on:touchstart={startDrag}
						 on:keydown={handleKeyDown}
					>
						<i class="fas fa-bars"></i>
					</a>
				</div>
				<div>
					<input type="text" bind:value={state.name} autocomplete="false">
				</div>
				<div>
					<input list={state.id - "-start-list"}
								 type="text" bind:value={state.start}
								 autocomplete="false"
					/>
					<datalist id={state.id - "-start-list"}>
						<option></option>
						<option>prev</option>
						<option>end</option>
						<option>mid</option>
					</datalist>
				</div>
				<div>
					<input list={state.id - "-end-list"}
								 type="text" bind:value={state.end}
								 disabled={state.behavior === CONSTANTS.BEHAVIORS.STILL}
								 autocomplete="false"
					/>
					<datalist id={state.id - "-end-list"}>
						<option></option>
						<option>next</option>
						<option>end</option>
						<option>mid</option>
					</datalist>
				</div>
				<div class:ats-column-flex={state.behavior === CONSTANTS.BEHAVIORS.ONCE_SPECIFIC}>
					<select bind:value={state.behavior}>
						{#each Object.entries(CONSTANTS.TRANSLATED_BEHAVIORS) as [value, localization], behaviorIndex}
							<option value={value} disabled={index === items.length-1 && value === CONSTANTS.BEHAVIORS.ONCE_NEXT}>
								{localization}
							</option>
						{/each}
					</select>
					{#if state.behavior === CONSTANTS.BEHAVIORS.ONCE_SPECIFIC}
						<select bind:value={state.nextState}>
							{#each items as state, index (state.id)}
								<option value={index}>
									{state.name}
								</option>
							{/each}
						</select>
					{/if}
				</div>
				<div><input type="checkbox" checked={state.default} on:change={() => {
          items.forEach(item => item.default = false);
          state.default = true;
				}}/></div>
				<div>
					<a on:click={() => removeState(index)}><i class="fas fa-times"></i></a>
				</div>

			</div>

		{/each}

	</section>

	{#each errors as error}
		<div class="notification error">{error}</div>
	{/each}

</div>


<style lang="scss">

  .ats-grid-odd-even {

    border-radius: 3px;

    &:nth-child(even) {
      background-color: rgba(229, 229, 214, 0.1);
    }

    &:nth-child(odd) {
      background-color: rgba(21, 20, 18, 0.1);
    }
  }

</style>
