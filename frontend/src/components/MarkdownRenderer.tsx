import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CodeBlock from './CodeBlock';
import { parseCodeBlocks } from '../utils/parseCodeBlocks';

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  // Parse content to extract code blocks
  const segments = parseCodeBlocks(content);
  
  return (
    <div className="markdown-content">
      {segments.map((segment, index) => {
        if (segment.type === 'code') {
          return (
            <CodeBlock
              key={`code-${index}`}
              code={segment.code}
              language={segment.language}
            />
          );
        } else {
          // Render text segments as markdown
          return (
            <div key={`markdown-${index}`} className="prose prose-sm prose-invert max-w-none markdown-content-text">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                // Customize heading styles
                h1: ({node, ...props}) => <h1 className="text-2xl font-bold mt-4 mb-2 text-text" {...props} />,
                h2: ({node, ...props}) => <h2 className="text-xl font-bold mt-3 mb-2 text-text" {...props} />,
                h3: ({node, ...props}) => <h3 className="text-lg font-bold mt-2 mb-1 text-text" {...props} />,
                h4: ({node, ...props}) => <h4 className="text-base font-bold mt-2 mb-1 text-text" {...props} />,
                h5: ({node, ...props}) => <h5 className="text-sm font-bold mt-2 mb-1 text-text" {...props} />,
                h6: ({node, ...props}) => <h6 className="text-sm font-semibold mt-2 mb-1 text-subtext1" {...props} />,
                
                // Customize paragraph styles
                p: ({node, ...props}) => <p className="mb-3 last:mb-0 text-text leading-relaxed" {...props} />,
                
                // Customize list styles
                ul: ({node, ...props}) => <ul className="list-disc list-inside mb-3 space-y-1 text-text" {...props} />,
                ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-3 space-y-1 text-text" {...props} />,
                li: ({node, ...props}) => <li className="ml-2 text-text" {...props} />,
                
                // Customize link styles
                a: ({node, ...props}) => (
                  <a 
                    className="text-blue hover:text-mauve underline transition-colors" 
                    target="_blank"
                    rel="noopener noreferrer"
                    {...props} 
                  />
                ),
                
                // Customize code inline styles
                code: ({node, inline, ...props}: any) => {
                  if (inline) {
                    return (
                      <code 
                        className="px-1.5 py-0.5 bg-surface2 rounded text-text font-mono text-sm" 
                        {...props} 
                      />
                    );
                  }
                  return <code {...props} />;
                },
                
                // Customize blockquote styles
                blockquote: ({node, ...props}) => (
                  <blockquote 
                    className="border-l-4 border-accent pl-4 italic my-3 text-subtext1" 
                    {...props} 
                  />
                ),
                
                // Customize strong and emphasis
                strong: ({node, ...props}) => <strong className="font-bold text-text" {...props} />,
                em: ({node, ...props}) => <em className="italic text-subtext1" {...props} />,
                
                // Customize horizontal rule
                hr: ({node, ...props}) => (
                  <hr className="border-surface2 my-4" {...props} />
                ),
                
                // Customize table styles
                table: ({node, ...props}) => (
                  <div className="overflow-x-auto my-3">
                    <table className="min-w-full border-collapse border border-surface2" {...props} />
                  </div>
                ),
                thead: ({node, ...props}) => (
                  <thead className="bg-surface2" {...props} />
                ),
                tbody: ({node, ...props}) => <tbody {...props} />,
                tr: ({node, ...props}) => (
                  <tr className="border-b border-surface2 hover:bg-surface1 transition-colors" {...props} />
                ),
                th: ({node, ...props}) => (
                  <th className="border border-surface2 px-4 py-2 text-left font-bold text-text" {...props} />
                ),
                td: ({node, ...props}) => (
                  <td className="border border-surface2 px-4 py-2 text-text" {...props} />
                ),
              }}
            >
              {segment.content}
            </ReactMarkdown>
            </div>
          );
        }
      })}
    </div>
  );
};

export default MarkdownRenderer;

