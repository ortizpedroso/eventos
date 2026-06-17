import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBlogPost } from "@/lib/blog";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);
  return { title: post ? `${post.meta.title} | Blog EventosBR` : "Blog" };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  return (
    <article className="mx-auto max-w-3xl py-12 px-4">
      <Link href="/blog" className="text-sm text-emerald-800 hover:underline">← Blog</Link>
      <h1 className="mt-4 text-3xl font-bold text-zinc-900">{post.meta.title}</h1>
      {post.meta.date ? <p className="mt-2 text-sm text-zinc-500">{post.meta.date}</p> : null}
      <div className="prose prose-zinc mt-8 whitespace-pre-wrap">{post.body.replace(/^# .+\n+/m, "")}</div>
    </article>
  );
}
