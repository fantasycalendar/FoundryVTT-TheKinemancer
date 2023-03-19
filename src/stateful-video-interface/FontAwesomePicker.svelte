<script>

  import { TJSContextMenu } from "@typhonjs-fvtt/svelte-standard/application";
  import FontAwesomeList from "./FontAwesomeList.svelte";
  import { writable } from "svelte/store";

  export let value;
  export let disabled = false;

  let dropdownShown = false;

  function showDropDown(event) {

    if (dropdownShown || disabled) return;
    event.stopPropagation();

    const bounds = event.target.getBoundingClientRect();

    const openTop = (bounds.bottom + 210) > document.body.clientHeight;

    let store = writable(value);
    store.subscribe((val) => {
      value = val;
      dropdownShown = !dropdownShown;
    });

    TJSContextMenu.create({
      id: "test",
      x: bounds.left - 100,
      y: openTop ? bounds.top + -10 : bounds.bottom + 10,
      zIndex: 1000000000000,
      duration: 1,
      styles: {
        "margin:": "24px 0",
        "height": "200px",
        "font-size": "0.75rem",
        "width": `200px`,
        "box-shadow": "none",
        "background-color": "rgb(195 194 183)",
        "border": "1px solid var(--color-border-light-tertiary)",
        "margin-top": "-1px",
        "padding": "0",
        "color": "black",
        "--tjs-context-menu-focus-indicator-width": "0px",
        "--tjs-context-menu-item-padding": "0px"
      },
      items: [{
        class: FontAwesomeList,
        props: {
          selected: store,
        }
      }]
    });
  }

</script>

<svelte:window on:click={() => {
	dropdownShown = false;
}}/>

<div style={$$props.style} on:click={(event) => {
	showDropDown(event)
}}>
	<i class={value}></i>
</div>


<style lang="scss">
  div {
    min-width: 20px;
    min-height: 20px;
    display: flex;
    justify-content: center;
    align-items: center;

    border-radius: 5px;
    border: 1px solid rgba(0, 0, 0, 0.5);
    cursor: pointer;
  }
</style>
