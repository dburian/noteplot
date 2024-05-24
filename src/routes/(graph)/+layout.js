import graph  from '$lib/notes/__graph.json';

export function load({url}) {
  const graphFullScreen = url.searchParams.has('graphFullScreen')

  return {...graph, graphFullScreen};
}

export const prerender = true;
