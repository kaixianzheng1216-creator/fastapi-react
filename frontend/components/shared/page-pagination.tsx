import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  getPaginationPages,
  PAGINATION_ELLIPSIS,
} from "@/lib/pagination";

type PagePaginationProps = {
  ariaLabel: string;
  currentPage: number;
  pageCount: number;
  getPageHref: (page: number) => string;
  className?: string;
};

export function PagePagination({
  ariaLabel,
  currentPage,
  pageCount,
  getPageHref,
  className,
}: PagePaginationProps) {
  if (pageCount === 0) {
    return null;
  }

  const pages = getPaginationPages(currentPage, pageCount);

  return (
    <Pagination className={className} aria-label={ariaLabel}>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href={getPageHref(Math.max(1, currentPage - 1))}
            aria-disabled={currentPage <= 1}
            tabIndex={currentPage <= 1 ? -1 : undefined}
          />
        </PaginationItem>

        {pages.map((page, index) => (
          <PaginationItem key={`${page}-${index}`}>
            {page === PAGINATION_ELLIPSIS ? (
              <PaginationEllipsis />
            ) : (
              <PaginationLink
                href={getPageHref(page)}
                isActive={page === currentPage}
              >
                {page}
              </PaginationLink>
            )}
          </PaginationItem>
        ))}

        <PaginationItem>
          <PaginationNext
            href={getPageHref(Math.min(pageCount, currentPage + 1))}
            aria-disabled={currentPage >= pageCount}
            tabIndex={currentPage >= pageCount ? -1 : undefined}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
