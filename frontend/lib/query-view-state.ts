type QueryViewInput = {
  data: unknown;
  errorUpdatedAt: number;
  isPending: boolean;
  isPlaceholderData: boolean;
};

export function getQueryViewState(query: QueryViewInput, isEmpty = false) {
  // Refetch clears isError while pending; keep the error view until recovery.
  if (query.data === undefined && query.errorUpdatedAt > 0) return "error";

  // An empty placeholder belongs to the previous filters, not the new request.
  if (query.isPending || (query.isPlaceholderData && isEmpty)) return "loading";

  return "ready";
}
