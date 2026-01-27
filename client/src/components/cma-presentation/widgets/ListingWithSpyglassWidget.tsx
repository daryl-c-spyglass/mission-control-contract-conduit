import { LISTING_WITH_SPYGLASS_TEXT } from '../constants/widgets';

interface ListingWithSpyglassWidgetProps {
  videoUrl?: string;
}

export function ListingWithSpyglassWidget({ 
  videoUrl = 'https://www.youtube.com/watch?v=iB_u-ksW3ts' 
}: ListingWithSpyglassWidgetProps) {
  return (
    <div className="flex flex-col h-full bg-background" data-testid="listing-with-spyglass-widget">
      <div className="flex-1 overflow-auto p-6 md:p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* LRE Combined Logo on black background */}
          <div className="w-full max-w-xl mx-auto bg-black rounded-lg p-8">
            <img 
              src="/logos/LRE_SGR_White.png"
              alt="Spyglass Realty - Leading Real Estate Companies of the World"
              className="w-full h-auto"
            />
          </div>
          
          <div className="text-center space-y-4">
            {/* Video Presentation Label */}
            <p className="text-sm text-muted-foreground uppercase tracking-wider">
              Video Presentation
            </p>
            
            {/* Embedded YouTube Video */}
            <div className="relative w-full aspect-video max-w-2xl mx-auto rounded-lg overflow-hidden shadow-lg">
              <iframe
                src={videoUrl.replace('watch?v=', 'embed/')}
                title="Spyglass Realty Video Presentation"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 w-full h-full"
              />
            </div>
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
