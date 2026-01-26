import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Settings } from 'lucide-react';
import { Link } from 'wouter';
import type { AgentResource } from '@shared/schema';
import { DocumentPreviewModal } from '@/components/DocumentPreviewModal';
import { Button } from '@/components/ui/button';

interface SpyglassResourcesWidgetProps {
  cmaToken?: string;
}

export function SpyglassResourcesWidget({ cmaToken }: SpyglassResourcesWidgetProps) {
  const [previewDocument, setPreviewDocument] = useState<AgentResource | null>(null);

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

  return (
    <div className="h-full w-full flex flex-col" data-testid="spyglass-resources-widget">
      {/* Content */}
      <div className="flex-1 flex items-center justify-center bg-background p-8">
        {isLoading ? (
          <div className="text-center">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
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
          <div className="text-center space-y-6 max-w-lg">
            {activeResources.map((resource) => (
              <Button
                key={resource.id}
                variant="ghost"
                onClick={(e) => handleResourceClick(resource, e)}
                className="block w-full text-lg underline underline-offset-4 text-center"
                data-testid={`resource-link-${resource.id}`}
              >
                {resource.name}
                {resource.type === 'file' && (
                  <span className="inline-block ml-2 text-muted-foreground text-sm no-underline">(Preview)</span>
                )}
              </Button>
            ))}
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
                variant="ghost"
                asChild
                className="underline underline-offset-4"
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

      {/* Document Preview Modal */}
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
