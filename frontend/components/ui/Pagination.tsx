"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export type PageMeta = {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasMore: boolean;
};

/**
 * Pager for a list endpoint.
 *
 * Renders nothing when everything fits on one page, so a short list is not
 * decorated with a control that cannot do anything.
 *
 * The window of page numbers slides around the current page rather than listing
 * every page, which keeps the control the same width whether there are three
 * pages or three hundred.
 */
export function Pagination({
  meta,
  onChange,
  label = "items"
}: {
  meta: PageMeta | undefined;
  onChange: (page: number) => void;
  label?: string;
}) {
  if (!meta || meta.pages <= 1) return null;

  const { page, pages, total, limit } = meta;
  const first = (page - 1) * limit + 1;
  const last = Math.min(page * limit, total);

  const window: number[] = [];
  const start = Math.max(1, Math.min(page - 2, pages - 4));
  const end = Math.min(pages, Math.max(page + 2, 5));
  for (let index = start; index <= end; index += 1) window.push(index);

  return (
    <nav
      className="mt-6 flex flex-col items-center justify-between gap-3 border-t border-line pt-5 sm:flex-row"
      aria-label="Pagination"
    >
      <p className="text-sm text-muted" aria-live="polite">
        Showing <span className="font-semibold text-ink">{first}</span>–
        <span className="font-semibold text-ink">{last}</span> of{" "}
        <span className="font-semibold text-ink">{total}</span> {label}
      </p>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className="btn btn-secondary btn-sm focus-ring"
        >
          <ChevronLeft size={15} aria-hidden />
        </button>

        {start > 1 && (
          <>
            <button type="button" onClick={() => onChange(1)} className="btn btn-ghost btn-sm focus-ring">
              1
            </button>
            <span className="px-1 text-muted" aria-hidden>
              …
            </span>
          </>
        )}

        {window.map((number) => (
          <button
            key={number}
            type="button"
            onClick={() => onChange(number)}
            aria-current={number === page ? "page" : undefined}
            className={`btn btn-sm focus-ring ${number === page ? "btn-primary" : "btn-ghost"}`}
          >
            {number}
          </button>
        ))}

        {end < pages && (
          <>
            <span className="px-1 text-muted" aria-hidden>
              …
            </span>
            <button type="button" onClick={() => onChange(pages)} className="btn btn-ghost btn-sm focus-ring">
              {pages}
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={!meta.hasMore}
          aria-label="Next page"
          className="btn btn-secondary btn-sm focus-ring"
        >
          <ChevronRight size={15} aria-hidden />
        </button>
      </div>
    </nav>
  );
}
