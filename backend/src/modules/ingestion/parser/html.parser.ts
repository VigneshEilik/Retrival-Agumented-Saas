import * as cheerio from 'cheerio';
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

    const turndownService = new TurndownService();
    const markdownText = turndownService.turndown(bodyHtml);

    return {
      title: pageTitle,
      text: markdownText,
      metadata: {
        rawHtmlLength: rawHtml.length,
      },
    };
  }
}
