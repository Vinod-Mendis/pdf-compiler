import { NextResponse } from 'next/server';
import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFArray,
  PDFNumber,
  PDFHexString,
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
    const sequence = order && order.length === pdfs.length
      ? order
      : pdfs.map((_, i) => i);

    // Create target merged PDF document
    const mergedDoc = await PDFDocument.create();

    // Set Metadata if provided
    if (metadata) {
      if (metadata.title) mergedDoc.setTitle(metadata.title);
      if (metadata.author) mergedDoc.setAuthor(metadata.author);
      if (metadata.subject) mergedDoc.setSubject(metadata.subject);
      if (metadata.producer) mergedDoc.setProducer(metadata.producer);
    }

    // Copy pages from each source PDF in specified order
    for (const index of sequence) {
      const base64Str = pdfs[index];
      if (!base64Str) continue;

      const pdfBuffer = Buffer.from(base64Str, 'base64');
      const srcDoc = await PDFDocument.load(pdfBuffer);
      const copiedPages = await mergedDoc.copyPages(
        srcDoc,
        srcDoc.getPageIndices()
      );

      for (const page of copiedPages) {
        mergedDoc.addPage(page);
      }
    }

    const totalPageCount = mergedDoc.getPageCount();

    // Embed Outline / Bookmarks if TOC entries exist
    if (tocEntries && Array.isArray(tocEntries) && tocEntries.length > 0) {
      const context = mergedDoc.context;

      // Filter and validate entries
      const validEntries = tocEntries.filter(
        (e) => e.title && typeof e.page === 'number' && e.page >= 1 && e.page <= totalPageCount
      );

      if (validEntries.length > 0) {
        const outlinesDictRef = context.nextRef();
        const itemRefs = validEntries.map(() => context.nextRef());

        validEntries.forEach((entry, i) => {
          const pageIndex = entry.page - 1;
          const pageRef = mergedDoc.getPage(pageIndex).ref;

          // Destination array: [pageRef, /Fit]
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

        // Root Outlines dictionary
        const outlinesDict = PDFDict.withContext(context);
        outlinesDict.set(PDFName.of('Type'), PDFName.of('Outlines'));
        outlinesDict.set(PDFName.of('First'), itemRefs[0]);
        outlinesDict.set(PDFName.of('Last'), itemRefs[itemRefs.length - 1]);
        outlinesDict.set(PDFName.of('Count'), PDFNumber.of(validEntries.length));

        context.assign(outlinesDictRef, outlinesDict);

        // Attach Outlines dictionary to document Catalog
        mergedDoc.catalog.set(PDFName.of('Outlines'), outlinesDictRef);

        // Instruct PDF viewer to open outline sidebar by default
        mergedDoc.catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'));
      }
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
      { success: false, error: error.message || 'Failed to merge PDFs' },
      { status: 500 }
    );
  }
}
