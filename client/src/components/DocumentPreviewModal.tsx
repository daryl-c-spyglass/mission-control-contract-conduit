import { useState, useEffect, useCallback } from 'react';
import { X, Download, ExternalLink, FileText, Image, File, AlertCircle } from 'lucide-react';

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: {
    name: string;
    url: string;
    type?: string;
    fileType?: string;
  } | null;
}

export function DocumentPreviewModal({ isOpen, onClose, document }: DocumentPreviewModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      setError(null);
    }
  }, [isOpen, document?.url]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen || !document) return null;

  const getFileType = (): 'pdf' | 'image' | 'text' | 'office' | 'unknown' => {
    const url = document.url.toLowerCase();
    const type = (document.type || document.fileType || '').toLowerCase();

    if (url.endsWith('.pdf') || type.includes('pdf')) return 'pdf';
    if (url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/) || type.includes('image')) return 'image';
    if (url.match(/\.(txt|md|json|csv)$/) || type.includes('text')) return 'text';
    if (url.match(/\.(doc|docx|xls|xlsx|ppt|pptx)$/)) return 'office';
    return 'unknown';
  };

  const fileType = getFileType();

  const handleDownload = () => {
    const link = window.document.createElement('a');
    link.href = document.url;
    link.download = document.name;
    link.click();
  };

  const handleOpenInNewTab = () => {
    window.open(document.url, '_blank');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      onClick={onClose}
      data-testid="document-preview-modal"
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] 
                   flex flex-col overflow-hidden
                   sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 
                        dark:border-gray-700 bg-gray-50 dark:bg-gray-800 sticky top-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <FileTypeIcon type={fileType} />
            <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
              {document.name}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenInNewTab}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 
                         hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 
                         dark:hover:text-gray-100 dark:hover:bg-gray-700 rounded-lg 
                         transition-colors min-h-[44px] min-w-[44px] justify-center"
              title="Open in new tab"
              data-testid="button-open-new-tab"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">Open</span>
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#EF4923] text-white 
                         hover:bg-[#d43d1c] rounded-lg transition-colors min-h-[44px] 
                         min-w-[44px] justify-center"
              data-testid="button-download"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Download</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 
                         dark:hover:text-gray-300 dark:hover:bg-gray-700
                         rounded-lg transition-colors ml-2 min-h-[44px] min-w-[44px] 
                         flex items-center justify-center"
              data-testid="button-close-modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Preview Content */}
        <div className="flex-1 overflow-hidden bg-gray-100 dark:bg-gray-800 relative">
          {isLoading && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 z-10">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-[#EF4923] border-t-transparent 
                                rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Loading preview...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-md px-4">
                <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                <p className="text-gray-700 dark:text-gray-300 mb-2">Unable to preview this file</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{error}</p>
                <button
                  onClick={handleDownload}
                  className="px-4 py-2 bg-[#EF4923] text-white rounded-lg hover:bg-[#d43d1c]"
                  data-testid="button-download-fallback"
                >
                  Download Instead
                </button>
              </div>
            </div>
          )}

          {/* PDF Preview */}
          {fileType === 'pdf' && !error && (
            <iframe
              src={`${document.url}#toolbar=1&navpanes=0`}
              className="w-full h-full border-0"
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                setError('PDF preview not available');
              }}
              title={document.name}
            />
          )}

          {/* Image Preview */}
          {fileType === 'image' && !error && (
            <div className="h-full flex items-center justify-center p-4 overflow-auto">
              <img
                src={document.url}
                alt={document.name}
                className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  setIsLoading(false);
                  setError('Image failed to load');
                }}
              />
            </div>
          )}

          {/* Text/CSV Preview */}
          {fileType === 'text' && !error && (
            <TextPreview
              url={document.url}
              onLoad={() => setIsLoading(false)}
              onError={(err) => {
                setIsLoading(false);
                setError(err);
              }}
            />
          )}

          {/* Office Documents - Use Google Docs Viewer */}
          {fileType === 'office' && !error && (
            <iframe
              src={`https://docs.google.com/viewer?url=${encodeURIComponent(document.url)}&embedded=true`}
              className="w-full h-full border-0"
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                setError('Document preview not available. Please download to view.');
              }}
              title={document.name}
            />
          )}

          {/* Unknown/Unsupported Format */}
          {fileType === 'unknown' && !error && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-md px-4">
                <File className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Preview Not Available
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  This file type cannot be previewed in the browser.
                  Please download to view.
                </p>
                <button
                  onClick={handleDownload}
                  className="px-4 py-2 bg-[#EF4923] text-white rounded-lg hover:bg-[#d43d1c]"
                  data-testid="button-download-unknown"
                >
                  <Download className="w-4 h-4 inline mr-2" />
                  Download File
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer for PDF */}
        {fileType === 'pdf' && !error && !isLoading && (
          <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 
                          bg-gray-50 dark:bg-gray-800 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Use scroll or PDF controls to navigate pages
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function FileTypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'pdf':
      return (
        <div className="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded flex items-center justify-center">
          <FileText className="w-4 h-4 text-red-600 dark:text-red-400" />
        </div>
      );
    case 'image':
      return (
        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded flex items-center justify-center">
          <Image className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </div>
      );
    case 'office':
      return (
        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded flex items-center justify-center">
          <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </div>
      );
    default:
      return (
        <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center">
          <File className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </div>
      );
  }
}

function TextPreview({
  url,
  onLoad,
  onError,
}: {
  url: string;
  onLoad: () => void;
  onError: (err: string) => void;
}) {
  const [content, setContent] = useState<string>('');

  const stableOnLoad = useCallback(onLoad, []);
  const stableOnError = useCallback(onError, []);

  useEffect(() => {
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load');
        return res.text();
      })
      .then((text) => {
        setContent(text);
        stableOnLoad();
      })
      .catch(() => stableOnError('Failed to load text file'));
  }, [url, stableOnLoad, stableOnError]);

  const isCSV = url.toLowerCase().endsWith('.csv');

  if (isCSV && content) {
    return <CSVTable content={content} />;
  }

  return (
    <pre className="h-full overflow-auto p-4 text-sm font-mono text-gray-800 
                    dark:text-gray-200 whitespace-pre-wrap">
      {content}
    </pre>
  );
}

function CSVTable({ content }: { content: string }) {
  const rows = content.split('\n').map((row) => row.split(','));
  const headers = rows[0] || [];
  const data = rows.slice(1).filter((row) => row.some((cell) => cell.trim()));

  return (
    <div className="h-full overflow-auto p-4">
      <table className="min-w-full border-collapse bg-white dark:bg-gray-900 rounded-lg overflow-hidden">
        <thead>
          <tr className="bg-gray-100 dark:bg-gray-800">
            {headers.map((header, i) => (
              <th
                key={i}
                className="px-4 py-2 text-left text-sm font-medium text-gray-700 
                           dark:text-gray-300 border border-gray-200 dark:border-gray-700"
              >
                {header.trim()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={i}
              className={i % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800/50'}
            >
              {row.map((cell, j) => (
                <td
                  key={j}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 
                             border border-gray-200 dark:border-gray-700"
                >
                  {cell.trim()}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
