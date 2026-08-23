import React from 'react'
import ReactMarkdown from 'react-markdown'

export default function MarkdownView({ content, style = {}, isMono = false }) {
  if (!content) return null

  return (
    <div style={{ ...style, wordBreak: 'break-word' }}>
      <ReactMarkdown
        components={{
          p: ({ children }) => <p style={{ margin: '4px 0', lineHeight: 1.6 }}>{children}</p>,
          strong: ({ children }) => <strong style={{ fontWeight: 800, color: '#000' }}>{children}</strong>,
          em: ({ children }) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
          code: ({ node, inline, className, children, ...props }) => {
            // Check if inline or block code
            const isCodeBlock = !inline && typeof children === 'string' && children.includes('\n')
            if (!isCodeBlock && inline !== false) {
              return (
                <code
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.88em',
                    background: '#f1f5f9',
                    color: '#4338ca',
                    padding: '2px 6px',
                    borderRadius: 3,
                    border: '1.5px solid #cbd5e1',
                    fontWeight: 700,
                    margin: '0 2px',
                  }}
                  {...props}
                >
                  {children}
                </code>
              )
            }
            return (
              <pre
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  background: '#0f172a',
                  color: '#e2e8f0',
                  padding: '10px 14px',
                  borderRadius: 4,
                  border: '2px solid #000',
                  boxShadow: '2px 2px 0px #000',
                  overflowX: 'auto',
                  margin: '8px 0',
                }}
              >
                <code>{children}</code>
              </pre>
            )
          },
          ul: ({ children }) => <ul style={{ paddingLeft: 20, margin: '6px 0' }}>{children}</ul>,
          ol: ({ children }) => <ol style={{ paddingLeft: 20, margin: '6px 0' }}>{children}</ol>,
          li: ({ children }) => <li style={{ margin: '3px 0', lineHeight: 1.5 }}>{children}</li>,
          blockquote: ({ children }) => (
            <blockquote
              style={{
                borderLeft: '4px solid var(--neo-pink)',
                paddingLeft: 10,
                margin: '8px 0',
                color: '#475569',
                fontStyle: 'italic',
              }}
            >
              {children}
            </blockquote>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
