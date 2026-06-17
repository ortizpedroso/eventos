import type { Metadata } from "next";
import Link from "next/link";
import { listBlogPosts } from "@/lib/blog";

export const metadata: Metadata = { title: "Blog | EventosBR" };

export default function BlogPage() {
  const posts = listBlogPosts();
  return (
    <div className="mx-auto max-w-3xl py-12 px-4">
      <h1 className="text-3xl font-bold text-zinc-900">Blog EventosBR</h1>
      <ul className="mt-8 space-y-6">
        {posts.map((p) => (
          <li key={p.slug} className="border-b border-zinc-200 pb-6">
            <Link href={`/blog/${p.slug}`} className="text-xl font-semibold text-emerald-900 hover:underline">
              {p.title}
            </Link>
            {p.date ? <p className="mt-1 text-xs text-zinc-500">{p.date}</p> : null}
            <p className="mt-2 text-sm text-zinc-600">{p.excerpt}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
