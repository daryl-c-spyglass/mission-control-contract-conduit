import { cn } from "@/lib/utils";

interface PreviewSectionProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  sectionId?: string;
  onClick?: (sectionId: string) => void;
  compact?: boolean;
}

export function PreviewSection({
  title,
  icon: Icon,
  children,
  sectionId,
  onClick,
  compact = false,
}: PreviewSectionProps) {
  const handleClick = () => {
    if (sectionId && onClick) onClick(sectionId);
  };

  return (
    <div 
      className={cn(
        "border rounded-lg overflow-hidden transition-colors",
        onClick && "cursor-pointer hover:border-primary/50 hover:bg-muted/30"
      )}
      onClick={handleClick}
      data-testid={`preview-section-${sectionId}`}
    >
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <span className="font-medium text-sm text-muted-foreground">{title}</span>
      </div>
      <div className={cn("bg-background", compact ? "p-3" : "p-4")}>
        {children}
      </div>
    </div>
  );
}
