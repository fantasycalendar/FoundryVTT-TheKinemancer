<script>

  import CONSTANTS from "../constants.js";
  import { dndzone, SOURCES, TRIGGERS } from 'svelte-dnd-action';
  import { isRealNumber } from "../lib/lib.js";
  import SelectState from "./SelectState.svelte";
  import Select from "./Select.svelte";
  import FontAwesomePicker from "./FontAwesomePicker.svelte";

  export let items;
  export let errors;
  export let duration;

  function addState() {
    items = [
      ...items,
      {
        id: randomID(),
        name: "New State",
        start: 0,
        behavior: CONSTANTS.BEHAVIORS.STILL,
        end: "",
        icon: "",
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
    // Ensure dragging is stopped on drag finish via pointer (mouse, touch)
    if (source === SOURCES.POINTER) {
      dragDisabled = true;
    }
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
		<div>Icon</div>
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
					<FontAwesomePicker bind:value={state.icon}/>
				</div>
				<div>
					<input type="text" bind:value={state.name} autocomplete="false">
				</div>
				<div>
					<Select {index}
									style="position: relative;"
									items={Object.values(CONSTANTS.START).map(value => {
										return {
											props: {
												text: value
											},
											onPress: (index) => {
												items[index].start = value;
											}
										}
									})}
					>
						<input type="text"
									 style="width:100%;"
									 bind:value={state.start}
									 on:pointerup={(e) => { setTimeout(() => e.target.focus()) }}
									 on:change={() => {
							 if(isRealNumber(state.start) && Number(state.start) > duration){
								 state.start = duration.toString();
							 }
						 }}
						/>
						<div style="position:absolute; right: 5px; top:2px; pointer-events: none;">
							<i class="fas fa-caret-down"></i>
						</div>
					</Select>
				</div>
				<div>
					<Select {index}
									style="position: relative;"
									disabled={state.behavior === CONSTANTS.BEHAVIORS.STILL || state.behavior === CONSTANTS.BEHAVIORS.STILL_HIDDEN}
									items={Object.values(CONSTANTS.END).map(value => {
										return {
											props: {
												text: value
											},
											onPress: (index) => {
												items[index].end = value;
											}
										}
									})}
					>
						<input type="text"
									 style="width:100%;"
									 bind:value={state.end}
									 disabled={state.behavior === CONSTANTS.BEHAVIORS.STILL || state.behavior === CONSTANTS.BEHAVIORS.STILL_HIDDEN}
									 on:pointerup={(e) => { setTimeout(() => e.target.focus()) }}
									 on:change={() => {
							 if(isRealNumber(state.end) && Number(state.end) > duration){
								 state.end = duration.toString();
							 }
						 }}
						/>
						<div style="position:absolute; right: 5px; top:2px; pointer-events: none;">
							<i class="fas fa-caret-down"></i>
						</div>
					</Select>
				</div>
				<div class:ats-column-flex={state.behavior === CONSTANTS.BEHAVIORS.ONCE_SPECIFIC}>
					<Select {index} items={Object.entries(CONSTANTS.TRANSLATED_BEHAVIORS).map(entry => {
						return {
							props: {
								text: CONSTANTS.TRANSLATED_BEHAVIORS[entry[0]],
								color: CONSTANTS.BEHAVIOR_COLOR[entry[0]]
							},
							onPress: (index) => {
								items[index].behavior = entry[0];
							}
						}
					})}>
						<SelectState
							text={CONSTANTS.TRANSLATED_BEHAVIORS[state.behavior]}
							color={CONSTANTS.BEHAVIOR_COLOR[state.behavior]}
							primary
						/>
					</Select>
					<!--<select class={CONSTANTS.BEHAVIOR_CLASS[state.behavior]} bind:value={state.behavior}>
						{#each Object.entries(CONSTANTS.TRANSLATED_BEHAVIORS) as [value, localization], behaviorIndex}
							<option value={value}>
								{localization}
							</option>
						{/each}
					</select>-->
					{#if state.behavior === CONSTANTS.BEHAVIORS.ONCE_SPECIFIC}
						<select bind:value={state.nextState}>
							{#each items as innerState (innerState.id)}
								<option value={innerState.id}>
									{innerState.name}
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
      background-color: rgba(21, 20, 18, 0.05);
    }
  }

</style>
