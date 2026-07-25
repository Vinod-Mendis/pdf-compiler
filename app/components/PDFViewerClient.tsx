'use client';

import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerClientProps {
  pdfUrl: string;
  expectedPageCount?: number;
}

export default function PDFViewerClient({ pdfUrl, expectedPageCount }: PDFViewerClientProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setPageNumber(1);
    setLoading(false);
  }

  function onDocumentLoadError(err: Error) {
    console.error('Error loading PDF in react-pdf:', err);
    setError(err.message || 'Failed to render PDF');
    setLoading(false);
  }

  return (
    <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md p-4 space-y-4">
      {/* Header controls bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-zinc-800 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-medium text-zinc-900 dark:text-zinc-100">In-App Viewer (react-pdf)</span>
          {numPages && (
            <span className="px-2 py-0.5 font-mono text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md">
              {numPages} pages {expectedPageCount ? `(expected: ${expectedPageCount})` : ''}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setPageNumber((p) => Math.max(p - 1, 1))}
            disabled={pageNumber <= 1}
            className="px-2.5 py-1 font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 disabled:opacity-40 text-zinc-800 dark:text-zinc-200 rounded-md border border-zinc-200 dark:border-zinc-700 transition focus:outline-none focus:ring-2 focus:ring-zinc-950 dark:focus:ring-zinc-100"
          >
            Prev
          </button>
          <span className="font-mono text-zinc-600 dark:text-zinc-400 px-1">
            {pageNumber} / {numPages || '--'}
          </span>
          <button
            onClick={() => setPageNumber((p) => Math.min(p + 1, numPages || 1))}
            disabled={!numPages || pageNumber >= numPages}
            className="px-2.5 py-1 font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 disabled:opacity-40 text-zinc-800 dark:text-zinc-200 rounded-md border border-zinc-200 dark:border-zinc-700 transition focus:outline-none focus:ring-2 focus:ring-zinc-950 dark:focus:ring-zinc-100"
          >
            Next
          </button>

          <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-1" />

          <button
            onClick={() => setScale((s) => Math.max(s - 0.2, 0.6))}
            className="px-2 py-1 font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-md border border-zinc-200 dark:border-zinc-700 transition focus:outline-none focus:ring-2 focus:ring-zinc-950 dark:focus:ring-zinc-100"
          >
            -
          </button>
          <span className="font-mono text-zinc-500 text-[11px] px-1">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScale((s) => Math.min(s + 0.2, 2.0))}
            className="px-2 py-1 font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-md border border-zinc-200 dark:border-zinc-700 transition focus:outline-none focus:ring-2 focus:ring-zinc-950 dark:focus:ring-zinc-100"
          >
            +
          </button>
        </div>
      </div>

      {/* Canvas container */}
      <div className="flex flex-col items-center justify-center min-h-[320px] w-full bg-zinc-50 dark:bg-zinc-950 rounded-md p-4 border border-zinc-200 dark:border-zinc-800 overflow-auto">
        {loading && (
          <div className="flex items-center gap-2 text-xs text-zinc-500 py-12">
            <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
            Rendering PDF with react-pdf...
          </div>
        )}

        {error && (
          <div className="p-3 text-xs font-mono bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 rounded-md border border-red-200 dark:border-red-900">
            {error}
          </div>
        )}

        <Document
          file={pdfUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading=""
          className="flex flex-col items-center"
        >
          {numPages && (
            <Page
              pageNumber={pageNumber}
              scale={scale}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              className="border border-zinc-300 dark:border-zinc-700 rounded-md overflow-hidden"
            />
          )}
        </Document>
      </div>
    </div>
  );
}
