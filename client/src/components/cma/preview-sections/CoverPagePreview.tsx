import { cn } from "@/lib/utils";

interface CoverPagePreviewProps {
  title: string;
  subtitle: string;
  clientName?: string;
  showDate: boolean;
  showAgentPhoto: boolean;
  agentName?: string;
  agentPhoto?: string;
  compact?: boolean;
}

export function CoverPagePreview({
  title,
  subtitle,
  clientName,
  showDate,
  showAgentPhoto,
  agentName,
  agentPhoto,
  compact,
}: CoverPagePreviewProps) {
  return (
    <div className={cn("text-center", compact ? "py-4" : "py-8")}>
      <p className="text-[#F37216] font-semibold text-sm">Spyglass Realty</p>
      <h2 className={cn("font-bold mt-2", compact ? "text-lg" : "text-2xl")}>
        {title || "Comparative Market Analysis"}
      </h2>
      <p className="text-muted-foreground text-sm mt-1">
        {subtitle || "Prepared exclusively for you"}
      </p>
      {clientName && <p className="font-medium mt-1">{clientName}</p>}
      {showDate && (
        <p className="text-sm text-muted-foreground mt-1">
          {new Date().toLocaleDateString()}
        </p>
      )}
      {showAgentPhoto && agentPhoto && (
        <div className="flex justify-center mt-3">
          <img
            src={agentPhoto}
            alt={agentName}
            className="w-12 h-12 rounded-full object-cover"
          />
        </div>
      )}
      {agentName && <p className="text-sm mt-2">{agentName}</p>}
    </div>
  );
}
