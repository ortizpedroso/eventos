import type { ReactNode } from "react";

import { AjudaNav } from "@/components/ajuda-nav";

type Props = {
  title: string;
  current?: string;
  children: ReactNode;
};

export function AjudaArticle({ title, current, children }: Props) {
  return (
    <article className="pb-16 pt-8 sm:pb-24 sm:pt-12">
      <div className="content-prose mx-auto max-w-3xl px-4 sm:px-6">
        <h1>{title}</h1>
        <AjudaNav current={current} />
        {children}
      </div>
    </article>
  );
}
