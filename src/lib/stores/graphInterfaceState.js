import { goto } from "$app/navigation";
import { base } from "$app/paths";
import { writable } from "svelte/store";

function buildUrl(state) {
  let newUrl = `${base}/`
  if (state.search !== null) {
    const searchParams = new URLSearchParams()
    searchParams.set("q", state.search)
    newUrl += "search?" + searchParams.toString()

    return newUrl
  }

  if (state.viewedNote && !state.withGraph) {
    newUrl += "notes/"
  }
  if (state.viewedNote) {
    newUrl += `${state.viewedNote.slug}`
    if (state.graphFullScreen) {
      newUrl += "?graphFullScreen"
    }
  }

  return newUrl;
}

function propagateToUrl(oldState, newState) {
  // Change in URL
  const oldUrl = buildUrl(oldState)
  const newUrl = buildUrl(newState)

  if (oldUrl !== newUrl) {
    goto(newUrl)
  }
}

function verifyState(state) {
  state.withContent = state.viewedNote || state.search !== null
  state.withGraph = state.withContent ? state.withGraph : true;

  return state
}

export function createGraphState(initialState) {
  const { subscribe, set, update } = writable(verifyState({ ...initialState }))

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

  const close = () => {
    updateWithSideEffects({
      viewedNote: null,
      search: null,
    })
  }

  const largerContent = () => {
    updateWithSideEffects(oldState => ({
      graphFullScreen: false,
      withGraph: oldState.graphFullScreen
    }))
  }

  const smallerContent = () => {
    updateWithSideEffects(oldState => ({
      withGraph: true,
      graphFullScreen: oldState.withGraph,
    }))
  }

  const viewNote = (note) => {
    updateWithSideEffects({
      viewedNote: note,
      search: null,
    })
  }

  return {
    subscribe,
    update: updateWithSideEffects,
    close,
    largerContent,
    smallerContent,
    viewNote,
  }

}
