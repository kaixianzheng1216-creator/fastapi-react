export const PAGINATION_ELLIPSIS = "ellipsis" as const;

type PaginationPage = number | typeof PAGINATION_ELLIPSIS;

export function getPaginationHref(
  pathname: string,
  page: number,
  parameters: URLSearchParams = new URLSearchParams(),
): string {
  const nextParameters = new URLSearchParams(parameters);

  if (page > 1) {
    nextParameters.set("page", String(page));
  } else {
    nextParameters.delete("page");
  }

  const query = nextParameters.toString();

  return query ? `${pathname}?${query}` : pathname;
}

export function getPaginationPages(
  currentPage: number,
  totalPages: number,
): PaginationPage[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, PAGINATION_ELLIPSIS, totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [
      1,
      PAGINATION_ELLIPSIS,
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }

  return [
    1,
    PAGINATION_ELLIPSIS,
    currentPage - 1,
    currentPage,
    currentPage + 1,
    PAGINATION_ELLIPSIS,
    totalPages,
  ];
}
