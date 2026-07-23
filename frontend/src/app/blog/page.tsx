import type { Metadata } from "next";
import Link from "next/link";
import { listBlogPosts } from "@/lib/blog";

export const metadata: Metadata = { title: "Blog | EventosBR" };

export default function BlogPage() {
  const posts = listBlogPosts();
  return (
    <article className="pb-16 pt-8 sm:pb-24 sm:pt-12">
      <div className="content-prose mx-auto max-w-3xl px-4 sm:px-6">
        <h1>Blog EventosBR</h1>
        <p>Novidades, dicas e conteúdo sobre eventos, ingressos e organização.</p>
        <ul className="mt-10 space-y-6">
          {posts.map((p) => (
            <li key={p.slug} className="border-b border-zinc-200 pb-6 last:border-0">
              <Link
                href={`/blog/${p.slug}`}
                className="text-xl font-semibold text-emerald-900 no-underline hover:underline"
              >
                {p.title}
              </Link>
              {p.date ? <p className="mt-1 text-xs text-zinc-500">{p.date}</p> : null}
              <p className="mt-2 text-sm">{p.excerpt}</p>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
