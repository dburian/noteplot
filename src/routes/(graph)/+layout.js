import graph  from '$lib/notes/__graph.json';

export function load() {
  return {...graph};
}

export const prerender = true;
