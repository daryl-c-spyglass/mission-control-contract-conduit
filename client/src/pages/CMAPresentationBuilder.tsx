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
  Image, 
  Map, 
  Calculator,
  GripVertical,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Cma, CmaBrochure, CmaAdjustmentsData, CoverPageConfig, Property, PropertyStatistics } from "@shared/schema";
import { CMA_REPORT_SECTIONS, DEFAULT_ENABLED_SECTIONS } from "@shared/cma-sections";
import { DEFAULT_COVER_PAGE_CONFIG, LAYOUT_OPTIONS, PHOTO_LAYOUT_OPTIONS } from "@shared/cma-defaults";
import { CoverPageEditor } from "@/components/presentation/CoverPageEditor";
import { CoverLetterEditor } from "@/components/presentation/CoverLetterEditor";
import { MapboxCMAMap } from "@/components/presentation/MapboxCMAMap";
import { AdjustmentsSection } from "@/components/presentation/AdjustmentsSection";
import { PhotoSelectionModal } from "@/components/presentation/PhotoSelectionModal";
import { ExpandedPreviewModal } from "@/components/presentation/ExpandedPreviewModal";
import { ListingBrochureContent } from "@/components/presentation/ListingBrochureContent";

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
  });
  
  const [brochure, setBrochure] = useState<CmaBrochure | null>(null);
  const [adjustments, setAdjustments] = useState<CmaAdjustmentsData | null>(null);
  const [customPhotoSelections, setCustomPhotoSelections] = useState<Record<string, string[]>>({});

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

  const { data: properties = [], isLoading: propertiesLoading } = useQuery<Property[]>({
    queryKey: ['/api/cmas', id, 'properties'],
    enabled: !!id && !!cma,
    queryFn: async () => {
      const response = await fetch(`/api/cmas/${id}/properties`);
      if (!response.ok) throw new Error('Failed to fetch properties');
      return response.json();
    },
  });

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
      const response = await apiRequest('POST', `/api/cmas/${id}/export-pdf`, {
        config,
        brochure,
        adjustments,
        customPhotoSelections,
      });
      const blob = await response.blob();
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
    onError: () => {
      toast({ title: 'Failed to export PDF', variant: 'destructive' });
    },
  });

  const subjectProperty = properties.find(p => 
    p.mlsNumber === cma?.subjectPropertyId
  );

  const comparables = properties.filter(p => 
    p.mlsNumber !== cma?.subjectPropertyId
  );

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

  const mapProperties = properties.map(p => ({
    id: p.mlsNumber || p.id || '',
    address: getPropertyAddress(p),
    lat: p.latitude || 0,
    lng: p.longitude || 0,
    price: p.closePrice || p.listPrice || 0,
    status: p.standardStatus || '',
    isSubject: p.mlsNumber === cma?.subjectPropertyId,
  })).filter(p => p.lat && p.lng);

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
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/cmas/${id}`}>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full grid grid-cols-4">
              <TabsTrigger value="sections" className="gap-1" data-testid="tab-sections">
                <FileText className="w-4 h-4" />
                Sections
              </TabsTrigger>
              <TabsTrigger value="map" className="gap-1" data-testid="tab-map">
                <Map className="w-4 h-4" />
                Map
              </TabsTrigger>
              <TabsTrigger value="photos" className="gap-1" data-testid="tab-photos">
                <Image className="w-4 h-4" />
                Photos
              </TabsTrigger>
              <TabsTrigger value="adjustments" className="gap-1" data-testid="tab-adjustments">
                <Calculator className="w-4 h-4" />
                Adjustments
              </TabsTrigger>
            </TabsList>

            <TabsContent value="sections" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Report Sections</CardTitle>
                  <CardDescription>Drag to reorder, toggle to include/exclude sections</CardDescription>
                </CardHeader>
                <CardContent>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2">
                        {sections.map((section) => (
                          <SortableSectionItem
                            key={section.id}
                            section={section}
                            onToggle={handleSectionToggle}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <Label>Listing Layout</Label>
                <Select
                  value={config.layout || "two_photos"}
                  onValueChange={(v) => setConfig({ ...config, layout: v })}
                >
                  <SelectTrigger data-testid="select-listing-layout">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LAYOUT_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="map" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Map Settings</CardTitle>
                  <CardDescription>Configure the map display in your presentation</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <MapboxCMAMap
                    properties={mapProperties}
                    subjectProperty={mapProperties.find(p => p.isSubject)}
                    style={config.mapStyle as 'streets' | 'satellite' | 'dark' || 'streets'}
                    showPolygon={config.showMapPolygon ?? true}
                    onStyleChange={(style) => setConfig({ ...config, mapStyle: style })}
                    onPolygonChange={(show) => setConfig({ ...config, showMapPolygon: show })}
                    height="350px"
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="photos" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Photo Selection</CardTitle>
                  <CardDescription>Choose which photos to include for each property</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Default Photo Selection</Label>
                    <Select
                      value={config.photoLayout || "first_dozen"}
                      onValueChange={(v) => setConfig({ ...config, photoLayout: v })}
                    >
                      <SelectTrigger data-testid="select-photo-layout">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PHOTO_LAYOUT_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label>Custom Photo Selection by Property</Label>
                    <ScrollArea className="h-[300px] border rounded-md p-2">
                      <div className="space-y-2">
                        {properties.map((property) => {
                          const propertyId = property.mlsNumber || property.id || '';
                          const customCount = customPhotoSelections[propertyId]?.length;
                          const photoCount = (property as any).photos?.length || 0;
                          
                          return (
                            <div
                              key={propertyId}
                              className="flex items-center justify-between p-2 rounded-md border"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate text-sm">
                                  {getPropertyAddress(property)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {customCount ? `${customCount} selected` : `${photoCount} available`}
                                </p>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedPropertyForPhotos(property);
                                  setPhotoModalOpen(true);
                                }}
                                disabled={photoCount === 0}
                                data-testid={`button-select-photos-${propertyId}`}
                              >
                                {customCount ? 'Edit' : 'Select'}
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="adjustments" className="space-y-4 mt-4">
              <AdjustmentsSection
                adjustments={adjustments}
                onChange={setAdjustments}
                subjectProperty={subjectProperty as any}
                comparables={comparables as any}
              />
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
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
          />

          <ListingBrochureContent
            cmaId={id || ''}
            brochure={brochure}
            onChange={setBrochure}
            subjectProperty={subjectProperty}
          />
        </div>
      </div>

      {selectedPropertyForPhotos && (
        <PhotoSelectionModal
          open={photoModalOpen}
          onOpenChange={setPhotoModalOpen}
          propertyId={selectedPropertyForPhotos.mlsNumber || selectedPropertyForPhotos.id || ''}
          propertyAddress={getPropertyAddress(selectedPropertyForPhotos)}
          photos={(selectedPropertyForPhotos as any).photos || []}
          selectedPhotos={customPhotoSelections[selectedPropertyForPhotos.mlsNumber || selectedPropertyForPhotos.id || ''] || []}
          onSave={handlePhotoSelection}
        />
      )}

      <ExpandedPreviewModal
        open={previewModalOpen}
        onOpenChange={setPreviewModalOpen}
        title="CMA Presentation Preview"
      >
        <div className="space-y-8">
          <div className="text-center py-12 border rounded-lg bg-muted/50">
            <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Preview Coming Soon</h3>
            <p className="text-sm text-muted-foreground">
              The full PDF preview will be rendered here
            </p>
          </div>
        </div>
      </ExpandedPreviewModal>
    </div>
  );
}
