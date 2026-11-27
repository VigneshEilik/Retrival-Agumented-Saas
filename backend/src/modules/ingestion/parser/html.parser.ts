import * as cheerio from 'cheerio';
import { MarkdownParser } from './markdown.parser';
import TurndownService from 'turndown';
import { DocumentParser, ParsedDocument } from './parser.interface';

export class HTMLParser implements DocumentParser {
  supportedMimeTypes = ['text/html', 'application/xhtml+xml'];
  supportedExtensions = ['.html', '.htm'];

  canHandle(mimeType: string, extension: string): boolean {
    return (
      this.supportedMimeTypes.includes(mimeType.toLowerCase()) ||
      this.supportedExtensions.includes(extension.toLowerCase())
    );
  }

  async parse(fileBuffer: Buffer, filename: string): Promise<ParsedDocument> {
    const rawHtml = fileBuffer.toString('utf8');
    const $ = cheerio.load(rawHtml);

    // Strip scripts, styles, nav, headers, footers
    $('script, style, nav, footer, header, iframe, noscript').remove();

    const pageTitle = $('title').text().trim() || filename;
    const bodyHtml = $('body').html() || $.html();

    const turndownService = new TurndownService({ headingStyle: 'atx' });
    const markdownText = turndownService.turndown(bodyHtml);

    // Reuse the Markdown parser so <h1>-<h6> headings become sections (section-aware chunks & citations).
    const parsed = await new MarkdownParser().parse(Buffer.from(markdownText, 'utf8'), filename);
    return {
      ...parsed,
      title: pageTitle,
      metadata: { ...(parsed.metadata || {}), rawHtmlLength: rawHtml.length },
    };
  }
}
