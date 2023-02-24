<script>

  import { TJSContextMenu } from "@typhonjs-fvtt/svelte-standard/application";
  import SelectState from "./SelectState.svelte";

  export let index;
  export let items;
  export let disabled = false;

  let dropdownShown = false;

  function showDropDown(event, index) {

    if (dropdownShown || disabled) return;
    event.stopPropagation();
    dropdownShown = true;

    const bounds = event.target.getBoundingClientRect();

    const openTop = (bounds.bottom + 160) > document.body.clientHeight;

    TJSContextMenu.create({
      id: "test",
      x: bounds.left,
      y: openTop ? bounds.top : bounds.bottom,
      zIndex: 1000000000000,
      duration: 1,
      styles: {
        "margin:": "24px 0",
        "font-size": "0.75rem",
        "max-width": `${bounds.right - bounds.left}px`,
        "min-width": `${bounds.right - bounds.left}px`,
        "box-shadow": "none",
        "background-color": "rgb(195 194 183)",
        [`border-${openTop ? "bottom" : "top"}-left-radius`]: "0px",
        [`border-${openTop ? "bottom" : "top"}-right-radius`]: "0px",
        "border": "1px solid var(--color-border-light-tertiary)",
        "margin-top": "-1px",
        "padding": "0",
        "color": "black",
        "--tjs-context-menu-focus-indicator-width": "0px",
        "--tjs-context-menu-item-padding": "0px"
      },
      items: items.map(item => {
        return {
          ...item,
          class: SelectState,
          onPress: () => {
            item.onPress(index)
            dropdownShown = false;
          }
        }
      })
    });
  }

</script>

<svelte:window on:click={() => {
	dropdownShown = false;
}}/>

<div style={$$props.style} on:click={(event) => {
	showDropDown(event, index)
}}>
	<slot/>
</div>
