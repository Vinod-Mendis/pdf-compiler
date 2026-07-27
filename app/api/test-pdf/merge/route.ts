import { NextResponse } from 'next/server';
import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFArray,
  PDFNumber,
  PDFHexString,
  StandardFonts,
  rgb,
} from '@cantoo/pdf-lib';

export const runtime = 'nodejs';

interface TocEntry {
  title: string;
  page: number; // 1-indexed
}

interface MergeRequest {
  pdfs: string[]; // Base64 PDF strings
  order?: number[]; // Order indices
  metadata?: {
    title?: string;
    author?: string;
    subject?: string;
    producer?: string;
  };
  tocEntries?: TocEntry[];
}

export async function POST(req: Request) {
  try {
    const body: MergeRequest = await req.json();
    const { pdfs, order, metadata, tocEntries } = body;

    if (!pdfs || !Array.isArray(pdfs) || pdfs.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No PDFs provided for merging' },
        { status: 400 }
      );
    }

    // Determine processing order
    const sequence =
      order && order.length === pdfs.length ? order : pdfs.map((_, i) => i);

    // Create target merged PDF document
    const mergedDoc = await PDFDocument.create();

    // Set Metadata if provided
    if (metadata) {
      if (metadata.title) mergedDoc.setTitle(metadata.title);
      if (metadata.author) mergedDoc.setAuthor(metadata.author);
      if (metadata.subject) mergedDoc.setSubject(metadata.subject);
      if (metadata.producer) mergedDoc.setProducer(metadata.producer);
    }

    // Load fonts for rendering printed ToC and footers
    const font = await mergedDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await mergedDoc.embedFont(StandardFonts.HelveticaBold);

    // Read source docs to calculate ToC entries and copy pages
    const sourceDocs: PDFDocument[] = [];
    const sourcePageCounts: number[] = [];
    const autoTocEntries: TocEntry[] = [];

    let cumulativePageOffset = 2; // Page 1 is reserved for the printed ToC page

    for (let i = 0; i < sequence.length; i++) {
      const index = sequence[i];
      const base64Str = pdfs[index];
      if (!base64Str) continue;

      const pdfBuffer = Buffer.from(base64Str, 'base64');
      const srcDoc = await PDFDocument.load(pdfBuffer);
      sourceDocs.push(srcDoc);

      const count = srcDoc.getPageCount();
      sourcePageCounts.push(count);

      const title = srcDoc.getTitle() || `Document Section ${i + 1}`;
      autoTocEntries.push({
        title,
        page: cumulativePageOffset,
      });

      cumulativePageOffset += count;
    }

    // Final list of ToC entries for printing and outlines
    const finalTocEntries =
      tocEntries && tocEntries.length > 0 ? tocEntries : autoTocEntries;

    // 1. Generate printed Table of Contents page (Page 1)
    // Determine page size from first source PDF page or default to A4 (595.28 x 841.89)
    let pageWidth = 595.28;
    let pageHeight = 841.89;
    if (sourceDocs.length > 0 && sourceDocs[0].getPageCount() > 0) {
      const firstSize = sourceDocs[0].getPage(0).getSize();
      pageWidth = firstSize.width;
      pageHeight = firstSize.height;
    }

    const tocPage = mergedDoc.addPage([pageWidth, pageHeight]);

    // Render ToC Header
    const reportTitle = metadata?.title || 'Assembled Report';
    tocPage.drawText('TABLE OF CONTENTS', {
      x: 50,
      y: pageHeight - 70,
      size: 20,
      font: boldFont,
      color: rgb(0.1, 0.15, 0.25),
    });

    tocPage.drawText(reportTitle, {
      x: 50,
      y: pageHeight - 92,
      size: 11,
      font: font,
      color: rgb(0.4, 0.45, 0.5),
    });

    // Horizontal Accent Bar
    tocPage.drawLine({
      start: { x: 50, y: pageHeight - 105 },
      end: { x: pageWidth - 50, y: pageHeight - 105 },
      thickness: 1.5,
      color: rgb(0.2, 0.35, 0.6),
    });

    // Table Column Headers
    tocPage.drawText('SECTION / ELEMENT TITLE', {
      x: 50,
      y: pageHeight - 135,
      size: 9,
      font: boldFont,
      color: rgb(0.35, 0.4, 0.45),
    });

    const pageColLabel = 'PAGE';
    const pageColWidth = boldFont.widthOfTextAtSize(pageColLabel, 9);
    tocPage.drawText(pageColLabel, {
      x: pageWidth - 50 - pageColWidth,
      y: pageHeight - 135,
      size: 9,
      font: boldFont,
      color: rgb(0.35, 0.4, 0.45),
    });

    tocPage.drawLine({
      start: { x: 50, y: pageHeight - 143 },
      end: { x: pageWidth - 50, y: pageHeight - 143 },
      thickness: 0.75,
      color: rgb(0.8, 0.82, 0.85),
    });

    // Render ToC Rows
    let currentY = pageHeight - 175;
    const rowHeight = 28;

    for (const entry of finalTocEntries) {
      if (currentY < 60) break; // Keep within margins

      const pageStr = String(entry.page);
      const pageNumWidth = boldFont.widthOfTextAtSize(pageStr, 11);

      // Section Title
      tocPage.drawText(entry.title, {
        x: 50,
        y: currentY,
        size: 11,
        font: font,
        color: rgb(0.15, 0.15, 0.15),
      });

      // Page Number
      const pageNumX = pageWidth - 50 - pageNumWidth;
      tocPage.drawText(pageStr, {
        x: pageNumX,
        y: currentY,
        size: 11,
        font: boldFont,
        color: rgb(0.15, 0.15, 0.15),
      });

      // Dot Leader Line
      const titleWidth = font.widthOfTextAtSize(entry.title, 11);
      const dotStartX = 50 + titleWidth + 10;
      const dotEndX = pageNumX - 10;

      if (dotEndX > dotStartX) {
        tocPage.drawLine({
          start: { x: dotStartX, y: currentY + 3 },
          end: { x: dotEndX, y: currentY + 3 },
          thickness: 1,
          color: rgb(0.7, 0.72, 0.75),
          dashArray: [2, 4],
        });
      }

      currentY -= rowHeight;
    }

    // 2. Append pages from each source PDF
    for (const srcDoc of sourceDocs) {
      const copiedPages = await mergedDoc.copyPages(
        srcDoc,
        srcDoc.getPageIndices()
      );
      for (const page of copiedPages) {
        mergedDoc.addPage(page);
      }
    }

    const totalPageCount = mergedDoc.getPageCount();

    // 3. Stamp uniform "Page X of Y" footer on bottom right of EVERY page of the merged doc
    for (let i = 0; i < totalPageCount; i++) {
      const page = mergedDoc.getPage(i);
      const { width } = page.getSize();

      const footerText = `Page ${i + 1} of ${totalPageCount}`;
      const footerFontSize = 9;
      const textWidth = font.widthOfTextAtSize(footerText, footerFontSize);
      const rightMargin = 50;
      const x = width - rightMargin - textWidth;
      const y = 25;

      page.drawText(footerText, {
        x,
        y,
        size: footerFontSize,
        font,
        color: rgb(0.4, 0.4, 0.4),
      });
    }

    // 4. Embed Outline / Bookmarks sidebar
    const outlineItems = [
      { title: 'Table of Contents', page: 1 },
      ...finalTocEntries,
    ];

    const validEntries = outlineItems.filter(
      (e) =>
        e.title &&
        typeof e.page === 'number' &&
        e.page >= 1 &&
        e.page <= totalPageCount
    );

    if (validEntries.length > 0) {
      const context = mergedDoc.context;
      const outlinesDictRef = context.nextRef();
      const itemRefs = validEntries.map(() => context.nextRef());

      validEntries.forEach((entry, i) => {
        const pageIndex = entry.page - 1;
        const pageRef = mergedDoc.getPage(pageIndex).ref;

        const destArray = PDFArray.withContext(context);
        destArray.push(pageRef);
        destArray.push(PDFName.of('Fit'));

        const itemDict = PDFDict.withContext(context);
        itemDict.set(PDFName.of('Title'), PDFHexString.fromText(entry.title));
        itemDict.set(PDFName.of('Parent'), outlinesDictRef);
        itemDict.set(PDFName.of('Dest'), destArray);

        if (i > 0) {
          itemDict.set(PDFName.of('Prev'), itemRefs[i - 1]);
        }
        if (i < validEntries.length - 1) {
          itemDict.set(PDFName.of('Next'), itemRefs[i + 1]);
        }

        context.assign(itemRefs[i], itemDict);
      });

      const outlinesDict = PDFDict.withContext(context);
      outlinesDict.set(PDFName.of('Type'), PDFName.of('Outlines'));
      outlinesDict.set(PDFName.of('First'), itemRefs[0]);
      outlinesDict.set(PDFName.of('Last'), itemRefs[itemRefs.length - 1]);
      outlinesDict.set(PDFName.of('Count'), PDFNumber.of(validEntries.length));

      context.assign(outlinesDictRef, outlinesDict);

      mergedDoc.catalog.set(PDFName.of('Outlines'), outlinesDictRef);
      mergedDoc.catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'));
    }

    // Serialize merged PDF
    const mergedPdfBytes = await mergedDoc.save();
    const mergedBase64 = Buffer.from(mergedPdfBytes).toString('base64');

    return NextResponse.json({
      success: true,
      totalPageCount,
      mergedBase64,
    });
  } catch (error: any) {
    console.error('Error merging PDFs:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to merge PDFs',
      },
      { status: 500 }
    );
  }
}

