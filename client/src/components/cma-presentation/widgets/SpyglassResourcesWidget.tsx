import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Link2, ExternalLink, Eye, Download, Settings, File, FileImage, FileSpreadsheet } from 'lucide-react';
import { Link } from 'wouter';
import type { AgentResource } from '@shared/schema';
import { DocumentPreviewModal } from '@/components/DocumentPreviewModal';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface SpyglassResourcesWidgetProps {
  cmaToken?: string;
}

function getFileIcon(fileName?: string | null) {
  if (!fileName) return FileText;
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return FileText;
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return FileImage;
  if (['xls', 'xlsx', 'csv'].includes(ext || '')) return FileSpreadsheet;
  return File;
}

function getFileExtension(fileName?: string | null): string {
  if (!fileName) return '';
  const ext = fileName.split('.').pop()?.toUpperCase();
  return ext || '';
}

export function SpyglassResourcesWidget({ cmaToken }: SpyglassResourcesWidgetProps) {
  const [previewDocument, setPreviewDocument] = useState<AgentResource | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const queryKey = cmaToken
    ? [`/api/shared/cma/${cmaToken}/resources`]
    : ["/api/agent/resources"];

  const { data: resources = [], isLoading, isError } = useQuery<AgentResource[]>({
    queryKey,
    staleTime: 60000,
    retry: false,
  });

  const activeResources = resources.filter(r => r.isActive !== false);

  const handleResourceClick = (resource: AgentResource, e: React.MouseEvent) => {
    if (resource.type === 'link') {
      window.open(resource.url || '#', '_blank');
      return;
    }

    e.preventDefault();
    setPreviewDocument(resource);
  };

  const handleDownload = (resource: AgentResource, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = resource.fileUrl || resource.url;
    if (url) {
      const link = document.createElement('a');
      link.href = url;
      link.download = resource.name || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="h-full w-full flex flex-col" data-testid="spyglass-resources-widget">
      <div className="flex-1 flex items-center justify-center bg-background p-8">
        {isLoading ? (
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground mt-3">Loading resources...</p>
          </div>
        ) : isError ? (
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              Resources Unavailable
            </h3>
            <p className="text-sm text-muted-foreground">
              Resources could not be loaded at this time.
            </p>
          </div>
        ) : activeResources.length > 0 ? (
          <div className="w-full max-w-2xl">
            <div className="grid gap-3">
              {activeResources.map((resource) => {
                const isFile = resource.type === 'file';
                const FileIcon = isFile ? getFileIcon(resource.name) : Link2;
                const isHovered = hoveredId === resource.id;
                
                return (
                  <Card
                    key={resource.id}
                    className="group cursor-pointer transition-all duration-200 hover-elevate border-border/60"
                    onClick={(e) => handleResourceClick(resource, e)}
                    onMouseEnter={() => setHoveredId(resource.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    data-testid={`resource-card-${resource.id}`}
                  >
                    <div className="flex items-center gap-4 p-4">
                      <div className={`
                        flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center
                        transition-colors duration-200
                        ${isFile 
                          ? 'bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400' 
                          : 'bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400'
                        }
                      `}>
                        <FileIcon className="w-6 h-6" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-foreground truncate">
                            {resource.name}
                          </h4>
                          {isFile && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                              {getFileExtension(resource.name) || 'FILE'}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {isFile ? 'Click to preview document' : 'Opens in new tab'}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {isFile && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-9 w-9 transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}
                              onClick={(e) => handleDownload(resource, e)}
                              data-testid={`download-resource-${resource.id}`}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            <div className={`
                              flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium
                              bg-primary/10 text-primary
                            `}>
                              <Eye className="w-4 h-4" />
                              <span>Preview</span>
                            </div>
                          </>
                        )}
                        {!isFile && (
                          <div className={`
                            flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium
                            bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400
                          `}>
                            <ExternalLink className="w-4 h-4" />
                            <span>Open</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              No Resources Added
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {cmaToken
                ? "No resources are available for this presentation."
                : "Add helpful documents and links for your clients in Settings."}
            </p>
            {!cmaToken && (
              <Button
                variant="outline"
                asChild
                data-testid="link-settings"
              >
                <Link href="/settings">
                  <Settings className="w-4 h-4 mr-2" />
                  Go to Settings
                </Link>
              </Button>
            )}
          </div>
        )}
      </div>

      <DocumentPreviewModal
        isOpen={!!previewDocument}
        onClose={() => setPreviewDocument(null)}
        document={previewDocument ? {
          name: previewDocument.name,
          url: previewDocument.fileUrl || previewDocument.url || '',
          type: previewDocument.type,
        } : null}
      />
    </div>
  );
}
