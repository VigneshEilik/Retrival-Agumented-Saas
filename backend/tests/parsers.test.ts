import { getParserForFile, PDFParser, TXTParser, MarkdownParser, HTMLParser } from '../src/modules/ingestion/parser';

describe('Document Parsers Module', () => {
  it('should select appropriate parser based on extension and mime type', () => {
    const pdfParser = getParserForFile('application/pdf', '.pdf');
    expect(pdfParser).toBeInstanceOf(PDFParser);

    const txtParser = getParserForFile('text/plain', '.txt');
    expect(txtParser).toBeInstanceOf(TXTParser);
  });

  it('should parse plain text documents correctly', async () => {
    const parser = new TXTParser();
    const buffer = Buffer.from('Hello world! This is plain text document.', 'utf8');
    const result = await parser.parse(buffer, 'test.txt');

    expect(result.title).toBe('test.txt');
    expect(result.text).toContain('Hello world!');
    expect(result.metadata.characterCount).toBe(result.text.length);
  });

  it('should parse Markdown documents preserving heading sections', async () => {
    const parser = new MarkdownParser();
    const mdContent = `# Company Policy\n\nAnnual leave requires approval.\n\n## Remote Work\n\nEmployees can work remotely 2 days per week.`;
    const buffer = Buffer.from(mdContent, 'utf8');
    const result = await parser.parse(buffer, 'policy.md');

    expect(result.sections).toBeDefined();
    expect(result.sections!.length).toBe(2);
    expect(result.sections![0].title).toBe('Company Policy');
    expect(result.sections![1].title).toBe('Remote Work');
  });

  it('should parse HTML documents stripping scripts and nav tags', async () => {
    const parser = new HTMLParser();
    const htmlContent = `<html><head><title>FAQ Page</title></head><body><nav><a href="#">Link</a></nav><script>console.log(1)</script><h1>FAQ</h1><p>Frequently asked questions content.</p></body></html>`;
    const buffer = Buffer.from(htmlContent, 'utf8');
    const result = await parser.parse(buffer, 'faq.html');

    expect(result.title).toBe('FAQ Page');
    expect(result.text).not.toContain('console.log');
    expect(result.text).toContain('Frequently asked questions content.');
  });
});
