/**
 * Kleiner Markdown-Teilmenge-Renderer für Produkttexte.
 *
 * Es wird ausschließlich aus dem Eingabetext HTML erzeugt; sämtlicher Text wird
 * vorher escapt. Links sind auf http(s), mailto und relative Ziele beschränkt.
 */

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function safeHref(url: string): string | null {
  const value = url.trim();
  if (/^(https?:\/\/|mailto:|\/|#|\.\.?\/)/i.test(value)) return escapeHtml(value);
  return null;
}

function inline(text: string): string {
  const codes: string[] = [];
  let out = escapeHtml(text).replace(/`([^`\n]+)`/g, (_match, code: string) => {
    codes.push(`<code>${code}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });

  out = out.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (match, label: string, url: string) => {
    const href = safeHref(url);
    return href ? `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>` : label;
  });
  out = out.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  out = out.replace(/(^|[^\w])_([^_\n]+)_(?!_)/g, '$1<em>$2</em>');
  out = out.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');
  out = out.replace(/\u0000(\d+)\u0000/g, (_match, index: string) => codes[Number(index)] ?? '');
  return out.replace(/\n/g, '<br>');
}

/** Rendert Markdown zu sicherem HTML (Absätze, Listen, Überschriften, Zitate, Code). */
export function renderMarkdown(value: string): string {
  const lines = value.replace(/\r\n?/g, '\n').split('\n');
  const blocks: string[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let listTag: 'ul' | 'ol' | null = null;
  let quote: string[] = [];
  let code: string[] = [];
  let inCode = false;

  const flushParagraph = (): void => {
    if (paragraph.length === 0) return;
    blocks.push(`<p>${inline(paragraph.join('\n'))}</p>`);
    paragraph = [];
  };
  const flushList = (): void => {
    if (list.length === 0 || !listTag) return;
    const items = list.map((item) => `<li>${item}</li>`).join('');
    blocks.push(`<${listTag}>${items}</${listTag}>`);
    list = [];
    listTag = null;
  };
  const flushQuote = (): void => {
    if (quote.length === 0) return;
    blocks.push(`<blockquote>${quote.join('<br>')}</blockquote>`);
    quote = [];
  };
  const flushCode = (): void => {
    if (code.length === 0) return;
    blocks.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
    code = [];
  };
  const flushAll = (): void => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        flushAll();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      code.push(line);
      continue;
    }
    if (/^\s*$/.test(line)) {
      flushAll();
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      flushAll();
      const level = heading[1]?.length ?? 3;
      blocks.push(`<h${level}>${inline(heading[2] ?? '')}</h${level}>`);
      continue;
    }
    const unordered = /^\s*[-*]\s+(.+)$/.exec(line);
    const ordered = /^\s*\d+\.\s+(.+)$/.exec(line);
    if (unordered || ordered) {
      flushParagraph();
      flushQuote();
      const tag: 'ul' | 'ol' = unordered ? 'ul' : 'ol';
      if (listTag && listTag !== tag) flushList();
      listTag = tag;
      list.push(inline((unordered ?? ordered)?.[1] ?? ''));
      continue;
    }
    flushList();
    const quoted = /^>\s?(.*)$/.exec(line);
    if (quoted) {
      flushParagraph();
      quote.push(inline(quoted[1] ?? ''));
      continue;
    }
    flushQuote();
    paragraph.push(line);
  }
  if (inCode) flushCode();
  flushAll();
  return blocks.join('\n');
}

/** Entfernt Markdown-Zeichen für Meta-Tags, JSON-LD und Vorschauen. */
export function markdownText(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!?\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/[*_~]/g, '')
    .replace(/^\s*#{1,3}\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}
