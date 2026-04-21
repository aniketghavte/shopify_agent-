import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

interface Props {
  content: string;
}

// Sanitised markdown renderer. remark-gfm for tables/strikethrough,
// rehype-sanitize to strip any raw HTML the model might emit.
export function Markdown({ content }: Props) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          a: (props) => (
            <a {...props} target="_blank" rel="noreferrer noopener" />
          ),
          table: (props) => (
            <div className="md-table-wrap">
              <table {...props} />
            </div>
          ),
          code: ({ className, children, ...rest }) => {
            const isInline = !className;
            return isInline ? (
              <code className="md-inline-code" {...rest}>
                {children}
              </code>
            ) : (
              <pre className="md-code-block">
                <code className={className} {...rest}>
                  {children}
                </code>
              </pre>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
