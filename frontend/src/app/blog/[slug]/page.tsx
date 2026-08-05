import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BlogMarkdown } from "@/components/blog-markdown";
import { getBlogPost } from "@/lib/blog";
import { buildBlogPostingJsonLd } from "@/lib/public-json-ld";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return { title: "Blog" };
  const title = `${post.meta.title} | Blog EventosBR`;
  const description =
    post.meta.excerpt ||
    "Novidades, dicas e conteúdo sobre eventos, ingressos e organização no EventosBR.";
  return {
    title,
    description,
    alternates: { canonical: `/blog/${post.meta.slug}` },
    openGraph: {
      title: post.meta.title,
      description,
      url: `/blog/${post.meta.slug}`,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: post.meta.title,
      description,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  return (
    <article className="pb-16 pt-8 sm:pb-24 sm:pt-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: buildBlogPostingJsonLd(post.meta) }}
      />
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <Link href="/blog" className="text-sm font-medium text-emerald-700 hover:underline">
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
