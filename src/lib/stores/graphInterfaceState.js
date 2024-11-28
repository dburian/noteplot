import { writable } from 'svelte/store';

/**
 * @param {import('../WithUrlStateContext.svelte').UrlState} urlState
 * @param {Number} default_width
 */
function extractContentWidth(urlState, default_width) {
  if (urlState.fullContent) {
    return 1;
  }
  if (!urlState.hasContent || urlState.noContent) {
    return 0;
  }

  return default_width;
}

export function createGraphInterfaceState(initialUrlState) {
  const { update, subscribe } = writable({
    contentWidth: extractContentWidth(initialUrlState, 0.3),
    lastSetContentWidth: 0.3,
  })

  const largerContent = () => update((values) => ({ ...values, contentWidth: values.contentWidth > 0 ? 1.0 : values.lastSetContentWidth }))

  const smallerContent = () => update((values) => ({ ...values, contentWidth: values.contentWidth < 1.0 ? 0.0 : values.lastSetContentWidth }))

  const setContentWidth = (val) => update((values) => ({ ...values, contentWidth: val }))
  const confirmContentWidth = () => {
    update((values) => {
      const cw = values.contentWidth

      return {
        ...values,
        lastSetContentWidth: cw > 0.0 && cw < 1.0 ? cw : values.lastSetContentWidth,
      }
    })
  }

  const updateUrlState = (urlState) => update((values) => ({ ...values, contentWidth: extractContentWidth(urlState, values.lastSetContentWidth) }))

  return {
    subscribe,
    largerContent,
    smallerContent,
    setContentWidth,
    updateUrlState,
    confirmContentWidth,
  }
}
