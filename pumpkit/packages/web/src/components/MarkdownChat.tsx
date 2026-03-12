import { useState } from 'react';

/* ── Markdown → chat-bubble renderer ──────────────────────────────
 * Converts raw markdown text into Telegram-style chat bubbles.
 * Each H2 section becomes a separate bubble. Code blocks get copy
 * buttons. Inline code, bold, italic, links, and lists are handled.
 */

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="absolute top-2 right-2 text-xs bg-tg-input/80 hover:bg-tg-input text-zinc-400 hover:text-tg-blue px-2 py-1 rounded transition"
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  );
}

function BotBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 items-start max-w-[85%] mr-auto">
      <div className="w-8 h-8 rounded-full bg-tg-input flex items-center justify-center text-sm shrink-0 mt-1">
        📖
      </div>
      <div className="bg-tg-bubble-in rounded-2xl rounded-bl-sm px-4 py-3 text-white flex-1 min-w-0">
        <p className="text-tg-blue text-sm font-medium mb-1">PumpKit Docs</p>
        {children}
      </div>
    </div>
  );
}

// ── Inline markdown parsing ──────────────────────────────────────

function parseInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Match: **bold**, *italic*, `code`, [text](url)
  const pattern = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      nodes.push(<strong key={match.index} className="font-semibold text-white">{match[2]}</strong>);
    } else if (match[3]) {
      nodes.push(<em key={match.index} className="italic text-zinc-300">{match[3]}</em>);
    } else if (match[4]) {
      nodes.push(
        <code key={match.index} className="bg-tg-input rounded px-1.5 py-0.5 text-xs font-mono text-tg-blue">
          {match[4]}
        </code>,
      );
    } else if (match[5] && match[6]) {
      const href = match[6];
      // Only render external links
      if (href.startsWith('http')) {
        nodes.push(
          <a key={match.index} href={href} target="_blank" rel="noopener noreferrer" className="text-tg-blue hover:underline">
            {match[5]}
          </a>,
        );
      } else {
        nodes.push(<span key={match.index} className="text-tg-blue">{match[5]}</span>);
      }
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

// ── Block-level markdown parsing ─────────────────────────────────

interface Block {
  type: 'heading' | 'code' | 'blockquote' | 'list' | 'paragraph';
  content: string;
  lang?: string;
  level?: number;
  items?: string[];
}

function parseBlocks(markdown: string): Block[] {
  const lines = markdown.split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    // Skip empty lines
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Fenced code block
    const codeMatch = line.match(/^```(\w*)/);
    if (codeMatch) {
      const lang = codeMatch[1] || '';
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.startsWith('```')) {
        codeLines.push(lines[i]!);
        i++;
      }
      i++; // skip closing ```
      blocks.push({ type: 'code', content: codeLines.join('\n'), lang });
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,4})\s+(.+)/);
    if (headingMatch) {
      blocks.push({ type: 'heading', content: headingMatch[2]!, level: headingMatch[1]!.length });
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i]!.startsWith('>')) {
        quoteLines.push(lines[i]!.replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({ type: 'blockquote', content: quoteLines.join(' ') });
      continue;
    }

    // Unordered list
    if (line.match(/^[-*]\s/)) {
      const items: string[] = [];
      while (i < lines.length && lines[i]!.match(/^[-*]\s/)) {
        items.push(lines[i]!.replace(/^[-*]\s+/, ''));
        i++;
      }
      blocks.push({ type: 'list', content: '', items });
      continue;
    }

    // Ordered list
    if (line.match(/^\d+\.\s/)) {
      const items: string[] = [];
      while (i < lines.length && lines[i]!.match(/^\d+\.\s/)) {
        items.push(lines[i]!.replace(/^\d+\.\s+/, ''));
        i++;
      }
      blocks.push({ type: 'list', content: '', items });
      continue;
    }

    // Regular paragraph — collect consecutive non-empty, non-special lines
    const paraLines: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i]!.trim() !== '' &&
      !lines[i]!.match(/^[#>```\-*]/) &&
      !lines[i]!.match(/^\d+\.\s/)
    ) {
      paraLines.push(lines[i]!);
      i++;
    }
    blocks.push({ type: 'paragraph', content: paraLines.join(' ') });
  }

  return blocks;
}

function BlockRenderer({ block }: { block: Block }) {
  switch (block.type) {
    case 'heading': {
      const size = block.level === 1 ? 'text-base' : block.level === 2 ? 'text-[15px]' : 'text-sm';
      const content = parseInline(block.content);
      if (block.level === 1) return <h2 className={`font-semibold ${size} mt-2 mb-1`}>{content}</h2>;
      if (block.level === 2) return <h3 className={`font-semibold ${size} mt-2 mb-1`}>{content}</h3>;
      return <h4 className={`font-semibold ${size} mt-2 mb-1`}>{content}</h4>;
    }
    case 'code':
      return (
        <div className="bg-[#1a2332] rounded-lg p-3 font-mono text-sm text-zinc-300 overflow-x-auto my-2 relative">
          <CopyButton text={block.content} />
          <pre className="whitespace-pre">{block.content}</pre>
        </div>
      );
    case 'blockquote':
      return (
        <div className="border-l-2 border-tg-blue/40 pl-3 my-2 text-sm text-zinc-400 italic">
          {parseInline(block.content)}
        </div>
      );
    case 'list':
      return (
        <ul className="text-sm text-zinc-300 space-y-0.5 my-1">
          {block.items?.map((item, idx) => (
            <li key={idx}>• {parseInline(item)}</li>
          ))}
        </ul>
      );
    case 'paragraph':
      return <p className="text-sm text-zinc-300 leading-relaxed my-1">{parseInline(block.content)}</p>;
    default:
      return null;
  }
}

// ── Split markdown into sections (by H2) and render as bubbles ───

interface Section {
  title: string;
  blocks: Block[];
}

function splitIntoSections(blocks: Block[]): Section[] {
  const sections: Section[] = [];
  let current: Section = { title: '', blocks: [] };

  for (const block of blocks) {
    if (block.type === 'heading' && block.level && block.level <= 2) {
      if (current.blocks.length > 0 || current.title) {
        sections.push(current);
      }
      current = { title: block.content, blocks: [] };
    } else {
      current.blocks.push(block);
    }
  }
  if (current.blocks.length > 0 || current.title) {
    sections.push(current);
  }
  return sections;
}

// ── Public component ─────────────────────────────────────────────

interface MarkdownChatProps {
  markdown: string;
  title: string;
  emoji?: string;
}

export function MarkdownChat({ markdown, title, emoji = '📖' }: MarkdownChatProps) {
  const blocks = parseBlocks(markdown);
  const sections = splitIntoSections(blocks);

  return (
    <div className="flex flex-col gap-3 p-4 max-w-3xl mx-auto pb-20 bubble-stagger">
      {/* Date separator */}
      <div className="text-center">
        <span className="bg-tg-input/80 text-zinc-400 text-xs px-3 py-1 rounded-full">
          {emoji} {title}
        </span>
      </div>

      {sections.map((section, idx) => (
        <BotBubble key={idx}>
          {section.title && (
            <p className="font-semibold text-base mb-2">{section.title}</p>
          )}
          {section.blocks.map((block, bidx) => (
            <BlockRenderer key={bidx} block={block} />
          ))}
        </BotBubble>
      ))}
    </div>
  );
}
