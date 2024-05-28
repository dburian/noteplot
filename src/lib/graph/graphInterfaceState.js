import { goto } from "$app/navigation";
import { writable } from "svelte/store";

const stateDefaults = {
    withGraph: false,
    graphFullScreen: false,
    viewedNote: null,
    sliding: false,
    setWidth: null,
    confirmedWidth: null,
    width: null
}

const computeWidth = (state) => {
  // console.log(`updating width for`)
  // console.log(state)

  if (!state.withGraph) {
    console.log("no graph: width 0")
    return 0;
  }

  if (state.sliding) {
    console.log(`sliding: width ${state.setWidth}`)
    return state.setWidth;
  }

  if (state.graphFullScreen) {
    console.log(`graph full screen: width null`)
    return null;
  }

  console.log(`confirmed width: ${state.confirmedWidth}`)
  return state.confirmedWidth;
};

const slidingStopped = (oldState, stateUpdate) => oldState.sliding && 'sliding' in stateUpdate && !stateUpdate.sliding;
const slidingStarted = (oldState, stateUpdate) => !oldState.sliding && 'sliding' in stateUpdate && stateUpdate.sliding;

export function createGraphState(explicitInitialState) {
  console.log("graph state created")
  const initState = {...stateDefaults,...explicitInitialState};
  initState.width = computeWidth(initState)
  const { subscribe, set, update } = writable(initState);


  const cleverUpdate = (stateUpdateFn) => {
    update(oldState => {
      const stateUpdate = typeof stateUpdateFn === 'function' ? stateUpdateFn(oldState) : stateUpdateFn
      console.log("state update:")
      console.log(stateUpdate)
      const newState = { ...oldState, ...stateUpdate };
      console.log({newState})

      if (slidingStarted(oldState, stateUpdate) && (oldState.graphFullScreen || !oldState.withGraph)) {
        goto(`/${newState.viewedNote.slug}`, {replaceState: true})
      }

      //Sliding stopped and we did not change URL state
      if (slidingStopped(oldState, stateUpdate)) {
        if (!newState.withGraph) {
          goto(`/notes/${newState.viewedNote.slug}`, {replaceState: true})
        } else if (newState.graphFullScreen) {
          goto('?graphFullScreen', {replaceState: true})
          newState.graphFullScreen = false;
        } else {
          newState.confirmedWidth = newState.setWidth;
        }
      }

      newState.width = computeWidth(newState);
      console.log(`setting width to ${newState.width}`)

      return newState;
    });
  }

  const cleverSet = (newState) => {
    newState = {...stateDefaults,...newState}
    newState.width = computeWidth(newState)
    console.log("state set:")
    console.log({newState})

    set(newState)
  }

  return {
    subscribe,
    update: cleverUpdate,
    set: cleverSet,
  };
}
