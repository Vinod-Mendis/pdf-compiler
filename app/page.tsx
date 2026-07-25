'use client';

import { useState, useRef } from 'react';
import PDFViewerWrapper from './components/PDFViewerWrapper';

interface PdfItem {
  id: string;
  title: string;
  filename?: string;
  sizeBytes?: number;
  pageCount: number;
  base64: string;
}

interface TocItem {
  id: string;
  title: string;
  page: number;
}

interface MetadataState {
  title: string;
  author: string;
  subject: string;
  producer: string;
}

export default function Home() {
  // Uploaded PDF Items
  const [pdfItems, setPdfItems] = useState<PdfItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Metadata State
  const [metadata, setMetadata] = useState<MetadataState>({
    title: 'Merged Document',
    author: 'FLYXTO PDF Suite',
    subject: 'PDF Outline & TOC',
    producer: '@cantoo/pdf-lib',
  });

  // Table of Contents State
  const [tocEntries, setTocEntries] = useState<TocItem[]>([]);

  // Merge State
  const [isMerging, setIsMerging] = useState(false);
  const [mergedPdfBase64, setMergedPdfBase64] = useState<string | null>(null);
  const [mergedPageCount, setMergedPageCount] = useState<number | null>(null);
  const [mergedBlobUrl, setMergedBlobUrl] = useState<string | null>(null);
  const [mergeError, setMergeError] = useState<string | null>(null);

  // Auto recalculate TOC entries when PDF list or order changes
  function updateTocSuggestions(items: PdfItem[]) {
    let cumulativePage = 1;
    const suggested: TocItem[] = items.map((pdf, idx) => {
      const entry = {
        id: String(idx + 1),
        title: pdf.title || `Section ${idx + 1}`,
        page: cumulativePage,
      };
      cumulativePage += pdf.pageCount;
      return entry;
    });
    setTocEntries(suggested);
  }

  // Handle Upload PDF Files
  async function handleFilesSelected(files: FileList | File[]) {
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    setSourceError(null);

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    try {
      const res = await fetch('/api/test-pdf/parse', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to parse uploaded PDFs');

      const updated = [...pdfItems, ...data.pdfs];
      setPdfItems(updated);
      updateTocSuggestions(updated);
    } catch (err: any) {
      setSourceError(err.message || 'Error processing uploaded PDFs');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // Reorder Item Up/Down
  function handleMoveItem(index: number, direction: 'up' | 'down') {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= pdfItems.length) return;

    const newItems = [...pdfItems];
    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;

    setPdfItems(newItems);
    updateTocSuggestions(newItems);
  }

  // Remove Item
  function handleRemoveItem(index: number) {
    const newItems = pdfItems.filter((_, i) => i !== index);
    setPdfItems(newItems);
    updateTocSuggestions(newItems);
  }

  // TOC Rows Management
  function handleAddTocRow() {
    const nextId = String(Date.now());
    const lastPage = tocEntries.length > 0 ? tocEntries[tocEntries.length - 1].page + 1 : 1;
    setTocEntries([...tocEntries, { id: nextId, title: `Bookmark ${tocEntries.length + 1}`, page: lastPage }]);
  }

  function handleRemoveTocRow(id: string) {
    setTocEntries(tocEntries.filter((item) => item.id !== id));
  }

  function handleTocChange(id: string, field: 'title' | 'page', value: string | number) {
    setTocEntries(
      tocEntries.map((item) => {
        if (item.id === id) return { ...item, [field]: value };
        return item;
      })
    );
  }

  // Merge Action
  async function handleMergePdfs() {
    if (pdfItems.length === 0) {
      alert('Please upload PDFs first!');
      return;
    }

    setIsMerging(true);
    setMergeError(null);
    try {
      const res = await fetch('/api/test-pdf/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfs: pdfItems.map((p) => p.base64),
          metadata,
          tocEntries: tocEntries.map((t) => ({ title: t.title, page: Number(t.page) })),
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to merge PDFs');

      setMergedPdfBase64(data.mergedBase64);
      setMergedPageCount(data.totalPageCount);

      const binaryStr = atob(data.mergedBase64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setMergedBlobUrl(url);
    } catch (err: any) {
      setMergeError(err.message || 'Error merging PDFs');
    } finally {
      setIsMerging(false);
    }
  }

  const totalInputPages = pdfItems.reduce((sum, item) => sum + item.pageCount, 0);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <header className="border-b border-zinc-200 dark:border-zinc-800 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                PDF Merge & Table of Contents Suite
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Upload PDFs, reorder sections, edit metadata, and generate a merged PDF with native embedded bookmarks.
              </p>
            </div>
          </div>
        </header>

        {/* Section 1: PDF Files Source Panel */}
        <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/80 pb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              1. Upload PDFs
            </h2>
            {pdfItems.length > 0 && (
              <span className="text-xs font-mono text-zinc-500">
                {pdfItems.length} file{pdfItems.length > 1 ? 's' : ''} • {totalInputPages} total pages
              </span>
            )}
          </div>

          {sourceError && (
            <div className="p-3 text-xs font-mono bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 rounded-md border border-red-200 dark:border-red-900">
              {sourceError}
            </div>
          )}

          {/* Upload Dropzone */}
          <div className="space-y-3">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files) handleFilesSelected(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              className="border border-dashed border-zinc-300 dark:border-zinc-700 hover:border-zinc-500 dark:hover:border-zinc-500 bg-zinc-50 dark:bg-zinc-950 rounded-md p-6 text-center cursor-pointer transition focus:outline-none focus:ring-2 focus:ring-zinc-950 dark:focus:ring-zinc-100"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                multiple
                onChange={(e) => e.target.files && handleFilesSelected(e.target.files)}
                className="hidden"
              />
              <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                Select or drag & drop PDF files
              </span>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                Upload PDF documents to merge and generate embedded bookmarks
              </p>
              {isProcessing && (
                <div className="flex items-center justify-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 mt-2">
                  <div className="w-3.5 h-3.5 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />
                  Parsing PDF page counts...
                </div>
              )}
            </div>
          </div>

          {/* List of Files */}
          {pdfItems.length > 0 && (
            <div className="space-y-2">
              {pdfItems.map((item, idx) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 p-2.5 bg-zinc-50 dark:bg-zinc-950 rounded-md border border-zinc-200 dark:border-zinc-800 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="font-mono text-zinc-400 text-[11px] w-4 text-center">{idx + 1}</span>
                    <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate">
                      {item.title}
                    </span>
                    {item.filename && item.filename !== item.title && (
                      <span className="text-zinc-500 text-[11px] truncate">({item.filename})</span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono text-zinc-600 dark:text-zinc-400 text-[11px] bg-zinc-200/60 dark:bg-zinc-800 px-2 py-0.5 rounded-md border border-zinc-300/50 dark:border-zinc-700">
                      {item.pageCount} pages
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleMoveItem(idx, 'up')}
                        disabled={idx === 0}
                        className="px-1.5 py-0.5 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 text-zinc-700 dark:text-zinc-300 text-[11px] rounded-md border border-zinc-200 dark:border-zinc-800 transition focus:outline-none focus:ring-2 focus:ring-zinc-950"
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => handleMoveItem(idx, 'down')}
                        disabled={idx === pdfItems.length - 1}
                        className="px-1.5 py-0.5 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 text-zinc-700 dark:text-zinc-300 text-[11px] rounded-md border border-zinc-200 dark:border-zinc-800 transition focus:outline-none focus:ring-2 focus:ring-zinc-950"
                        title="Move down"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => handleRemoveItem(idx)}
                        className="px-1.5 py-0.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-[11px] rounded-md transition focus:outline-none focus:ring-2 focus:ring-red-500"
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section 2: Metadata Form */}
        <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md p-5 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800/80 pb-3">
            2. Document Metadata
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">Title</label>
              <input
                type="text"
                value={metadata.title}
                onChange={(e) => setMetadata({ ...metadata, title: e.target.value })}
                className="w-full px-3 py-1.5 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-md text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-950 dark:focus:ring-zinc-100 transition"
              />
            </div>
            <div>
              <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">Author</label>
              <input
                type="text"
                value={metadata.author}
                onChange={(e) => setMetadata({ ...metadata, author: e.target.value })}
                className="w-full px-3 py-1.5 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-md text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-950 dark:focus:ring-zinc-100 transition"
              />
            </div>
            <div>
              <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">Subject</label>
              <input
                type="text"
                value={metadata.subject}
                onChange={(e) => setMetadata({ ...metadata, subject: e.target.value })}
                className="w-full px-3 py-1.5 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-md text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-950 dark:focus:ring-zinc-100 transition"
              />
            </div>
            <div>
              <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">Producer</label>
              <input
                type="text"
                value={metadata.producer}
                onChange={(e) => setMetadata({ ...metadata, producer: e.target.value })}
                className="w-full px-3 py-1.5 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-md text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-950 dark:focus:ring-zinc-100 transition"
              />
            </div>
          </div>
        </section>

        {/* Section 3: Table of Contents Rows */}
        <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/80 pb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              3. Outline / Bookmarks (TOC)
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateTocSuggestions(pdfItems)}
                disabled={pdfItems.length === 0}
                className="px-2.5 py-1 text-xs font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-40 text-zinc-700 dark:text-zinc-300 rounded-md border border-zinc-300 dark:border-zinc-700 transition focus:outline-none focus:ring-2 focus:ring-zinc-950"
              >
                Reset Start Pages
              </button>
              <button
                onClick={handleAddTocRow}
                className="px-2.5 py-1 text-xs font-medium bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 rounded-md transition focus:outline-none focus:ring-2 focus:ring-zinc-950"
              >
                + Add Row
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {tocEntries.map((row, idx) => (
              <div key={row.id} className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-950 p-2 rounded-md border border-zinc-200 dark:border-zinc-800 text-xs">
                <span className="font-mono text-zinc-400 w-5 text-center">{idx + 1}</span>
                <input
                  type="text"
                  placeholder="Bookmark Title"
                  value={row.title}
                  onChange={(e) => handleTocChange(row.id, 'title', e.target.value)}
                  className="flex-1 px-2.5 py-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-md text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-950 dark:focus:ring-zinc-100 transition"
                />
                <div className="flex items-center gap-1">
                  <span className="text-zinc-500 text-[11px]">Page</span>
                  <input
                    type="number"
                    min={1}
                    max={totalInputPages || 100}
                    value={row.page}
                    onChange={(e) => handleTocChange(row.id, 'page', Number(e.target.value))}
                    className="w-14 px-2 py-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-md text-zinc-900 dark:text-zinc-100 font-mono text-center focus:outline-none focus:ring-2 focus:ring-zinc-950 dark:focus:ring-zinc-100 transition"
                  />
                </div>
                <button
                  onClick={() => handleRemoveTocRow(row.id)}
                  disabled={tocEntries.length <= 1}
                  className="px-2 py-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-30 rounded-md transition focus:outline-none focus:ring-2 focus:ring-red-500"
                  title="Remove row"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Section 4: Primary Merge Action Panel */}
        <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              4. Execute Server Merge
            </h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
              Appends pages and serializes low-level <code className="font-mono text-zinc-800 dark:text-zinc-200">/Outlines</code> dictionary.
            </p>
          </div>

          <button
            onClick={handleMergePdfs}
            disabled={isMerging || pdfItems.length === 0}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-md transition disabled:opacity-50 flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
          >
            {isMerging && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {isMerging ? 'Merging & Embedding...' : 'Merge & Embed Outline'}
          </button>

          {mergeError && (
            <div className="w-full p-3 text-xs font-mono bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 rounded-md border border-red-200 dark:border-red-900">
              {mergeError}
            </div>
          )}
        </section>

        {/* Section 5: Verification & Output Panel */}
        {mergedPdfBase64 && mergedBlobUrl && (
          <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800/80 pb-3">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  5. Merged Output & Verification
                </h2>
                <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 font-mono">
                  <span>Server total pages: {mergedPageCount}</span>
                  <span>•</span>
                  <span>Input pages: {totalInputPages}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={mergedBlobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 text-xs font-medium rounded-md border border-zinc-300 dark:border-zinc-700 transition focus:outline-none focus:ring-2 focus:ring-zinc-950"
                >
                  Open in External Tab
                </a>
                <a
                  href={mergedBlobUrl}
                  download="merged-outline-doc.pdf"
                  className="px-3 py-1.5 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-medium rounded-md transition focus:outline-none focus:ring-2 focus:ring-zinc-950"
                >
                  Download PDF
                </a>
              </div>
            </div>

            {/* In-App Viewer */}
            <PDFViewerWrapper pdfUrl={mergedBlobUrl} expectedPageCount={mergedPageCount || undefined} />
          </section>
        )}

      </div>
    </div>
  );
}
