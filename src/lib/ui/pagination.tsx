import Link from "next/link";

function buildHref(basePath: string, params: Record<string, string | number | undefined>, pageParam: string, page: number) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "" && key !== pageParam) search.set(key, String(value));
  }
  if (page > 1) search.set(pageParam, String(page));
  const query = search.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function Pagination({
  basePath,
  page,
  pageSize,
  total,
  params = {},
  pageParam = "page"
}: {
  basePath: string;
  page: number;
  pageSize: number;
  total: number;
  params?: Record<string, string | number | undefined>;
  pageParam?: string;
}) {
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const current = Math.min(Math.max(page, 1), totalPages);
  const start = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const end = Math.min(current * pageSize, total);

  const rawPages = [1, current - 2, current - 1, current, current + 1, current + 2, totalPages]
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((a, b) => a - b);
  const pages = [...new Set(rawPages)];

  return (
    <div className="pagination">
      <span className="helper">
        Showing {start.toLocaleString()}–{end.toLocaleString()} of {total.toLocaleString()}
      </span>
      <div className="pager-actions">
        <Link
          className={`pager ${current <= 1 ? "disabled" : ""}`}
          href={buildHref(basePath, params, pageParam, Math.max(1, current - 1))}
          aria-disabled={current <= 1}
        >
          Previous
        </Link>
        {pages.map((item, index) => {
          const previous = pages[index - 1];
          return (
            <span key={item} className="pager-group">
              {previous && item - previous > 1 ? <span className="pager-ellipsis">…</span> : null}
              <Link className={`pager ${item === current ? "active" : ""}`} href={buildHref(basePath, params, pageParam, item)}>
                {item}
              </Link>
            </span>
          );
        })}
        <Link
          className={`pager ${current >= totalPages ? "disabled" : ""}`}
          href={buildHref(basePath, params, pageParam, Math.min(totalPages, current + 1))}
          aria-disabled={current >= totalPages}
        >
          Next
        </Link>
      </div>
    </div>
  );
}
