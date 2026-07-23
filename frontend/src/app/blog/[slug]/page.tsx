import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BlogMarkdown } from "@/components/blog-markdown";
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
    <article className="pb-16 pt-8 sm:pb-24 sm:pt-12">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <Link href="/blog" className="text-sm font-medium text-emerald-800 hover:underline">
          ← Blog
        </Link>
        <header className="content-prose mt-4">
          <h1>{post.meta.title}</h1>
          {post.meta.date ? <p className="text-sm text-zinc-500">{post.meta.date}</p> : null}
        </header>
        <BlogMarkdown source={post.body} className="mt-6" />
      </div>
    </article>
  );
}
