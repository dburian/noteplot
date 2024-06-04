import { goto } from "$app/navigation";
import { base } from "$app/paths";
import { writable } from "svelte/store";

function propagateToUrlDesktop(oldState, newState) {
  // Change in URL
  if (oldState.withGraph !== newState.withGraph ||
    oldState.viewedNote?.slug !== newState.viewedNote?.slug ||
    oldState.graphFullScreen !== newState.graphFullScreen) {
    let newUrl = `${base}/`
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
}


function propagateToUrl(oldState, newState) {
  //For now they are the same...
  propagateToUrlDesktop(oldState, newState)
}

function verifyState(state) {
  if (state.mobile) {
    state.graphFullScreen = !state.viewedNote;
    state.withGraph = !state.viewedNote;
  } else {
    if (!state.viewedNote) {
      state.graphFullScreen = false;
      state.withGraph = true;
    }
  }

  return state
}

export function createGraphState(initialState) {
  const { subscribe, set, update } = writable({ ...initialState })

  const updateWithSideEffects = (stateUpdate) => {
    update(oldState => {
      if (typeof stateUpdate === "function") {
        stateUpdate = stateUpdate(oldState)
      }
      const newState = verifyState({ ...oldState, ...stateUpdate })

      propagateToUrl(oldState, newState)

      console.log({newState})

      return newState
    })
  }

  return {
    subscribe,
    update: updateWithSideEffects,
  }



}
