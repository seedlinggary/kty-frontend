import Link from "next/link";

export function SortHeader({
  href,
  isActive,
  dir,
  children,
}: {
  href: string;
  isActive: boolean;
  dir: "asc" | "desc";
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1 hover:text-ink ${isActive ? "text-ink" : ""}`}
    >
      {children}
      <svg
        viewBox="0 0 12 12"
        aria-hidden="true"
        className={`h-3 w-3 shrink-0 ${isActive ? "text-accent" : "text-ink/30"}`}
      >
        {isActive ? (
          dir === "asc" ? (
            <path d="M6 3l4 5H2z" fill="currentColor" />
          ) : (
            <path d="M6 9L2 4h8z" fill="currentColor" />
          )
        ) : (
          <>
            <path d="M6 2l3 3.5H3z" fill="currentColor" />
            <path d="M6 10l3-3.5H3z" fill="currentColor" />
          </>
        )}
      </svg>
    </Link>
  );
}
