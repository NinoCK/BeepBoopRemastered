export interface CodeBlock {
  type: 'code';
  language: string;
  code: string;
}

export interface TextSegment {
  type: 'text';
  content: string;
}

export type MessageSegment = CodeBlock | TextSegment;

/**
 * Parses message content to extract code blocks and text segments
 * Handles markdown-style code blocks with ```language or ```
 * Also handles incomplete code blocks during streaming
 */
export function parseCodeBlocks(content: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  const codeBlockRegex = /```(\w[\w-]*)?\n?([\s\S]*?)```/g;
  
  let lastIndex = 0;
  let match;

  // Find all complete code blocks
  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Add text before the code block
    if (match.index > lastIndex) {
      const textContent = content.slice(lastIndex, match.index).trim();
      if (textContent) {
        segments.push({
          type: 'text',
          content: textContent,
        });
      }
    }

    // Extract language and code
    const language = match[1] || 'text';
    const code = match[2].trim();
    
    // Add the code block
    segments.push({
      type: 'code',
      language,
      code,
    });

    lastIndex = match.index + match[0].length;
  }

  // Check if there's an incomplete code block at the end (during streaming)
  const remainingContent = content.slice(lastIndex);
  const incompleteCodeBlockMatch = remainingContent.match(/```(\w[\w-]*)?\n?([\s\S]*)$/);
  
  if (incompleteCodeBlockMatch && incompleteCodeBlockMatch[0].length > 0) {
    // Check if the incomplete block has actual code content (not just opening backticks)
    const potentialCode = incompleteCodeBlockMatch[2]?.trim() || '';
    if (potentialCode.length > 0) {
      // There's an incomplete code block - treat everything from lastIndex as text
      // so it can be re-parsed when more content arrives
      const textBeforeIncomplete = remainingContent.slice(0, incompleteCodeBlockMatch.index).trim();
      if (textBeforeIncomplete) {
        segments.push({
          type: 'text',
          content: textBeforeIncomplete,
        });
      }
      // Add the incomplete code block as text
      segments.push({
        type: 'text',
        content: remainingContent,
      });
      return segments;
    }
  }

  // Add remaining text after the last code block
  if (lastIndex < content.length) {
    const textContent = content.slice(lastIndex).trim();
    if (textContent) {
      segments.push({
        type: 'text',
        content: textContent,
      });
    }
  }

  // If no code blocks found, return entire content as text
  if (segments.length === 0) {
    segments.push({
      type: 'text',
      content: content.trim(),
    });
  }

  return segments;
}

