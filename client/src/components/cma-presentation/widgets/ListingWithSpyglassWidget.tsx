import { LISTING_WITH_SPYGLASS_TEXT } from '../constants/widgets';

interface ListingWithSpyglassWidgetProps {
  videoUrl?: string;
}

export function ListingWithSpyglassWidget({ 
  videoUrl = 'https://www.youtube.com/embed/iB_u-ksW3ts' 
}: ListingWithSpyglassWidgetProps) {
  return (
    <div className="flex flex-col h-full bg-background" data-testid="listing-with-spyglass-widget">
      <div className="flex-1 overflow-auto p-6 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="aspect-video w-full bg-gray-900 rounded-lg overflow-hidden">
            <iframe
              src={videoUrl}
              title="How Spyglass Markets Your Home"
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
          
          <div className="text-center space-y-4">
            {LISTING_WITH_SPYGLASS_TEXT.split('\n\n').map((paragraph, index) => (
              <p key={index} className="text-base md:text-lg leading-relaxed text-muted-foreground">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
