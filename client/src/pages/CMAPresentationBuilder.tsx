import { useState, useEffect } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ArrowLeft, 
  Download, 
  Eye, 
  FileText, 
  Settings, 
  Image as ImageIcon, 
  Map, 
  Calculator,
  GripVertical,
  Loader2,
  Layout,
  Sparkles,
  MousePointer,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Cma, CmaBrochure, CmaAdjustmentsData, CoverPageConfig, Property, PropertyStatistics } from "@shared/schema";
import { CMA_REPORT_SECTIONS, DEFAULT_ENABLED_SECTIONS } from "@shared/cma-sections";
import { DEFAULT_COVER_PAGE_CONFIG, LAYOUT_OPTIONS, PHOTO_LAYOUT_OPTIONS } from "@shared/cma-defaults";
import { CoverPageEditor } from "@/components/presentation/CoverPageEditor";
import { CoverLetterEditor } from "@/components/presentation/CoverLetterEditor";
import { CMAMap } from "@/components/cma-map";
import { sanitizePhotoUrl } from "@/lib/cma-map-data";
import { AdjustmentsSection } from "@/components/presentation/AdjustmentsSection";
import { PhotoSelectionModal } from "@/components/presentation/PhotoSelectionModal";
import { ExpandedPreviewModal } from "@/components/presentation/ExpandedPreviewModal";
import { ListingBrochureContent } from "@/components/presentation/ListingBrochureContent";
import { CMAPreviewContent } from "@/components/presentation/CMAPreviewContent";
import { ReportSections } from "@/components/presentation/ReportSections";
import { CoverPhotoGrid } from "@/components/cma/CoverPhotoGrid";
import { PhotoPreviewModal } from "@/components/cma/PhotoPreviewModal";
import { LivePreviewPanel } from "@/components/cma/LivePreviewPanel";
import { cn } from "@/lib/utils";
import { transformToCMAReportData } from "@/lib/cma-transformer";
import { pdf } from '@react-pdf/renderer';
import { CMAPdfDocument } from "@/components/pdf/CMAPdfDocument";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface PresentationConfig {
  includedSections: string[];
  sectionOrder: string[];
  coverPageConfig: CoverPageConfig;
  coverLetterOverride: string;
  photoLayout: string;
  mapStyle: string;
  showMapPolygon: boolean;
  layout: string;
  photosPerProperty: string;
  includeAgentFooter: boolean;
  coverPhotoUrl: string | null;
  coverPhotoSource: 'ai' | 'manual';
}

interface SectionItem {
  id: string;
  name: string;
  enabled: boolean;
}

function SortableSectionItem({ section, onToggle }: { section: SectionItem; onToggle: (id: string) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-2 rounded-md border bg-background ${isDragging ? 'shadow-lg' : ''}`}
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </div>
      <Switch
        checked={section.enabled}
        onCheckedChange={() => onToggle(section.id)}
        id={`section-${section.id}`}
        data-testid={`switch-section-${section.id}`}
      />
      <Label htmlFor={`section-${section.id}`} className="flex-1 cursor-pointer">
        {section.name}
      </Label>
    </div>
  );
}

function getPropertyAddress(property: Property): string {
  return property.unparsedAddress || `${property.streetNumber || ''} ${property.streetName || ''} ${property.streetSuffix || ''}`.trim() || property.city || '';
}

export default function CMAPresentationBuilder() {
  const [, params] = useRoute("/cmas/:id/presentation");
  const [, setLocation] = useLocation();
  const id = params?.id;
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("sections");
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [selectedPropertyForPhotos, setSelectedPropertyForPhotos] = useState<Property | null>(null);
  
  const [config, setConfig] = useState<PresentationConfig>({
    includedSections: DEFAULT_ENABLED_SECTIONS as unknown as string[],
    sectionOrder: CMA_REPORT_SECTIONS.map(s => s.id),
    coverPageConfig: DEFAULT_COVER_PAGE_CONFIG,
    coverLetterOverride: "",
    photoLayout: "first_dozen",
    mapStyle: "streets",
    showMapPolygon: true,
    layout: "two_photos",
    photosPerProperty: "2",
    includeAgentFooter: true,
    coverPhotoUrl: null,
    coverPhotoSource: 'ai',
  });
  
  const [brochure, setBrochure] = useState<CmaBrochure | null>(null);
  const [adjustments, setAdjustments] = useState<CmaAdjustmentsData | null>(null);
  const [customPhotoSelections, setCustomPhotoSelections] = useState<Record<string, string[]>>({});

  const [coverPhotoModal, setCoverPhotoModal] = useState<{
    isOpen: boolean;
    photoUrl: string | null;
    photoLabel: string | null;
  }>({
    isOpen: false,
    photoUrl: null,
    photoLabel: null,
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const { data: cma, isLoading: cmaLoading } = useQuery<Cma>({
    queryKey: ['/api/cmas', id],
    enabled: !!id,
    queryFn: async () => {
      const response = await fetch(`/api/cmas/${id}`);
      if (!response.ok) throw new Error('Failed to fetch CMA');
      return response.json();
    },
  });

  // Fetch the linked transaction to get subject property from mlsData and cmaData fallback
  const { data: linkedTransaction } = useQuery<any>({
    queryKey: ['/api/transactions', cma?.transactionId],
    enabled: !!cma?.transactionId,
    queryFn: async () => {
      const response = await fetch(`/api/transactions/${cma?.transactionId}`);
      if (!response.ok) throw new Error('Failed to fetch transaction');
      return response.json();
    },
  });

  // Transform CMAComparable[] into Property-compatible objects
  // Try cma.propertiesData first, fall back to transaction.cmaData if empty
  const rawComparables = (cma?.propertiesData && (cma.propertiesData as any[]).length > 0)
    ? (cma.propertiesData as any[])
    : (linkedTransaction?.cmaData || []) as any[];
  
  const properties = rawComparables.map((comp: any, index: number) => ({
    id: comp.mlsNumber || `comp-${index}`,
    mlsNumber: comp.mlsNumber || '',
    unparsedAddress: comp.address || '',
    city: comp.city || '',
    postalCode: comp.postalCode || '',
    listPrice: comp.listPrice || comp.price || 0,
    closePrice: comp.closePrice || (comp.status === 'Closed' ? comp.price : null),
    standardStatus: comp.status || 'Active',
    bedroomsTotal: comp.bedrooms || 0,
    bathroomsTotalInteger: comp.bathrooms || 0,
    livingArea: typeof comp.sqft === 'string' ? parseFloat(comp.sqft) : (comp.sqft || 0),
    simpleDaysOnMarket: comp.daysOnMarket || 0,
    yearBuilt: comp.yearBuilt || null,
    photos: (comp.photos || (comp.imageUrl ? [comp.imageUrl] : []))
      .map((url: string) => sanitizePhotoUrl(url))
      .filter((url: string) => url.length > 0),
    // Ensure coordinates are in the format extractCoordinates expects
    map: comp.map || (comp.latitude && comp.longitude ? { latitude: comp.latitude, longitude: comp.longitude } : null),
    latitude: comp.latitude || comp.map?.latitude,
    longitude: comp.longitude || comp.map?.longitude,
  })) as unknown as Property[];

  // Get subject property from linked transaction's mlsData
  const subjectFromTransaction = linkedTransaction?.mlsData as Property | null;

  const { data: statistics } = useQuery<PropertyStatistics>({
    queryKey: ['/api/cmas', id, 'statistics'],
    enabled: !!id && !!cma,
    queryFn: async () => {
      const response = await fetch(`/api/cmas/${id}/statistics`);
      if (!response.ok) throw new Error('Failed to fetch statistics');
      return response.json();
    },
  });

  const { data: existingConfig, isLoading: configLoading } = useQuery<any>({
    queryKey: ['/api/cmas', id, 'report-config'],
    enabled: !!id,
    queryFn: async () => {
      const response = await fetch(`/api/cmas/${id}/report-config`);
      if (response.status === 404) return null;
      if (!response.ok) throw new Error('Failed to fetch config');
      return response.json();
    },
  });

  useEffect(() => {
    if (existingConfig) {
      setConfig({
        includedSections: existingConfig.includedSections || DEFAULT_ENABLED_SECTIONS as unknown as string[],
        sectionOrder: existingConfig.sectionOrder || CMA_REPORT_SECTIONS.map(s => s.id),
        coverPageConfig: existingConfig.coverPageConfig || DEFAULT_COVER_PAGE_CONFIG,
        coverLetterOverride: existingConfig.coverLetterOverride || "",
        photoLayout: existingConfig.photoLayout || "first_dozen",
        mapStyle: existingConfig.mapStyle || "streets",
        showMapPolygon: existingConfig.showMapPolygon ?? true,
        layout: existingConfig.layout || "two_photos",
        photosPerProperty: existingConfig.photosPerProperty || "2",
        includeAgentFooter: existingConfig.includeAgentFooter ?? true,
        coverPhotoUrl: existingConfig.coverPhotoUrl || null,
        coverPhotoSource: existingConfig.coverPhotoSource || 'ai',
      });
      if (existingConfig.customPhotoSelections) {
        setCustomPhotoSelections(existingConfig.customPhotoSelections);
      }
    }
    if (cma?.brochure) {
      setBrochure(cma.brochure as CmaBrochure);
    }
    if (cma?.adjustments) {
      setAdjustments(cma.adjustments as CmaAdjustmentsData);
    }
  }, [existingConfig, cma]);

  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...config, customPhotoSelections };
      const response = await apiRequest('PUT', `/api/cmas/${id}/report-config`, payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cmas', id, 'report-config'] });
      toast({ title: 'Configuration saved' });
    },
    onError: () => {
      toast({ title: 'Failed to save configuration', variant: 'destructive' });
    },
  });

  const exportPdfMutation = useMutation({
    mutationFn: async () => {
      if (!cma) throw new Error('CMA not found');
      
      const reportData = transformToCMAReportData(
        cma,
        subjectProperty,
        comparables,
        {
          firstName: 'Agent',
          lastName: '',
          title: 'Real Estate Professional',
          company: 'Spyglass Realty',
        },
        statistics
      );

      const pdfDoc = (
        <CMAPdfDocument
          data={reportData}
          includedSections={config.includedSections}
          sectionOrder={config.sectionOrder}
          coverPageConfig={config.coverPageConfig}
          coverLetterOverride={config.coverLetterOverride}
        />
      );

      const blob = await pdf(pdfDoc).toBlob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CMA-${cma?.subjectPropertyId || id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => {
      toast({ title: 'PDF exported successfully' });
    },
    onError: (error) => {
      console.error('PDF export error:', error);
      toast({ title: 'Failed to export PDF', variant: 'destructive' });
    },
  });

  // Use subject property from linked transaction's mlsData, or try to find in properties
  const subjectProperty = subjectFromTransaction || properties.find(p => 
    p.mlsNumber === cma?.subjectPropertyId
  );

  // Get MLS number for fetching image insights
  const subjectMlsNumber = (subjectProperty as any)?.mlsNumber || 
                           linkedTransaction?.mlsNumber || 
                           cma?.subjectPropertyId;

  // Fetch image insights from Repliers API (same endpoint as flyer generator)
  const { data: imageInsightsData, isLoading: imageInsightsLoading } = useQuery<{
    available: boolean;
    images: Array<{
      url: string;
      originalIndex: number;
      classification: { imageOf: string | null; prediction: number | null };
      quality: { qualitative: string | null; score: number | null };
    }>;
  }>({
    queryKey: ['/api/repliers/listing', subjectMlsNumber, 'image-insights'],
    enabled: !!subjectMlsNumber,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    queryFn: async () => {
      const response = await fetch(`/api/repliers/listing/${subjectMlsNumber}/image-insights`);
      if (!response.ok) {
        return { available: false, images: [] };
      }
      return response.json();
    },
  });

  // Comparables are all properties in propertiesData (subject is not included there)
  // If subject is somehow in properties, filter it out
  const comparables = subjectFromTransaction 
    ? properties // All properties are comparables since subject comes from transaction
    : properties.filter(p => p.mlsNumber !== cma?.subjectPropertyId);

  const sections: SectionItem[] = (config.sectionOrder || CMA_REPORT_SECTIONS.map(s => s.id)).map(sectionId => {
    const sectionDef = CMA_REPORT_SECTIONS.find(s => s.id === sectionId);
    return {
      id: sectionId,
      name: sectionDef?.name || sectionId,
      enabled: (config.includedSections || []).includes(sectionId),
    };
  });

  const handleSectionToggle = (sectionId: string) => {
    const currentSections = config.includedSections || [];
    const newSections = currentSections.includes(sectionId)
      ? currentSections.filter((s: string) => s !== sectionId)
      : [...currentSections, sectionId];
    setConfig({ ...config, includedSections: newSections });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = sections.findIndex(s => s.id === active.id);
      const newIndex = sections.findIndex(s => s.id === over.id);
      const newOrder = arrayMove(sections.map(s => s.id), oldIndex, newIndex);
      setConfig({ ...config, sectionOrder: newOrder });
    }
  };

  const handlePhotoSelection = (propertyId: string, selectedPhotos: string[]) => {
    setCustomPhotoSelections(prev => ({ ...prev, [propertyId]: selectedPhotos }));
    setPhotoModalOpen(false);
    setSelectedPropertyForPhotos(null);
  };

  if (cmaLoading || configLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-[600px] lg:col-span-2" />
          <Skeleton className="h-[600px]" />
        </div>
      </div>
    );
  }

  if (!cma) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">CMA not found</p>
        <Button variant="outline" asChild>
          <Link href="/cmas">Back to CMAs</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild data-testid="button-back">
            <Link href={cma.transactionId ? `/transactions/${cma.transactionId}?tab=cma` : `/cmas/${id}`}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Presentation Builder</h1>
            <p className="text-sm text-muted-foreground">{cma.name || cma.subjectPropertyId}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setPreviewModalOpen(true)}
            className="gap-2"
            data-testid="button-preview"
          >
            <Eye className="w-4 h-4" />
            Preview
          </Button>
          <Button
            variant="outline"
            onClick={() => saveConfigMutation.mutate()}
            disabled={saveConfigMutation.isPending}
            className="gap-2"
            data-testid="button-save-config"
          >
            {saveConfigMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Settings className="w-4 h-4" />
            )}
            Save
          </Button>
          <Button
            onClick={() => exportPdfMutation.mutate()}
            disabled={exportPdfMutation.isPending}
            className="gap-2"
            data-testid="button-export-pdf"
          >
            {exportPdfMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Export PDF
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:w-[60%] space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="sections" className="gap-1" data-testid="tab-sections">
                <FileText className="w-4 h-4" />
                Sections
              </TabsTrigger>
              <TabsTrigger value="content" className="gap-1" data-testid="tab-content">
                <ImageIcon className="w-4 h-4" />
                Content
              </TabsTrigger>
              <TabsTrigger value="layout" className="gap-1" data-testid="tab-layout">
                <Layout className="w-4 h-4" />
                Layout
              </TabsTrigger>
            </TabsList>

            <TabsContent value="sections" className="space-y-4 mt-4">
              <Card>
                <CardContent className="pt-6">
                  <ReportSections
                    includedSections={config.includedSections}
                    sectionOrder={config.sectionOrder}
                    onSectionsChange={(includedSections, sectionOrder) => 
                      setConfig({ ...config, includedSections, sectionOrder })
                    }
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="layout" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <ImageIcon className="w-5 h-5 text-[#F37216]" />
                    <CardTitle className="text-base">Cover Page Photo</CardTitle>
                  </div>
                  <CardDescription>
                    Select the main photo for your CMA presentation cover
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setConfig(prev => ({ ...prev, coverPhotoSource: 'ai' }))}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all text-sm font-medium",
                        config.coverPhotoSource === 'ai'
                          ? "border-[#F37216] bg-[#F37216]/10 text-[#F37216]"
                          : "border-muted text-muted-foreground hover:border-muted-foreground"
                      )}
                      data-testid="btn-ai-photo"
                    >
                      <Sparkles className="w-4 h-4" />
                      AI Best Photo
                    </button>
                    <button
                      onClick={() => setConfig(prev => ({ ...prev, coverPhotoSource: 'manual' }))}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all text-sm font-medium",
                        config.coverPhotoSource === 'manual'
                          ? "border-[#F37216] bg-[#F37216]/10 text-[#F37216]"
                          : "border-muted text-muted-foreground hover:border-muted-foreground"
                      )}
                      data-testid="btn-manual-photo"
                    >
                      <MousePointer className="w-4 h-4" />
                      Manual Selection
                    </button>
                  </div>

                  <div className="p-3 bg-muted/50 rounded-lg">
                    <h3 className="font-medium text-foreground">
                      {subjectProperty?.unparsedAddress?.split(',')[0] || 'Subject Property'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {((subjectProperty as any)?.photos || (subjectProperty as any)?.images || []).length} photos available
                    </p>
                  </div>

                  {subjectProperty && (
                    <CoverPhotoGrid
                      photos={(subjectProperty as any).photos || (subjectProperty as any).images || []}
                      selectedPhoto={config.coverPhotoUrl}
                      source={config.coverPhotoSource}
                      imageInsights={imageInsightsData?.images}
                      isLoadingInsights={imageInsightsLoading && config.coverPhotoSource === 'ai'}
                      onSelect={(url) => setConfig(prev => ({ ...prev, coverPhotoUrl: url }))}
                      onPreview={(url, label) => setCoverPhotoModal({ isOpen: true, photoUrl: url, photoLabel: label })}
                    />
                  )}
                </CardContent>
              </Card>

              <PhotoPreviewModal
                isOpen={coverPhotoModal.isOpen}
                photoUrl={coverPhotoModal.photoUrl}
                photoLabel={coverPhotoModal.photoLabel}
                onClose={() => setCoverPhotoModal({ isOpen: false, photoUrl: null, photoLabel: null })}
              />
            </TabsContent>

            <TabsContent value="content" className="space-y-4 mt-4">
              <CoverPageEditor
                config={config.coverPageConfig || DEFAULT_COVER_PAGE_CONFIG}
                onChange={(coverPageConfig) => setConfig({ ...config, coverPageConfig })}
              />

              <CoverLetterEditor
                coverLetter={config.coverLetterOverride || ""}
                onChange={(coverLetterOverride) => setConfig({ ...config, coverLetterOverride })}
                subjectProperty={subjectProperty}
                properties={properties}
                statistics={statistics}
                includeAgentFooter={config.includeAgentFooter}
                onAgentFooterChange={(includeAgentFooter) => setConfig({ ...config, includeAgentFooter })}
              />

              <ListingBrochureContent
                cmaId={id || ''}
                brochure={brochure}
                onChange={setBrochure}
                subjectProperty={subjectProperty}
              />

              <AdjustmentsSection
                adjustments={adjustments}
                onChange={setAdjustments}
                subjectProperty={subjectProperty as any}
                comparables={comparables as any}
              />
            </TabsContent>
          </Tabs>
        </div>

        <div className="w-full lg:w-[40%]">
          <LivePreviewPanel
            includedSections={config.includedSections}
            contentSettings={{
              title: config.coverPageConfig?.title || 'Comparative Market Analysis',
              subtitle: config.coverPageConfig?.subtitle || 'Prepared exclusively for you',
              showDate: config.coverPageConfig?.showDate ?? true,
              showAgentPhoto: config.coverPageConfig?.showAgentPhoto ?? true,
              coverLetter: config.coverLetterOverride,
            }}
            layoutSettings={{
              coverPhotoUrl: config.coverPhotoUrl,
              brochureUrl: brochure?.url || undefined,
              mapStyle: (config.mapStyle as 'streets' | 'satellite') || 'streets',
              showMapPolygon: config.showMapPolygon ?? true,
            }}
            subjectProperty={subjectProperty}
            comparables={comparables}
            agentProfile={{
              name: 'Daryl Camingao',
              title: 'Real Estate Professional',
              email: 'daryl@spyglassrealty.com',
            }}
            onSectionClick={(sectionId) => {
              if (['cover_page', 'cover_letter', 'agent_resume'].includes(sectionId)) {
                setActiveTab('content');
              } else if (['listing_brochure', 'map_all_listings'].includes(sectionId)) {
                setActiveTab('layout');
              } else {
                setActiveTab('sections');
              }
            }}
          />
        </div>
      </div>

      {selectedPropertyForPhotos && (
        <PhotoSelectionModal
          open={photoModalOpen}
          onOpenChange={setPhotoModalOpen}
          propertyId={selectedPropertyForPhotos.mlsNumber || selectedPropertyForPhotos.id || ''}
          propertyAddress={getPropertyAddress(selectedPropertyForPhotos)}
          photos={((selectedPropertyForPhotos as any).photos || []).map((url: string) => sanitizePhotoUrl(url)).filter((url: string) => url.length > 0)}
          selectedPhotos={customPhotoSelections[selectedPropertyForPhotos.mlsNumber || selectedPropertyForPhotos.id || ''] || []}
          onSave={handlePhotoSelection}
        />
      )}

      <ExpandedPreviewModal
        open={previewModalOpen}
        onOpenChange={setPreviewModalOpen}
        title="CMA Presentation Preview"
      >
        {cma && (
          <CMAPreviewContent
            data={transformToCMAReportData(
              cma,
              subjectProperty,
              comparables,
              {
                firstName: 'Agent',
                lastName: '',
                title: 'Real Estate Professional',
                company: 'Spyglass Realty',
              },
              statistics
            )}
            includedSections={config.includedSections}
            sectionOrder={config.sectionOrder}
            coverPageConfig={config.coverPageConfig}
            coverLetterOverride={config.coverLetterOverride}
          />
        )}
      </ExpandedPreviewModal>
    </div>
  );
}
