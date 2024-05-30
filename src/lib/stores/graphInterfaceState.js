import { goto } from "$app/navigation";
import { writable } from "svelte/store";


export function createGraphInterfaceState(initialState) {
  const {subscribe, set, update} = writable({...initialState})

  const verifyState = (state) => {
    if (!state.viewedNote) {
      state.graphFullScreen = false;
      state.withGraph = true;
    }

    return state
  }

  const updateWithSideEffects = (stateUpdate) => {
    update(oldState => {
      if (typeof stateUpdate === "function") {
        stateUpdate = stateUpdate(oldState)
      }
      console.log({stateUpdate})
      const newState = verifyState({...oldState, ...stateUpdate})

      // Change in URL
      if (oldState.withGraph !== newState.withGraph ||
          oldState.viewedNote?.slug !== newState.viewedNote?.slug ||
          oldState.graphFullScreen !== newState.graphFullScreen) {
        let newUrl = "/"
        if (newState.viewedNote && !newState.withGraph) {
          newUrl += "notes/"
        }
        if (newState.viewedNote) {
          newUrl += `${newState.viewedNote.slug}`
          if (newState.graphFullScreen) {
            newUrl += "?graphFullScreen"
          }
        }

        goto(newUrl)
      }

      return newState
    })
  }

  return {
    subscribe,
    update: updateWithSideEffects,
  }
}