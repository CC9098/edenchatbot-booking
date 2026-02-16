import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownContentProps {
  content: string;
  className?: string;
}

function isExternalUrl(href: string): boolean {
  return href.startsWith("http://") || href.startsWith("https://");
}

export default function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="mt-6 text-2xl font-bold text-slate-900">{children}</h1>,
          h2: ({ children }) => <h2 className="mt-6 text-xl font-semibold text-slate-900">{children}</h2>,
          h3: ({ children }) => <h3 className="mt-5 text-lg font-semibold text-slate-900">{children}</h3>,
          p: ({ children }) => <p className="mt-4 leading-8 text-slate-700">{children}</p>,
          ul: ({ children }) => <ul className="mt-4 list-disc space-y-1 pl-6 text-slate-700">{children}</ul>,
          ol: ({ children }) => <ol className="mt-4 list-decimal space-y-1 pl-6 text-slate-700">{children}</ol>,
          li: ({ children }) => <li className="leading-8">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="mt-4 border-l-4 border-primary/30 bg-primary-pale px-4 py-3 text-slate-700">
              {children}
            </blockquote>
          ),
          a: ({ href = "", children }) => {
            if (isExternalUrl(href)) {
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary underline underline-offset-2 hover:text-primary-hover"
                >
                  {children}
                </a>
              );
            }
            return (
              <Link href={href} className="font-medium text-primary underline underline-offset-2 hover:text-primary-hover">
                {children}
              </Link>
            );
          },
          pre: ({ children }) => (
            <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-900 p-4 text-sm leading-6 text-slate-100">
              {children}
            </pre>
          ),
          code: ({ children, className }) => {
            const isBlockCode = Boolean(className && className.includes("language-"));
            if (isBlockCode) {
              return <code className={className}>{children}</code>;
            }
            return (
              <code className="rounded bg-slate-200/70 px-1.5 py-0.5 text-[0.9em] text-slate-800">
                {children}
              </code>
            );
          },
          hr: () => <hr className="my-6 border-slate-200" />,
          table: ({ children }) => (
            <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[520px] border-collapse text-left text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-slate-100 text-slate-900">{children}</thead>,
          tbody: ({ children }) => <tbody className="bg-white">{children}</tbody>,
          tr: ({ children }) => <tr className="border-b border-slate-200 last:border-b-0">{children}</tr>,
          th: ({ children }) => <th className="px-3 py-2 font-semibold">{children}</th>,
          td: ({ children }) => <td className="px-3 py-2 align-top text-slate-700">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
