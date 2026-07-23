import Link from "next/link";

type Block =
  | { type: "h2"; text: string }
  | { type: "p"; html: string }
  | { type: "ul"; items: string[] };

function inlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="font-medium text-emerald-800 underline-offset-2 hover:underline">$1</a>');
}

function parseBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({ type: "p", html: inlineMarkdown(paragraph.join(" ")) });
    paragraph = [];
  };

  const flushList = () => {
    if (list.length === 0) return;
    blocks.push({ type: "ul", items: list.map(inlineMarkdown) });
    list = [];
  };

  for (const rawLine of source.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }
    if (line.startsWith("## ")) {
      flushParagraph();
      flushList();
      blocks.push({ type: "h2", text: line.slice(3).trim() });
      continue;
    }
    if (line.startsWith("# ")) {
      continue;
    }
    if (line.startsWith("- ")) {
      flushParagraph();
      list.push(line.slice(2).trim());
      continue;
    }
    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
}

type Props = {
  source: string;
  className?: string;
};

export function BlogMarkdown({ source, className = "" }: Props) {
  const body = source.replace(/^#\s+.+\n+/m, "");
  const blocks = parseBlocks(body);

  return (
    <div className={`content-prose ${className}`.trim()}>
      {blocks.map((block, i) => {
        if (block.type === "h2") {
          return (
            <h2 key={i} className="mt-8 text-xl font-semibold text-zinc-900 first:mt-0">
              {block.text}
            </h2>
          );
        }
        if (block.type === "ul") {
          return (
            <ul key={i} className="mt-3 list-disc space-y-2 pl-5">
              {block.items.map((item) => (
                <li key={item} dangerouslySetInnerHTML={{ __html: item }} />
              ))}
            </ul>
          );
        }
        return <p key={i} className="mt-4" dangerouslySetInnerHTML={{ __html: block.html }} />;
      })}
    </div>
  );
}
