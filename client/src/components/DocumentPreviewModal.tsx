import { useState, useEffect, useCallback } from 'react';
import { X, Download, ExternalLink, FileText, Image, File, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
    if (!document.url) return;
    const link = window.document.createElement('a');
    link.href = document.url;
    link.download = document.name;
    link.click();
  };

  const handleOpenInNewTab = () => {
    if (!document.url) return;
    window.open(document.url, '_blank');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      onClick={onClose}
      data-testid="document-preview-modal-backdrop"
    >
      <div
        className="bg-card rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] 
                   flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        data-testid="document-preview-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border 
                        bg-muted sticky top-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <FileTypeIcon type={fileType} />
            <span className="font-medium text-foreground truncate" data-testid="document-name">
              {document.name}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenInNewTab}
              disabled={!document.url}
              data-testid="button-open-new-tab"
            >
              <ExternalLink className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">Open</span>
            </Button>

            <Button
              size="sm"
              onClick={handleDownload}
              disabled={!document.url}
              data-testid="button-download"
            >
              <Download className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">Download</span>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="ml-2"
              data-testid="button-close-modal"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Preview Content */}
        <div className="flex-1 overflow-hidden bg-muted relative" data-testid="preview-content">
          {isLoading && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted z-10">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent 
                                rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Loading preview...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="h-full flex items-center justify-center" data-testid="preview-error">
              <div className="text-center max-w-md px-4">
                <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                <p className="text-foreground mb-2">Unable to preview this file</p>
                <p className="text-sm text-muted-foreground mb-4">{error}</p>
                <Button
                  onClick={handleDownload}
                  disabled={!document.url}
                  data-testid="button-download-fallback"
                >
                  Download Instead
                </Button>
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
              data-testid="preview-pdf"
            />
          )}

          {/* Image Preview */}
          {fileType === 'image' && !error && (
            <div className="h-full flex items-center justify-center p-4 overflow-auto" data-testid="preview-image-container">
              <img
                src={document.url}
                alt={document.name}
                className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  setIsLoading(false);
                  setError('Image failed to load');
                }}
                data-testid="preview-image"
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
            <div className="h-full flex items-center justify-center" data-testid="preview-office">
              <div className="text-center max-w-md px-4">
                <File className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  Office Document
                </h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Office documents require download to view.
                </p>
                <Button
                  onClick={handleDownload}
                  disabled={!document.url}
                  data-testid="button-download-office"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download File
                </Button>
              </div>
            </div>
          )}

          {/* Unknown/Unsupported Format */}
          {fileType === 'unknown' && !error && (
            <div className="h-full flex items-center justify-center" data-testid="preview-unknown">
              <div className="text-center max-w-md px-4">
                <File className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  Preview Not Available
                </h3>
                <p className="text-sm text-muted-foreground mb-6">
                  This file type cannot be previewed in the browser.
                  Please download to view.
                </p>
                <Button
                  onClick={handleDownload}
                  disabled={!document.url}
                  data-testid="button-download-unknown"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download File
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer for PDF */}
        {fileType === 'pdf' && !error && !isLoading && (
          <div className="px-4 py-2 border-t border-border bg-muted text-center">
            <p className="text-xs text-muted-foreground">
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
        <div className="w-8 h-8 bg-destructive/10 rounded flex items-center justify-center">
          <FileText className="w-4 h-4 text-destructive" />
        </div>
      );
    case 'image':
      return (
        <div className="w-8 h-8 bg-muted rounded flex items-center justify-center">
          <Image className="w-4 h-4 text-foreground" />
        </div>
      );
    case 'office':
      return (
        <div className="w-8 h-8 bg-muted rounded flex items-center justify-center">
          <FileText className="w-4 h-4 text-foreground" />
        </div>
      );
    default:
      return (
        <div className="w-8 h-8 bg-muted rounded flex items-center justify-center">
          <File className="w-4 h-4 text-muted-foreground" />
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
    if (!url) {
      stableOnError('No URL provided');
      return;
    }
    
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load');
        return res.text();
      })
      .then((text) => {
        setContent(text);
        stableOnLoad();
      })
      .catch(() => stableOnError('Failed to load text file. Please download to view.'));
  }, [url, stableOnLoad, stableOnError]);

  const isCSV = url.toLowerCase().endsWith('.csv');

  if (isCSV && content) {
    return <CSVTable content={content} />;
  }

  return (
    <pre 
      className="h-full overflow-auto p-4 text-sm font-mono text-foreground whitespace-pre-wrap"
      data-testid="preview-text"
    >
      {content}
    </pre>
  );
}

function CSVTable({ content }: { content: string }) {
  const rows = content.split('\n').map((row) => row.split(','));
  const headers = rows[0] || [];
  const data = rows.slice(1).filter((row) => row.some((cell) => cell.trim()));

  return (
    <div className="h-full overflow-auto p-4" data-testid="preview-csv">
      <table className="min-w-full border-collapse bg-card rounded-lg overflow-hidden">
        <thead>
          <tr className="bg-muted">
            {headers.map((header, i) => (
              <th
                key={i}
                className="px-4 py-2 text-left text-sm font-medium text-foreground border border-border"
              >
                {header.trim()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-card' : 'bg-muted/50'}>
              {row.map((cell, j) => (
                <td
                  key={j}
                  className="px-4 py-2 text-sm text-muted-foreground border border-border"
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
