import { writable } from "svelte/store";

export function extractState(url = null, baseGraphPath = '/', baseNotesPath = '/notes') {
  if (url === null || (url && url.pathname === '/' && url.pathname !== baseGraphPath) {
    return { inGraph: false, noteSlug: null };
  }

  if (url.pathname.startsWith(baseGraphPath)) {
    if (url.pathname === baseGraphPath) {
      return { inGraph: true, noteSlug: null };
    }

    return { inGraph: true, noteSlug: url.pathname.slice(baseGraphPath.length + 1) }
  }

  if (url.pathname.startsWith(baseNotesPath)) {
    return { inGraph: false, noteSlug: url.pathname.slice(baseNotesPath.length + 1) };
  }

  return { inGraph: false, noteSlug: null };
}

export const urlState = writable({ inGraph: false, noteSlug: null })
