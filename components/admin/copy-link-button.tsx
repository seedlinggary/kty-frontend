"use client";

import { useState } from "react";

export function CopyLinkButton({
  link,
  label = "Copy Payment Link",
}: {
  link: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="text-xs font-medium text-ink hover:underline"
    >
      {copied ? "Copied!" : label}
    </button>
  );
}
