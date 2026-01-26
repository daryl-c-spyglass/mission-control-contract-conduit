import { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface StaticImageWidgetProps {
  title: string;
  imagePath: string;
}

export function StaticImageWidget({ title, imagePath }: StaticImageWidgetProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
  }, [imagePath]);

  return (
    <div className="flex flex-col h-full bg-background" data-testid="static-image-widget">
      <div className="flex-1 overflow-auto p-4 flex items-start justify-center">
        <div className="relative w-full max-w-4xl">
          {!isLoaded && !hasError && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Skeleton className="w-full aspect-[4/3] rounded-lg" />
            </div>
          )}
          <img 
            src={imagePath}
            alt={title}
            className={`w-full h-auto transition-opacity duration-300 ${
              isLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={() => setIsLoaded(true)}
            onError={() => {
              console.error(`Failed to load image: ${imagePath}`);
              setHasError(true);
            }}
          />
          {hasError && (
            <div className="flex items-center justify-center p-8 text-muted-foreground">
              <p>Failed to load image</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
