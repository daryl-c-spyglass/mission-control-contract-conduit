import { useQuery } from '@tanstack/react-query';
import { FileText, Settings } from 'lucide-react';
import { Link } from 'wouter';
import type { AgentResource } from '@shared/schema';

interface SpyglassResourcesWidgetProps {
  cmaToken?: string; // Optional token for public CMA access
}

export function SpyglassResourcesWidget({ cmaToken }: SpyglassResourcesWidgetProps) {
  // Use different endpoint based on whether we have a public token or are authenticated
  const queryKey = cmaToken 
    ? [`/api/shared/cma/${cmaToken}/resources`]
    : ["/api/agent/resources"];

  const { data: resources = [], isLoading, isError } = useQuery<AgentResource[]>({
    queryKey,
    staleTime: 60000,
    retry: false, // Don't retry on auth failures
  });

  // Filter to only active resources (treat undefined/null as active)
  const activeResources = resources.filter(r => r.isActive !== false);

  return (
    <div className="h-full w-full flex flex-col" data-testid="spyglass-resources-widget">
      {/* Content */}
      <div className="flex-1 flex items-center justify-center bg-background p-8">
        {isLoading ? (
          <div className="text-center">
            <div className="w-6 h-6 border-2 border-[#EF4923] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : isError ? (
          /* Error state - show empty placeholder for public viewers */
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
              <a
                key={resource.id}
                href={resource.type === 'file' ? resource.fileUrl || '#' : resource.url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-lg text-foreground hover:text-[#EF4923] transition-colors 
                           underline underline-offset-4 decoration-muted-foreground/30 hover:decoration-[#EF4923]"
                data-testid={`resource-link-${resource.id}`}
              >
                {resource.name}
                {resource.type === 'file' && (
                  <span className="inline-block ml-2 text-muted-foreground text-sm">(Download)</span>
                )}
              </a>
            ))}
          </div>
        ) : (
          /* Empty State Placeholder */
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
              <Link
                href="/settings"
                className="inline-flex items-center gap-2 text-sm text-[#EF4923] hover:underline"
              >
                <Settings className="w-4 h-4" />
                Go to Settings
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
