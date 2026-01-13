import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CMAReport } from "@/components/CMAReport";
import type { Property, PropertyStatistics, TimelineDataPoint } from "@shared/schema";

interface SharedCMAData {
  cma: {
    id: string;
    name: string;
    notes: string | null;
    createdAt: string;
    expiresAt: string | null;
    subjectPropertyId?: string | null;
  };
  properties: Property[];
  statistics: PropertyStatistics;
  timelineData: TimelineDataPoint[];
}

export default function SharedCMAView() {
  const { token } = useParams<{ token: string }>();

  const { data, isLoading, isError, error } = useQuery<SharedCMAData>({
    queryKey: ['/api/share/cma', token],
    queryFn: async () => {
      const res = await fetch(`/api/share/cma/${token}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to load CMA');
      }
      return res.json();
    },
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading CMA...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 mx-auto text-destructive mb-4" />
              <h2 className="text-xl font-semibold mb-2">Unable to Load CMA</h2>
              <p className="text-muted-foreground">
                {(error as Error).message || 'This CMA link may have expired or is invalid.'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { cma, properties, statistics, timelineData } = data;

  return (
    <div className="min-h-screen bg-background">
      {/* Spyglass Realty Branded Header */}
      <header className="bg-zinc-900 text-white py-4 px-6 shadow-lg">
        <div className="container mx-auto max-w-7xl flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img 
              src="/spyglass-logo-white.png" 
              alt="Spyglass Realty" 
              className="h-10 w-auto"
            />
          </div>
          <div className="text-right">
            <h1 className="text-xl font-bold">{cma.name}</h1>
            <p className="text-sm text-zinc-400">
              Comparative Market Analysis
              {cma.expiresAt && (
                <span className="ml-2 text-amber-400">
                  • Expires {new Date(cma.expiresAt).toLocaleDateString()}
                </span>
              )}
            </p>
          </div>
        </div>
      </header>

      {/* CMA Report with CloudCMA-style interface */}
      <div className="container mx-auto max-w-7xl px-4 py-6">
        <CMAReport
          properties={properties}
          statistics={statistics}
          timelineData={timelineData}
          isPreview={false}
          expiresAt={cma.expiresAt ? new Date(cma.expiresAt) : undefined}
          notes={cma.notes}
          reportTitle={cma.name}
          subjectPropertyId={cma.subjectPropertyId || null}
        />
      </div>

      {/* Footer with Spyglass branding */}
      <footer className="bg-zinc-900 text-zinc-400 py-6 mt-8">
        <div className="container mx-auto max-w-7xl px-6 text-center">
          <img 
            src="/spyglass-logo-white.png" 
            alt="Spyglass Realty" 
            className="h-8 w-auto mx-auto mb-3 opacity-80"
          />
          <p className="text-sm">
            Comparative Market Analysis provided by Spyglass Realty
          </p>
          <p className="text-xs mt-2 text-zinc-500">
            Created {new Date(cma.createdAt).toLocaleDateString()}
          </p>
        </div>
      </footer>
    </div>
  );
}


