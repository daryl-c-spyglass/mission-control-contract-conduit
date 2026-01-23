import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { GOOGLE_REVIEWS_URL } from '../constants/widgets';

export function ClientTestimonialsWidget() {
  return (
    <div className="flex flex-col h-full bg-background" data-testid="client-testimonials-widget">
      <div className="flex-1 overflow-auto p-6 md:p-8 flex items-center justify-center">
        <div className="max-w-2xl text-center space-y-8">
          <div className="space-y-4">
            <h2 className="text-2xl md:text-3xl font-bold">
              What Our Clients Say
            </h2>
            <p className="text-lg text-muted-foreground">
              We're proud of the relationships we build with our clients and the results we achieve together.
            </p>
          </div>
          
          <Button 
            variant="outline" 
            size="lg"
            className="gap-2"
            onClick={() => window.open(GOOGLE_REVIEWS_URL, '_blank')}
            data-testid="button-google-reviews"
          >
            <ExternalLink className="w-5 h-5" />
            Click to read all of our reviews on Google!
          </Button>
        </div>
      </div>
    </div>
  );
}
