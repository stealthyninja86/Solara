import type { ReactNode } from "react";

export const UNCATEGORIZED_TIP =
  "If you see Uncategorized spending, the AI wasn't sure about those transactions — they've been put in review. Review them to view your data correctly.";

interface Props {
  category: string;
  children: ReactNode;
}

export function UncategorizedLabel({ category, children }: Props) {
  if (category !== "UNCATEGORIZED") return <>{children}</>;
  return (
    <span className="uncategorized-tooltip" data-tip={UNCATEGORIZED_TIP}>
      {children}
    </span>
  );
}
