import { StructureAwareChunker, normalizeText } from '../src/modules/ingestion/chunker';
import { ParsedDocument } from '../src/modules/ingestion/parser';

describe('Text Normalizer & Structure-Aware Chunker', () => {
  it('should normalize Unicode, newlines, and remove non-printable characters', () => {
    const raw = 'Header\r\n\r\nLine 1\x00\x07\n\n\nLine 2';
    const normalized = normalizeText(raw);
    expect(normalized).toBe('Header\n\nLine 1\n\nLine 2');
  });

  it('should chunk document preserving page numbers when pages exist', () => {
    const chunker = new StructureAwareChunker();
    const doc: ParsedDocument = {
      title: 'manual.pdf',
      text: 'Page 1 text. Page 2 text.',
      metadata: {},
      pages: [
        { pageNumber: 1, text: 'This is the full text content of Page 1 in the PDF user manual.' },
        { pageNumber: 2, text: 'This is the full text content of Page 2 in the PDF user manual.' },
      ],
    };

    const chunks = chunker.chunk(doc, { chunkSize: 200, chunkOverlap: 20 });
    expect(chunks.length).toBe(2);
    expect(chunks[0].metadata.pageNumber).toBe(1);
    expect(chunks[1].metadata.pageNumber).toBe(2);
  });

  it('should chunk document preserving section titles when sections exist', () => {
    const chunker = new StructureAwareChunker();
    const doc: ParsedDocument = {
      title: 'guide.md',
      text: 'Section 1. Section 2.',
      metadata: {},
      sections: [
        { title: 'Security Protocol', text: 'All API calls require HTTPS and JWT authentication tokens.' },
        { title: 'Data Retention', text: 'Data is retained for 90 days before automated archiving.' },
      ],
    };

    const chunks = chunker.chunk(doc, { chunkSize: 200, chunkOverlap: 20 });
    expect(chunks.length).toBe(2);
    expect(chunks[0].metadata.sectionTitle).toBe('Security Protocol');
    expect(chunks[1].metadata.sectionTitle).toBe('Data Retention');
  });

  // Regression tests for v1.0.0 release defects (infinite loop / dropped text).
  const words = (n: number, prefix: string) => Array.from({ length: n }, (_, i) => `${prefix}${i}`).join(' ');
  const coverAllWords = (input: string, chunks: Array<{ content: string }>) => {
    const indexed = new Set(chunks.flatMap((c) => c.content.split(/\s+/)));
    return input.split(/\s+/).filter(Boolean).every((w) => indexed.has(w));
  };

  it('terminates when a paragraph break is followed by a long paragraph without breaks', () => {
    const text = `${words(150, 'a')}\n\n${words(400, 'b')}`; // ~900 chars, then ~2000 chars
    const chunks = new StructureAwareChunker().chunk({ title: 't', text } as ParsedDocument);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.length).toBeLessThan(20);
    expect(coverAllWords(text, chunks)).toBe(true);
  });

  it('does not drop text when the first boundary is near the start of the document', () => {
    const text = `Short heading line here\n\n${words(500, 'w')}`; // early break, then ~2000+ chars
    const chunks = new StructureAwareChunker().chunk({ title: 't', text } as ParsedDocument);
    expect(coverAllWords(text, chunks)).toBe(true);
    const indexedChars = chunks.reduce((n, c) => n + c.content.length, 0);
    expect(indexedChars).toBeGreaterThanOrEqual(text.length * 0.95);
  });

  it('always makes progress, even for text with no spaces at all', () => {
    const text = 'x'.repeat(5000);
    const chunks = new StructureAwareChunker().chunk({ title: 't', text } as ParsedDocument);
    expect(chunks.length).toBeGreaterThanOrEqual(5);
    expect(chunks.length).toBeLessThan(10);
  });

  it('covers every word for many randomised paragraph layouts', () => {
    let seed = 42;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let trial = 0; trial < 50; trial++) {
      const paragraphs = Array.from({ length: 1 + Math.floor(rand() * 8) }, (_, p) =>
        words(1 + Math.floor(rand() * 300), `t${trial}p${p}w`)
      );
      const text = paragraphs.join(rand() > 0.5 ? '\n\n' : '. ');
      const chunks = new StructureAwareChunker().chunk({ title: 't', text } as ParsedDocument);
      expect(coverAllWords(text, chunks)).toBe(true);
    }
  });
});
