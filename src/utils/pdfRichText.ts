/**
 * Splits the free text typed in briefings and service descriptions into
 * paragraphs and titled bullet lists, so the PDF can lay lists out as boxes
 * or columns. Example input:
 *
 *   Texto do briefing...
 *
 *   Observações Importantes:
 *   - item 1
 *   - item 2
 */
export type RichBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'list'; title: string | null; items: string[] };

const BULLET = /^\s*(?:[-•*–]|\d+[.)])\s+/;

export function parseRichText(text: string | null | undefined): RichBlock[] {
  if (!text?.trim()) return [];
  const blocks: RichBlock[] = [];
  const lines = text.replace(/\r\n?/g, '\n').split('\n');

  let paragraph: string[] = [];
  let list: { title: string | null; items: string[] } | null = null;

  const flushParagraph = () => {
    const joined = paragraph.join('\n').trim();
    if (joined) blocks.push({ type: 'paragraph', text: joined });
    paragraph = [];
  };
  const flushList = () => {
    if (list && list.items.length) blocks.push({ type: 'list', ...list });
    list = null;
  };

  lines.forEach((raw) => {
    const line = raw.trim();
    if (!line) {
      flushParagraph();
      flushList();
      return;
    }
    if (BULLET.test(line)) {
      if (!list) {
        // A short line right before the first bullet is the list title
        const last = paragraph[paragraph.length - 1];
        const title = last && last.length <= 60 ? paragraph.pop()!.trim() : null;
        flushParagraph();
        list = { title: title ? title.replace(/:\s*$/, '') : null, items: [] };
      }
      list.items.push(line.replace(BULLET, '').trim());
      return;
    }
    if (list) {
      // Continuation of the previous bullet when indented, otherwise a new block
      if (/^\s+/.test(raw) && list.items.length) {
        list.items[list.items.length - 1] += ` ${line}`;
        return;
      }
      flushList();
    }
    paragraph.push(line);
  });

  flushParagraph();
  flushList();
  return blocks;
}
