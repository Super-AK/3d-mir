import { describe, expect, it } from 'vitest';
import { markdownText, renderMarkdown } from '../../src/lib/markdown.js';

describe('Markdown für Produkttexte', () => {
  it('rendert Absätze, Fett, Kursiv und Zeilenumbrüche', () => {
    const html = renderMarkdown('Hallo **Welt** und _Kurs_\nzweite Zeile\n\nNeuer Absatz.');
    expect(html).toContain('<p>Hallo <strong>Welt</strong> und <em>Kurs</em><br>zweite Zeile</p>');
    expect(html).toContain('<p>Neuer Absatz.</p>');
  });

  it('rendert Überschriften, Listen, Zitate und Code', () => {
    const html = renderMarkdown('## Titel\n\n- eins\n- zwei\n\n> Hinweis\n\n```\n<code>\n```');
    expect(html).toContain('<h2>Titel</h2>');
    expect(html).toContain('<ul><li>eins</li><li>zwei</li></ul>');
    expect(html).toContain('<blockquote>Hinweis</blockquote>');
    expect(html).toContain('<pre><code>&lt;code&gt;</code></pre>');
  });

  it('escapt HTML und lässt nur sichere Links zu', () => {
    const html = renderMarkdown('<script>alert(1)</script>\n\n[Klick](https://example.de) [Böse](javascript:alert(1))');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('<a href="https://example.de" target="_blank" rel="noopener noreferrer">Klick</a>');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('Böse');
  });

  it('erlaubt relative Links und mailto', () => {
    expect(renderMarkdown('[Versand](/versand/)')).toContain('href="/versand/"');
    expect(renderMarkdown('[Mail](mailto:info@example.de)')).toContain('href="mailto:info@example.de"');
  });

  it('liefert für Meta-Tags reinen Text ohne Markdown-Zeichen', () => {
    expect(markdownText('**Fett** und [Link](/versand/) mit `Code`')).toBe('Fett und Link mit Code');
  });
});
