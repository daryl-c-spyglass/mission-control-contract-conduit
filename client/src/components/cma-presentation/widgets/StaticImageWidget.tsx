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
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-5xl w-full">
          {!isLoaded && !hasError && (
            <div className="flex items-center justify-center">
              <Skeleton className="w-full aspect-[4/3] rounded-lg" />
            </div>
          )}
          
          {hasError && (
            <div className="flex items-center justify-center p-8 text-muted-foreground">
              <p>Failed to load image</p>
            </div>
          )}
          
          <img 
            src={imagePath}
            alt={title}
            className={`max-w-full max-h-[70vh] mx-auto object-contain rounded-lg shadow-sm transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'} ${hasError ? 'hidden' : ''}`}
            onLoad={() => setIsLoaded(true)}
            onError={() => {
              console.error(`Failed to load image: ${imagePath}`);
              setHasError(true);
            }}
            data-testid="img-static-widget"
          />
        </div>
      </div>
    </div>
  );
}
