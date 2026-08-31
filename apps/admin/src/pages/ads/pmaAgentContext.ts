let filters: Record<string, string> = {};

export function setPmaAgentFilters(next: Record<string, string>) {
  filters = next;
}

export function getPmaAgentFilters() {
  return filters;
}
