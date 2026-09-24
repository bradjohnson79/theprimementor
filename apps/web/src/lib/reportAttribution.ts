export function withCurrentSearch(path: string, search: string) {
  if (!search || search === "?") {
    return path;
  }
  const query = search.startsWith("?") ? search : `?${search}`;
  return `${path}${query}`;
}
