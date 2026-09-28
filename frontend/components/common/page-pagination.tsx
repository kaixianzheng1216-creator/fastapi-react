"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { getPaginationPages, PAGINATION_ELLIPSIS } from "@/lib/pagination";

type PagePaginationProps = {
  ariaLabel: string;
  currentPage: number;
  pageCount: number;
  pending: boolean;
  getPageHref: (page: number) => string;
  className?: string;
};

export function PagePagination({
  ariaLabel,
  currentPage,
  pageCount,
  pending,
  getPageHref,
  className,
}: PagePaginationProps) {
  const router = useRouter();
  const correctionHref =
    !pending && currentPage > Math.max(1, pageCount)
      ? getPageHref(Math.max(1, pageCount))
      : undefined;

  useEffect(() => {
    if (correctionHref !== undefined) {
      router.replace(correctionHref, { scroll: false });
    }
  }, [correctionHref, router]);

  if (pageCount < 1 || currentPage > pageCount) {
    return null;
  }

  const pages = getPaginationPages(currentPage, pageCount);

  return (
    <Pagination
      className={className}
      aria-label={ariaLabel}
      aria-busy={pending}
      inert={pending}
    >
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href={getPageHref(Math.max(1, currentPage - 1))}
            scroll={false}
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
                scroll={false}
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
            scroll={false}
            aria-disabled={currentPage >= pageCount}
            tabIndex={currentPage >= pageCount ? -1 : undefined}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
