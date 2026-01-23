interface StaticImageWidgetProps {
  title: string;
  imagePath: string;
}

export function StaticImageWidget({ title, imagePath }: StaticImageWidgetProps) {
  return (
    <div className="flex flex-col h-full bg-background" data-testid="static-image-widget">
      <div className="flex-1 overflow-auto p-4 flex items-start justify-center">
        <img 
          src={imagePath}
          alt={title}
          className="w-full h-auto max-w-4xl"
          loading="lazy"
          onError={(e) => {
            console.error(`Failed to load image: ${imagePath}`);
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
          }}
        />
      </div>
    </div>
  );
}
