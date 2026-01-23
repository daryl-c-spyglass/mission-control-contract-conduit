import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ExternalLink, FileText, Download } from 'lucide-react';

interface Resource {
  title: string;
  url?: string;
  type: 'link' | 'download';
}

const RESOURCES: Resource[] = [
  { title: 'Spyglass Listing Presentation', type: 'link' },
  { title: 'Listing Agreement', type: 'download' },
  { title: 'Seller Disclosure', type: 'download' },
  { title: 'Home Warranty Information', type: 'link' },
  { title: 'Moving Checklist', type: 'download' },
];

export function SpyglassResourcesWidget() {
  return (
    <div className="flex flex-col h-full bg-background" data-testid="spyglass-resources-widget">
      <div className="bg-gray-900 text-white py-3 px-4 text-center flex-shrink-0">
        <span className="font-bold tracking-wider text-sm uppercase">
          SPYGLASS RESOURCES AND LINKS
        </span>
      </div>
      
      <div className="flex-1 overflow-auto p-6 md:p-8">
        <div className="max-w-2xl mx-auto space-y-4">
          <p className="text-center text-muted-foreground mb-6">
            Access helpful resources and documents for your listing process.
          </p>

          {RESOURCES.map((resource, index) => (
            <Card 
              key={index} 
              className="p-4 flex items-center justify-between cursor-pointer hover-elevate"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#EF4923]/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-[#EF4923]" />
                </div>
                <span className="font-medium">{resource.title}</span>
              </div>
              <Button variant="ghost" size="icon">
                {resource.type === 'link' ? (
                  <ExternalLink className="w-5 h-5" />
                ) : (
                  <Download className="w-5 h-5" />
                )}
              </Button>
            </Card>
          ))}

          <p className="text-center text-sm text-muted-foreground mt-8">
            Additional resources can be configured in settings.
          </p>
        </div>
      </div>
    </div>
  );
}
