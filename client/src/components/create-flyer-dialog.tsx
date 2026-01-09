import { useState, useCallback, useEffect, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, X, Upload, Check, Download, Image, FileText, Bed, Bath, Square, ZoomIn, ChevronDown, ChevronUp, Maximize2, User, RotateCcw, Plus, Minus, Sparkles, Undo2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import type { Transaction, MLSData } from "@shared/schema";

import spyglassLogoWhite from "@assets/White-Orange_(1)_1767129299733.png";

type FlyerFormat = "social" | "print";

// Single source of truth for character limits
const DESCRIPTION_LIMITS = {
  social: 200,
  print: 115,
} as const;

const STATUS_OPTIONS = [
  { value: "for_sale", label: "For Sale" },
  { value: "just_listed", label: "Just Listed" },
  { value: "under_contract", label: "Under Contract" },
  { value: "just_sold", label: "Just Sold" },
  { value: "for_lease", label: "For Lease" },
];

const formSchema = z.object({
  price: z.string().min(1, "Price is required"),
  status: z.enum(["for_sale", "just_listed", "under_contract", "just_sold", "for_lease"]),
  bedrooms: z.string().optional(),
  bathrooms: z.string().optional(),
  sqft: z.string().optional(),
  description: z.string().optional(),
  agentName: z.string().optional(),
  agentTitle: z.string().optional(),
  agentPhone: z.string().optional(),
  listingHeadline: z.string().max(39, "Max 39 characters").optional(),
});

type FormValues = z.infer<typeof formSchema>;

function truncateDescription(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text || "";
  // Reserve 3 chars for ellipsis to ensure total length doesn't exceed maxLength
  const effectiveMax = maxLength - 3;
  const truncated = text.substring(0, effectiveMax);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > 0) {
    return truncated.substring(0, lastSpace).trim() + '...';
  }
  return truncated.trim() + '...';
}

interface PreviewProps {
  photoUrls: string[];
  status: string;
  price: string;
  address: string;
  bedrooms?: string;
  bathrooms?: string;
  sqft?: string;
  description?: string;
  agentName?: string;
  agentTitle?: string;
  agentPhone?: string;
  agentPhotoUrl?: string;
  listingHeadline?: string;
}

function SocialMediaPreview({
  photoUrls,
  status,
  price,
  address,
  bedrooms,
  bathrooms,
  sqft,
  description,
}: PreviewProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const mainPhotoUrl = photoUrls[0] || null;

  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
  }, [mainPhotoUrl]);

  const statusLabel = STATUS_OPTIONS.find(s => s.value === status)?.label || "Just Listed";
  const addressParts = address.split(",");
  const truncatedDesc = truncateDescription(description || "", DESCRIPTION_LIMITS.social);

  const specs = [];
  if (bedrooms) specs.push(`${bedrooms} bed`);
  if (bathrooms) specs.push(`${bathrooms} bath`);
  if (sqft) specs.push(`${parseInt(sqft).toLocaleString()} sqft`);

  return (
    <div className="relative w-full aspect-[9/16] bg-[#1a1a2e] rounded-lg overflow-hidden shadow-lg border border-border">
      <div className="relative h-[47%] bg-muted">
        {mainPhotoUrl ? (
          <>
            {!imageLoaded && !imageError && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            {imageError && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted">
                <p className="text-xs text-muted-foreground">Failed to load</p>
              </div>
            )}
            <img
              src={mainPhotoUrl}
              alt="Property"
              className={`w-full h-full object-cover transition-opacity ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#1a1a2e] to-transparent" />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-xs text-muted-foreground">Select a photo</p>
          </div>
        )}
      </div>

      <div className="p-2.5 space-y-1.5">
        <p className="text-[9px] font-bold text-amber-500 uppercase tracking-wide">
          {statusLabel}
        </p>
        <p className="text-xs font-bold text-white">
          {price || "$0"}
        </p>
        <div className="space-y-0.5">
          {addressParts.map((part, i) => (
            <p key={i} className="text-[9px] text-white leading-tight">
              {part.trim()}
            </p>
          ))}
        </div>
        {specs.length > 0 && (
          <p className="text-[8px] text-gray-400">
            {specs.join("  |  ")}
          </p>
        )}
        {truncatedDesc && (
          <p className="text-[7px] text-gray-300 leading-relaxed line-clamp-3">
            {truncatedDesc}
          </p>
        )}
      </div>

      <div className="absolute bottom-1.5 right-1.5">
        <img
          src={spyglassLogoWhite}
          alt="Logo"
          className="h-4 w-auto opacity-90"
        />
      </div>
    </div>
  );
}

function PrintFlyerPreview({
  photoUrls,
  status,
  price,
  address,
  bedrooms,
  bathrooms,
  sqft,
  description,
  agentName,
  agentTitle,
  agentPhone,
  agentPhotoUrl,
  listingHeadline,
}: PreviewProps) {
  const [imagesLoaded, setImagesLoaded] = useState<Record<number, boolean>>({});
  
  const statusLabel = STATUS_OPTIONS.find(s => s.value === status)?.label || "Listed";
  const truncatedDesc = truncateDescription(description || "", DESCRIPTION_LIMITS.print);
  
  const streetAddress = address.split(",")[0].trim().toUpperCase();
  const cityStateZip = address.split(",").slice(1).join(",").trim().toUpperCase();
  const fullAddress = `${streetAddress} ${cityStateZip}`;

  return (
    <div className="relative w-full aspect-[8.5/11] bg-white rounded-lg overflow-hidden shadow-lg border border-border" style={{ fontFamily: "'League Spartan', 'Montserrat', sans-serif" }}>
      {/* Header Section - White background */}
      <div className="flex items-center justify-between px-2 py-2 bg-white border-b border-gray-100">
        <div className="bg-[#1a1a1a] rounded px-1.5 py-1">
          <img
            src={spyglassLogoWhite}
            alt="Spyglass Realty"
            className="h-4 w-auto"
          />
        </div>
        <div className="text-center">
          <p className="text-[5px] text-gray-500 italic">Leading</p>
          <p className="text-[4px] text-gray-500 tracking-wider">REAL ESTATE COMPANIES OF THE WORLD</p>
        </div>
        <div className="bg-[#c4a962] text-white px-2 py-1.5">
          <p className="text-[4px] tracking-[0.12em] text-center font-medium">{statusLabel.toUpperCase()} AT</p>
          <p className="text-[9px] font-bold text-center">{price || "$0"}</p>
        </div>
      </div>

      {/* Address Bar - White with dark text */}
      <div className="py-1.5 px-2 text-center">
        <p className="text-[6px] text-[#333] tracking-[0.2em] font-medium">
          {fullAddress}
        </p>
      </div>

      {/* Photos Section */}
      <div className="bg-white px-1.5">
        {/* Main Photo */}
        <div className="relative aspect-[2.2/1] bg-gray-100 overflow-hidden">
          {photoUrls[0] ? (
            <img
              src={photoUrls[0]}
              alt="Main"
              className="w-full h-full object-cover"
              onLoad={() => setImagesLoaded(prev => ({ ...prev, 0: true }))}
            />
          ) : (
            <div className="flex items-center justify-center h-full bg-gray-100">
              <p className="text-[8px] text-muted-foreground">Main Photo</p>
            </div>
          )}
        </div>

        {/* Secondary Photos */}
        <div className="grid grid-cols-2 gap-0.5 mt-0.5">
          {[1, 2].map(idx => (
            <div key={idx} className="relative aspect-[2.2/1] bg-gray-100 overflow-hidden">
              {photoUrls[idx] ? (
                <img
                  src={photoUrls[idx]}
                  alt={`Photo ${idx + 1}`}
                  className="w-full h-full object-cover"
                  onLoad={() => setImagesLoaded(prev => ({ ...prev, [idx]: true }))}
                />
              ) : (
                <div className="flex items-center justify-center h-full bg-gray-100">
                  <p className="text-[6px] text-muted-foreground">Photo {idx + 1}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Info Section - 3 Columns */}
      <div className="bg-white px-2 py-2 grid grid-cols-3 gap-1">
        {/* Left Column - Property Stats */}
        <div className="space-y-0.5 pl-0.5">
          <div className="flex items-center gap-1 text-[#333]">
            <Bed className="h-2.5 w-2.5" />
            <span className="text-[6px] font-semibold">{bedrooms || "—"} bedrooms</span>
          </div>
          <div className="flex items-center gap-1 text-[#333]">
            <Bath className="h-2.5 w-2.5" />
            <span className="text-[6px] font-semibold">{bathrooms || "—"} bathrooms</span>
          </div>
          <div className="flex items-center gap-1 text-[#333]">
            <Square className="h-2.5 w-2.5" />
            <span className="text-[6px] font-semibold">{sqft ? parseInt(sqft).toLocaleString() : "—"} sq. ft</span>
          </div>
        </div>

        {/* Center Column - Headline + Description */}
        <div className="text-center px-0.5">
          {listingHeadline && (
            <p className="text-[5px] font-semibold text-[#333] tracking-wider uppercase mb-1">
              {listingHeadline}
            </p>
          )}
          {truncatedDesc && (
            <p className="text-[5px] text-gray-600 leading-relaxed line-clamp-4">
              {truncatedDesc}
            </p>
          )}
        </div>

        {/* Right Column - Agent Info */}
        <div className="text-center pr-0.5 space-y-0.5">
          {agentPhotoUrl ? (
            <img 
              src={agentPhotoUrl} 
              alt="Agent" 
              className="w-6 h-6 mx-auto rounded-full object-cover border border-gray-200"
            />
          ) : (
            <div className="w-6 h-6 mx-auto bg-gray-200 rounded-full flex items-center justify-center">
              <User className="h-3 w-3 text-gray-400" />
            </div>
          )}
          <p className="text-[6px] font-bold text-[#333]">{agentName || "Agent Name"}</p>
          <p className="text-[4px] text-gray-500">{agentTitle || "REALTOR®, Spyglass Realty"}</p>
          <p className="text-[5px] text-gray-600">{agentPhone || "(XXX) XXX-XXXX"}</p>
          <img
            src={spyglassLogoWhite}
            alt="Logo"
            className="h-2 w-auto mx-auto mt-0.5"
          />
        </div>
      </div>

      {/* Bottom decorative bar - gold */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#c4a962]" />
    </div>
  );
}

interface CreateFlyerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction;
  mlsPhotos?: string[];
  agentName?: string;
  agentPhone?: string;
  agentPhotoUrl?: string;
}

export function CreateFlyerDialog({
  open,
  onOpenChange,
  transaction,
  mlsPhotos = [],
  agentName = "",
  agentPhone = "",
  agentPhotoUrl,
}: CreateFlyerDialogProps) {
  const { toast } = useToast();
  const [format, setFormat] = useState<FlyerFormat>("social");
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showUploadSection, setShowUploadSection] = useState(false);
  const [previewEnlarged, setPreviewEnlarged] = useState(false);
  const [expandedPhotoUrl, setExpandedPhotoUrl] = useState<string | null>(null);
  const [localAgentPhoto, setLocalAgentPhoto] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isAutoSelecting, setIsAutoSelecting] = useState(false);
  const [photoInsights, setPhotoInsights] = useState<Record<string, { classification: string; quality: number }>>({});
  const [originalDescription, setOriginalDescription] = useState<string>("");
  const [previousDescription, setPreviousDescription] = useState<string | null>(null);
  const [hasSummarized, setHasSummarized] = useState(false);

  const handleZoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(prev + 25, 300));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(prev - 25, 50));
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoomLevel(100);
  }, []);

  const mlsData = transaction.mlsData as MLSData | null;
  const maxPhotos = format === "social" ? 1 : 3;
  const maxDescriptionLength = DESCRIPTION_LIMITS[format];

  const resetPhotoSelection = useCallback((newFormat: FlyerFormat) => {
    const limit = newFormat === "social" ? 1 : 3;
    if (mlsPhotos.length > 0) {
      setSelectedPhotos(mlsPhotos.slice(0, limit));
    } else {
      setSelectedPhotos([]);
    }
    setUploadedPhotos([]);
    // Clear photo insights when switching to social (not needed there)
    if (newFormat === "social") {
      setPhotoInsights({});
    }
  }, [mlsPhotos]);

  useEffect(() => {
    if (open) {
      resetPhotoSelection(format);
      if (mlsPhotos.length === 0) {
        setShowUploadSection(true);
      }
      // Store original MLS description when dialog opens
      const mlsDescription = mlsData?.description || "";
      setOriginalDescription(mlsDescription);
      setPreviousDescription(null);
      setHasSummarized(false);
    }
  }, [open, mlsPhotos.length, mlsData?.description]);

  useEffect(() => {
    if (!open) {
      setSelectedPhotos([]);
      setUploadedPhotos([]);
      setShowUploadSection(false);
      setFormat("social");
      setLocalAgentPhoto(null);
      setZoomLevel(100);
    }
  }, [open]);

  useEffect(() => {
    if (!previewEnlarged) {
      setZoomLevel(100);
    }
  }, [previewEnlarged]);

  useEffect(() => {
    if (!previewEnlarged) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          handleZoomIn();
        } else if (e.key === '-') {
          e.preventDefault();
          handleZoomOut();
        } else if (e.key === '0') {
          e.preventDefault();
          handleZoomReset();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewEnlarged, handleZoomIn, handleZoomOut, handleZoomReset]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      price: transaction.listPrice ? `$${transaction.listPrice.toLocaleString()}` : "",
      status: "just_listed",
      bedrooms: mlsData?.bedrooms?.toString() || transaction.bedrooms?.toString() || "",
      bathrooms: mlsData?.bathrooms?.toString() || transaction.bathrooms?.toString() || "",
      sqft: mlsData?.sqft?.toString() || transaction.sqft?.toString() || "",
      description: mlsData?.description || "",
      agentName: agentName || "",
      agentTitle: "REALTOR®",
      agentPhone: agentPhone || "",
      listingHeadline: "",
    },
  });

  const watchedValues = useWatch({ control: form.control });
  const currentDescriptionLength = watchedValues.description?.length || 0;

  const handleSummarize = useCallback(async () => {
    // Always use the FULL original MLS description as source
    if (!originalDescription || originalDescription.trim().length === 0) {
      toast({
        title: "No description",
        description: "No MLS description available to summarize.",
        variant: "destructive",
      });
      return;
    }

    // Store current description before summarizing (for revert)
    const currentDescription = form.getValues("description");
    setPreviousDescription(currentDescription || null);

    setIsSummarizing(true);
    try {
      // Use format-specific character limits from single source of truth
      const response = await apiRequest("POST", "/api/summarize-description", {
        description: originalDescription, // Always use ORIGINAL MLS description
        maxLength: maxDescriptionLength,
        propertyInfo: {
          address: transaction.propertyAddress,
          beds: form.getValues("bedrooms"),
          baths: form.getValues("bathrooms"),
          sqft: form.getValues("sqft"),
        },
      });

      const data = await response.json();
      
      if (data.summary) {
        form.setValue("description", data.summary);
        setHasSummarized(true);
        toast({
          title: data.fallback ? "Description truncated" : "Description summarized!",
          description: data.fallback 
            ? "AI unavailable, description was truncated instead."
            : "AI generated a concise summary for your flyer.",
        });
      }
    } catch (error) {
      console.error("Summarization error:", error);
      toast({
        title: "Summarization failed",
        description: "Could not summarize. Please try again or edit manually.",
        variant: "destructive",
      });
    } finally {
      setIsSummarizing(false);
    }
  }, [form, transaction.propertyAddress, toast, originalDescription, format]);

  const handleRevertToPrevious = useCallback(() => {
    if (previousDescription !== null) {
      const currentDesc = form.getValues("description");
      form.setValue("description", previousDescription);
      setPreviousDescription(currentDesc || null);
      toast({
        title: "Reverted",
        description: "Description reverted to previous version.",
      });
    }
  }, [form, previousDescription, toast]);

  const handleRevertToOriginal = useCallback(() => {
    const currentDesc = form.getValues("description");
    setPreviousDescription(currentDesc || null);
    form.setValue("description", originalDescription);
    toast({
      title: "Reverted to original",
      description: "Full MLS description restored.",
    });
  }, [form, originalDescription, toast]);

  const handleFormatChange = (newFormat: FlyerFormat) => {
    setFormat(newFormat);
    resetPhotoSelection(newFormat);
  };

  const togglePhotoSelection = (photoUrl: string) => {
    setSelectedPhotos((prev) => {
      if (prev.includes(photoUrl)) {
        return prev.filter((p) => p !== photoUrl);
      }
      if (prev.length >= maxPhotos) {
        toast({
          title: "Maximum photos selected",
          description: `You can select ${maxPhotos === 1 ? "1 photo" : `up to ${maxPhotos} photos`} for ${format === "social" ? "social media" : "print flyer"}`,
        });
        return prev;
      }
      return [...prev, photoUrl];
    });
  };

  const handleFileUpload = useCallback((files: FileList | null) => {
    if (!files) return;
    
    const totalPhotos = selectedPhotos.length + uploadedPhotos.length;
    const remainingSlots = maxPhotos - totalPhotos;
    
    if (remainingSlots <= 0) {
      setSelectedPhotos([]);
      setUploadedPhotos([]);
      toast({
        title: "Replacing photos",
        description: `Previous photos cleared. Your new photos will be used instead.`,
      });
    }
    
    const effectiveSlots = remainingSlots <= 0 ? maxPhotos : remainingSlots;
    const filesToProcess = Array.from(files).slice(0, effectiveSlots);
    
    filesToProcess.forEach((file) => {
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Invalid file type",
          description: "Please upload only image files",
          variant: "destructive",
        });
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setUploadedPhotos((prev) => {
          if (prev.length >= maxPhotos) return prev;
          return [...prev, result];
        });
      };
      reader.readAsDataURL(file);
    });
  }, [selectedPhotos.length, uploadedPhotos.length, maxPhotos, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileUpload(e.dataTransfer.files);
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const removeUploadedPhoto = (index: number) => {
    setUploadedPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAgentPhotoUpload = useCallback((file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setLocalAgentPhoto(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, [toast]);

  const effectiveAgentPhoto = localAgentPhoto || agentPhotoUrl;

  // Helper to extract image ID for matching between API and local URLs
  const extractImageId = useCallback((url: string): string => {
    const match = url.match(/IMG-[A-Z0-9]+_\d+\.[a-z]+/i);
    return match ? match[0].toLowerCase() : url.toLowerCase();
  }, []);

  const handleAutoSelectPhotos = useCallback(async () => {
    const mlsNumber = mlsData?.mlsNumber || transaction.mlsNumber;
    if (!mlsNumber) {
      toast({
        title: "No MLS number",
        description: "Cannot auto-select photos without MLS data.",
        variant: "destructive",
      });
      return;
    }

    setIsAutoSelecting(true);
    try {
      const response = await apiRequest("GET", `/api/listings/${mlsNumber}/best-photos?count=${maxPhotos}`);
      const data = await response.json();

      if (data.selectedPhotos && data.selectedPhotos.length > 0) {
        // Build a map of image IDs to local mlsPhotos URLs
        const localUrlMap = new Map<string, string>();
        for (const url of mlsPhotos) {
          localUrlMap.set(extractImageId(url), url);
        }

        // Map API URLs back to local mlsPhotos URLs
        const selectedUrls = data.selectedPhotos
          .map((p: any) => {
            const imageId = extractImageId(p.url);
            return localUrlMap.get(imageId) || p.url;
          })
          .filter((url: string) => mlsPhotos.includes(url));

        setSelectedPhotos(selectedUrls);
        setUploadedPhotos([]);

        // Build insights map keyed by local mlsPhotos URLs
        const insights: Record<string, { classification: string; quality: number }> = {};
        for (const photo of data.allPhotosWithInsights || []) {
          const imageId = extractImageId(photo.url);
          const localUrl = localUrlMap.get(imageId);
          if (localUrl) {
            insights[localUrl] = {
              classification: photo.classification,
              quality: photo.quality,
            };
          }
        }
        setPhotoInsights(insights);

        const roomTypes = data.selectedPhotos
          .map((p: any) => p.classification)
          .filter((c: string) => c !== "Unknown")
          .join(", ");

        toast({
          title: data.hasImageInsights ? "AI-selected best photos" : "Selected photos",
          description: roomTypes 
            ? `Selected: ${roomTypes}` 
            : `Selected ${selectedUrls.length} photos`,
        });
      } else {
        toast({
          title: "No photos available",
          description: "Could not find photos to select.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Auto-select error:", error);
      toast({
        title: "Auto-select failed",
        description: "Could not auto-select photos. Please select manually.",
        variant: "destructive",
      });
    } finally {
      setIsAutoSelecting(false);
    }
  }, [mlsData?.mlsNumber, transaction.mlsNumber, maxPhotos, mlsPhotos, extractImageId, toast]);

  const getPhotosForFlyer = useCallback((): string[] => {
    const mlsUrls = selectedPhotos.map(url => 
      url.startsWith('data:') ? url : `/api/proxy-image?url=${encodeURIComponent(url)}`
    );
    const combined = [...mlsUrls, ...uploadedPhotos];
    return combined.slice(0, maxPhotos);
  }, [selectedPhotos, uploadedPhotos, maxPhotos]);

  const previewPhotoUrls = useMemo(() => {
    return getPhotosForFlyer();
  }, [getPhotosForFlyer]);

  const generateSocialFlyer = async (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, data: FormValues, photosToUse: string[]) => {
    canvas.width = 1080;
    canvas.height = 1920;

    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const mainPhoto = document.createElement('img');
    mainPhoto.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      mainPhoto.onload = () => resolve();
      mainPhoto.onerror = () => reject(new Error("Failed to load photo"));
      mainPhoto.src = photosToUse[0];
    });

    const photoHeight = 900;
    ctx.drawImage(mainPhoto, 0, 0, canvas.width, photoHeight);

    const gradient = ctx.createLinearGradient(0, photoHeight - 200, 0, photoHeight);
    gradient.addColorStop(0, "rgba(26, 26, 46, 0)");
    gradient.addColorStop(1, "rgba(26, 26, 46, 1)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, photoHeight - 200, canvas.width, 200);

    const statusLabel = STATUS_OPTIONS.find(s => s.value === data.status)?.label || "Just Listed";
    ctx.fillStyle = "#d97706";
    ctx.font = "bold 48px Inter, sans-serif";
    ctx.fillText(statusLabel.toUpperCase(), 60, photoHeight + 80);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 36px Inter, sans-serif";
    ctx.fillText(data.price, 60, photoHeight + 140);

    const address = transaction.propertyAddress;
    const addressParts = address.split(",");
    ctx.font = "32px Inter, sans-serif";
    ctx.fillStyle = "#ffffff";
    let addressY = photoHeight + 200;
    addressParts.forEach((part) => {
      ctx.fillText(part.trim(), 60, addressY);
      addressY += 45;
    });

    if (data.bedrooms || data.bathrooms || data.sqft) {
      ctx.font = "28px Inter, sans-serif";
      ctx.fillStyle = "#a0a0a0";
      let specs = [];
      if (data.bedrooms) specs.push(`${data.bedrooms} bedroom`);
      if (data.bathrooms) specs.push(`${data.bathrooms} bathroom`);
      if (data.sqft) specs.push(`${parseInt(data.sqft).toLocaleString()} sq. ft`);
      ctx.fillText(specs.join("  |  "), 60, addressY + 30);
    }

    if (data.description) {
      const truncatedDesc = truncateDescription(data.description, DESCRIPTION_LIMITS.social);
      ctx.font = "24px Inter, sans-serif";
      ctx.fillStyle = "#cccccc";
      const maxWidth = canvas.width - 120;
      const words = truncatedDesc.split(" ");
      let line = "";
      let descY = addressY + 100;
      const lineHeight = 34;
      
      words.forEach((word) => {
        const testLine = line + word + " ";
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && line !== "") {
          ctx.fillText(line.trim(), 60, descY);
          line = word + " ";
          descY += lineHeight;
        } else {
          line = testLine;
        }
      });
      if (line.trim()) {
        ctx.fillText(line.trim(), 60, descY);
      }
    }

    const logo = document.createElement('img');
    logo.crossOrigin = "anonymous";
    await new Promise<void>((resolve) => {
      logo.onload = () => resolve();
      logo.onerror = () => resolve();
      logo.src = spyglassLogoWhite;
    });
    
    const logoHeight = 80;
    const logoWidth = (logo.width / logo.height) * logoHeight || 200;
    ctx.drawImage(logo, canvas.width - logoWidth - 60, canvas.height - logoHeight - 60, logoWidth, logoHeight);

    if (agentName) {
      ctx.font = "bold 28px Inter, sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(agentName, 60, canvas.height - 120);
      
      if (agentPhone) {
        ctx.font = "24px Inter, sans-serif";
        ctx.fillStyle = "#a0a0a0";
        ctx.fillText(agentPhone, 60, canvas.height - 80);
      }
    }

    if (agentPhotoUrl) {
      const agentPhoto = document.createElement('img');
      agentPhoto.crossOrigin = "anonymous";
      await new Promise<void>((resolve) => {
        agentPhoto.onload = () => resolve();
        agentPhoto.onerror = () => resolve();
        agentPhoto.src = agentPhotoUrl;
      });
      
      if (agentPhoto.complete && agentPhoto.naturalWidth > 0) {
        const size = 100;
        const x = 60;
        const y = canvas.height - 240;
        
        ctx.save();
        ctx.beginPath();
        ctx.arc(x + size/2, y + size/2, size/2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(agentPhoto, x, y, size, size);
        ctx.restore();
      }
    }
  };

  const generatePrintFlyer = async (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, data: FormValues, photosToUse: string[]) => {
    canvas.width = 2550;
    canvas.height = 3300;
    
    const GOLD_COLOR = "#c4a962";
    const DARK_TEXT = "#333333";
    const FONT_LEAGUE = "League Spartan, sans-serif";
    const FONT_MONTSERRAT = "Montserrat, sans-serif";

    const address = transaction.propertyAddress;
    const addressParts = address.split(",");
    const streetAddress = addressParts[0].trim().toUpperCase();
    const cityStateZip = addressParts.slice(1).join(",").trim().toUpperCase();
    const fullAddress = `${streetAddress} ${cityStateZip}`;
    const statusLabel = STATUS_OPTIONS.find(s => s.value === data.status)?.label || "Listed";

    // Fill white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // ============ HEADER SECTION (height: ~250px) ============
    const headerHeight = 250;
    
    // Load and draw Spyglass logo (left)
    const logo = document.createElement('img');
    logo.crossOrigin = "anonymous";
    await new Promise<void>((resolve) => {
      logo.onload = () => resolve();
      logo.onerror = () => resolve();
      logo.src = spyglassLogoWhite;
    });
    
    const logoHeight = 120;
    const logoWidth = (logo.width / logo.height) * logoHeight || 350;
    
    // Add dark background panel behind logo for visibility
    const logoBgPadding = 20;
    ctx.fillStyle = "#1a1a1a";
    const logoBgRadius = 8;
    const logoBgX = 60;
    const logoBgY = 50;
    const logoBgW = logoWidth + logoBgPadding * 2;
    const logoBgH = logoHeight + logoBgPadding;
    ctx.beginPath();
    ctx.roundRect(logoBgX, logoBgY, logoBgW, logoBgH, logoBgRadius);
    ctx.fill();
    
    ctx.drawImage(logo, 80, 65, logoWidth, logoHeight);

    // Center - "Leading Real Estate Companies of the World" text
    ctx.fillStyle = "#666666";
    ctx.font = `italic 28px ${FONT_MONTSERRAT}`;
    ctx.textAlign = "center";
    ctx.fillText("Leading", canvas.width / 2, 100);
    ctx.font = `500 22px ${FONT_MONTSERRAT}`;
    ctx.fillText("REAL ESTATE COMPANIES OF THE WORLD", canvas.width / 2, 135);

    // Price badge (right) - gold background
    const badgeWidth = 420;
    const badgeHeight = 140;
    const badgeX = canvas.width - badgeWidth - 80;
    const badgeY = 55;
    ctx.fillStyle = GOLD_COLOR;
    ctx.fillRect(badgeX, badgeY, badgeWidth, badgeHeight);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = `500 22px ${FONT_LEAGUE}`;
    ctx.textAlign = "center";
    ctx.fillText(`${statusLabel.toUpperCase()} AT`, badgeX + badgeWidth / 2, badgeY + 50);
    ctx.font = `700 52px ${FONT_LEAGUE}`;
    ctx.fillText(data.price || "$0", badgeX + badgeWidth / 2, badgeY + 110);

    // ============ ADDRESS BAR (height: ~100px) ============
    const addressBarY = headerHeight;
    const addressBarHeight = 100;
    
    ctx.fillStyle = DARK_TEXT;
    ctx.font = `500 40px ${FONT_LEAGUE}`;
    ctx.textAlign = "center";
    ctx.fillText(fullAddress, canvas.width / 2, addressBarY + 65);

    // ============ PHOTOS SECTION ============
    const photosY = addressBarY + addressBarHeight + 30;
    const photosPadding = 60;
    const photoGap = 20;
    
    // Main Photo - full width hero
    const mainPhotoWidth = canvas.width - photosPadding * 2;
    const mainPhotoHeight = 1100;
    
    if (photosToUse[0]) {
      const mainPhoto = document.createElement('img');
      mainPhoto.crossOrigin = "anonymous";
      await new Promise<void>((resolve) => {
        mainPhoto.onload = () => resolve();
        mainPhoto.onerror = () => resolve();
        mainPhoto.src = photosToUse[0];
      });
      if (mainPhoto.complete && mainPhoto.naturalWidth > 0) {
        // Draw with cover-fit
        const imgRatio = mainPhoto.naturalWidth / mainPhoto.naturalHeight;
        const targetRatio = mainPhotoWidth / mainPhotoHeight;
        let sx = 0, sy = 0, sw = mainPhoto.naturalWidth, sh = mainPhoto.naturalHeight;
        if (imgRatio > targetRatio) {
          sw = mainPhoto.naturalHeight * targetRatio;
          sx = (mainPhoto.naturalWidth - sw) / 2;
        } else {
          sh = mainPhoto.naturalWidth / targetRatio;
          sy = (mainPhoto.naturalHeight - sh) / 2;
        }
        ctx.drawImage(mainPhoto, sx, sy, sw, sh, photosPadding, photosY, mainPhotoWidth, mainPhotoHeight);
      }
    } else {
      ctx.fillStyle = "#f0f0f0";
      ctx.fillRect(photosPadding, photosY, mainPhotoWidth, mainPhotoHeight);
      ctx.fillStyle = "#999999";
      ctx.font = `48px ${FONT_MONTSERRAT}`;
      ctx.textAlign = "center";
      ctx.fillText("Main Photo", canvas.width / 2, photosY + mainPhotoHeight / 2);
    }

    // Secondary Photos - two side by side
    const secondaryY = photosY + mainPhotoHeight + photoGap;
    const secondaryHeight = 550;
    const secondaryWidth = (mainPhotoWidth - photoGap) / 2;

    for (let i = 1; i <= 2; i++) {
      const x = photosPadding + (i - 1) * (secondaryWidth + photoGap);
      if (photosToUse[i]) {
        const photo = document.createElement('img');
        photo.crossOrigin = "anonymous";
        await new Promise<void>((resolve) => {
          photo.onload = () => resolve();
          photo.onerror = () => resolve();
          photo.src = photosToUse[i];
        });
        if (photo.complete && photo.naturalWidth > 0) {
          // Draw with cover-fit
          const imgRatio = photo.naturalWidth / photo.naturalHeight;
          const targetRatio = secondaryWidth / secondaryHeight;
          let sx = 0, sy = 0, sw = photo.naturalWidth, sh = photo.naturalHeight;
          if (imgRatio > targetRatio) {
            sw = photo.naturalHeight * targetRatio;
            sx = (photo.naturalWidth - sw) / 2;
          } else {
            sh = photo.naturalWidth / targetRatio;
            sy = (photo.naturalHeight - sh) / 2;
          }
          ctx.drawImage(photo, sx, sy, sw, sh, x, secondaryY, secondaryWidth, secondaryHeight);
        }
      } else {
        ctx.fillStyle = "#f0f0f0";
        ctx.fillRect(x, secondaryY, secondaryWidth, secondaryHeight);
        ctx.fillStyle = "#999999";
        ctx.font = `36px ${FONT_MONTSERRAT}`;
        ctx.textAlign = "center";
        ctx.fillText(`Photo ${i + 1}`, x + secondaryWidth / 2, secondaryY + secondaryHeight / 2);
      }
    }

    // ============ BOTTOM INFO SECTION ============
    const infoY = secondaryY + secondaryHeight + 80;
    
    // Three column layout
    const leftColX = 100;
    const centerColX = canvas.width / 2;
    const rightColX = canvas.width - 450;
    const rightColWidth = 380;

    // LEFT COLUMN - Property Stats with simple line icons
    ctx.textAlign = "left";
    ctx.fillStyle = DARK_TEXT;
    ctx.font = `600 38px ${FONT_MONTSERRAT}`;
    
    const statsStartY = infoY + 60;
    const statSpacing = 60;
    const iconSize = 36;
    
    // Helper to draw simple line icons
    const drawBedIcon = (x: number, y: number) => {
      ctx.strokeStyle = DARK_TEXT;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.rect(x, y - iconSize/2 + 8, iconSize, iconSize/2);
      ctx.moveTo(x, y - iconSize/4 + 8);
      ctx.lineTo(x + iconSize, y - iconSize/4 + 8);
      ctx.stroke();
    };
    
    const drawBathIcon = (x: number, y: number) => {
      ctx.strokeStyle = DARK_TEXT;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x + iconSize/2, y, iconSize/2 - 4, 0, Math.PI);
      ctx.moveTo(x + 4, y);
      ctx.lineTo(x + iconSize - 4, y);
      ctx.stroke();
    };
    
    const drawSqftIcon = (x: number, y: number) => {
      ctx.strokeStyle = DARK_TEXT;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.rect(x + 4, y - iconSize/2 + 8, iconSize - 8, iconSize - 8);
      ctx.stroke();
    };
    
    // Draw icons
    drawBedIcon(leftColX, statsStartY);
    drawBathIcon(leftColX, statsStartY + statSpacing);
    drawSqftIcon(leftColX, statsStartY + statSpacing * 2);
    
    // Draw stat text
    ctx.fillText(`${data.bedrooms || "—"} bedrooms`, leftColX + 60, statsStartY);
    ctx.fillText(`${data.bathrooms || "—"} bathrooms`, leftColX + 60, statsStartY + statSpacing);
    ctx.fillText(`${data.sqft ? parseInt(data.sqft).toLocaleString() : "—"} sq. ft`, leftColX + 60, statsStartY + statSpacing * 2);

    // CENTER COLUMN - Headline + Description
    ctx.textAlign = "center";
    let descStartY = infoY + 50;
    
    if (data.listingHeadline) {
      ctx.font = `600 34px ${FONT_LEAGUE}`;
      ctx.fillStyle = DARK_TEXT;
      ctx.fillText(data.listingHeadline.toUpperCase(), centerColX, descStartY);
      descStartY += 60;
    }
    
    if (data.description) {
      const truncatedDesc = truncateDescription(data.description, DESCRIPTION_LIMITS.print);
      ctx.font = `400 30px ${FONT_MONTSERRAT}`;
      ctx.fillStyle = "#444444";
      
      const maxWidth = 900;
      const words = truncatedDesc.split(" ");
      let line = "";
      let descY = descStartY;
      const lineHeight = 45;
      
      words.forEach((word) => {
        const testLine = line + word + " ";
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && line !== "") {
          ctx.fillText(line.trim(), centerColX, descY);
          line = word + " ";
          descY += lineHeight;
        } else {
          line = testLine;
        }
      });
      if (line.trim()) {
        ctx.fillText(line.trim(), centerColX, descY);
      }
    }

    // RIGHT COLUMN - Agent Info
    ctx.textAlign = "center";
    const agentCenterX = rightColX + rightColWidth / 2;
    
    // Agent photo (circle) - larger size
    const agentCircleR = 100;
    const agentPhotoY = infoY + 20;
    
    if (effectiveAgentPhoto) {
      const agentImg = document.createElement('img');
      agentImg.crossOrigin = "anonymous";
      await new Promise<void>((resolve) => {
        agentImg.onload = () => resolve();
        agentImg.onerror = () => resolve();
        agentImg.src = effectiveAgentPhoto;
      });
      if (agentImg.complete && agentImg.naturalWidth > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(agentCenterX, agentPhotoY + agentCircleR, agentCircleR, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(agentImg, agentCenterX - agentCircleR, agentPhotoY, agentCircleR * 2, agentCircleR * 2);
        ctx.restore();
        
        // Add subtle border
        ctx.beginPath();
        ctx.arc(agentCenterX, agentPhotoY + agentCircleR, agentCircleR, 0, Math.PI * 2);
        ctx.strokeStyle = "#dddddd";
        ctx.lineWidth = 3;
        ctx.stroke();
      } else {
        // Placeholder circle with simple user silhouette
        ctx.beginPath();
        ctx.arc(agentCenterX, agentPhotoY + agentCircleR, agentCircleR, 0, Math.PI * 2);
        ctx.fillStyle = "#e0e0e0";
        ctx.fill();
        // Draw simple person silhouette
        ctx.fillStyle = "#999999";
        ctx.beginPath();
        ctx.arc(agentCenterX, agentPhotoY + agentCircleR - 20, 28, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(agentCenterX, agentPhotoY + agentCircleR + 60, 50, Math.PI, 0, true);
        ctx.fill();
      }
    } else {
      // Placeholder circle with simple user silhouette
      ctx.beginPath();
      ctx.arc(agentCenterX, agentPhotoY + agentCircleR, agentCircleR, 0, Math.PI * 2);
      ctx.fillStyle = "#e0e0e0";
      ctx.fill();
      // Draw simple person silhouette
      ctx.fillStyle = "#999999";
      ctx.beginPath();
      ctx.arc(agentCenterX, agentPhotoY + agentCircleR - 20, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(agentCenterX, agentPhotoY + agentCircleR + 60, 50, Math.PI, 0, true);
      ctx.fill();
    }

    // Agent name
    ctx.fillStyle = DARK_TEXT;
    ctx.font = `700 44px ${FONT_MONTSERRAT}`;
    ctx.fillText(data.agentName || "Agent Name", agentCenterX, agentPhotoY + agentCircleR * 2 + 55);
    
    // Agent title
    ctx.fillStyle = "#666666";
    ctx.font = `400 26px ${FONT_MONTSERRAT}`;
    ctx.fillText(data.agentTitle || "REALTOR®, Spyglass Realty", agentCenterX, agentPhotoY + agentCircleR * 2 + 95);
    
    // Agent phone
    ctx.font = `400 30px ${FONT_MONTSERRAT}`;
    ctx.fillText(data.agentPhone || "(XXX) XXX-XXXX", agentCenterX, agentPhotoY + agentCircleR * 2 + 135);

    // Small Spyglass logo under agent info
    const smallLogoHeight = 50;
    const smallLogoWidth = (logo.width / logo.height) * smallLogoHeight || 150;
    ctx.drawImage(logo, agentCenterX - smallLogoWidth / 2, agentPhotoY + agentCircleR * 2 + 160, smallLogoWidth, smallLogoHeight);

    // Bottom decorative bar - gold
    ctx.fillStyle = GOLD_COLOR;
    ctx.fillRect(0, canvas.height - 40, canvas.width, 40);
  };

  const generateFlyer = async (data: FormValues) => {
    const photosToUse = getPhotosForFlyer();
    
    if (photosToUse.length === 0) {
      toast({
        title: "Photos required",
        description: "Please select or upload at least one photo for the flyer",
        variant: "destructive",
      });
      return;
    }

    if (format === "print") {
      if (!data.agentName?.trim()) {
        toast({
          title: "Agent name required",
          description: "Please fill in your name for the print flyer",
          variant: "destructive",
        });
        return;
      }
      if (!data.agentPhone?.trim()) {
        toast({
          title: "Agent phone required",
          description: "Please fill in your phone number for the print flyer",
          variant: "destructive",
        });
        return;
      }
    }

    setIsGenerating(true);

    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not create canvas context");

      if (format === "social") {
        await generateSocialFlyer(ctx, canvas, data, photosToUse);
      } else {
        await generatePrintFlyer(ctx, canvas, data, photosToUse);
      }

      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      const addressSlug = transaction.propertyAddress.split(",")[0].replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
      link.download = format === "social" ? `${addressSlug}_social.png` : `${addressSlug}_flyer.png`;
      link.href = dataUrl;
      link.click();

      toast({
        title: format === "social" ? "Graphic downloaded" : "Flyer downloaded",
        description: `Your property ${format === "social" ? "graphic" : "flyer"} has been saved`,
      });
    } catch (error) {
      console.error("Flyer generation error:", error);
      toast({
        title: "Error generating flyer",
        description: "There was a problem creating your flyer. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const photosForFlyer = getPhotosForFlyer();
  const hasPhotosSelected = photosForFlyer.length > 0;
  const totalSelectedPhotos = selectedPhotos.length + uploadedPhotos.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[85vh] sm:max-h-[90vh] flex flex-col p-4 sm:p-6">
        <DialogHeader className="pb-2 sm:pb-4">
          <DialogTitle className="text-lg sm:text-xl">Create Property Flyer</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Choose a format, select photos, and customize details.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(generateFlyer)} className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 flex flex-col lg:flex-row gap-4 sm:gap-6 overflow-y-auto pr-1 sm:pr-2 min-h-0">
              <div className="flex-1 space-y-3 sm:space-y-4 min-w-0">
                <div className="space-y-2">
                  <FormLabel className="text-sm">Format</FormLabel>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleFormatChange("social")}
                      className={`flex flex-col items-center gap-1 sm:gap-1.5 p-2.5 sm:p-3 rounded-lg border-2 transition-all active:scale-[0.98] ${
                        format === "social"
                          ? "border-primary bg-primary/5"
                          : "border-muted hover:border-muted-foreground/50"
                      }`}
                      data-testid="button-format-social"
                    >
                      <Image className={`h-5 w-5 ${format === "social" ? "text-primary" : "text-muted-foreground"}`} />
                      <span className={`text-xs sm:text-sm font-medium ${format === "social" ? "text-primary" : ""}`}>
                        Social Media
                      </span>
                      <span className="text-[9px] sm:text-[10px] text-muted-foreground text-center leading-tight">
                        Instagram/Facebook
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFormatChange("print")}
                      className={`flex flex-col items-center gap-1 sm:gap-1.5 p-2.5 sm:p-3 rounded-lg border-2 transition-all active:scale-[0.98] ${
                        format === "print"
                          ? "border-primary bg-primary/5"
                          : "border-muted hover:border-muted-foreground/50"
                      }`}
                      data-testid="button-format-print"
                    >
                      <FileText className={`h-5 w-5 ${format === "print" ? "text-primary" : "text-muted-foreground"}`} />
                      <span className={`text-xs sm:text-sm font-medium ${format === "print" ? "text-primary" : ""}`}>
                        Print Flyer
                      </span>
                      <span className="text-[9px] sm:text-[10px] text-muted-foreground text-center leading-tight">
                        8.5×11 Print
                      </span>
                    </button>
                  </div>
                </div>

                {mlsPhotos.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-sm">
                        Select {format === "social" ? "1 photo" : "up to 3 photos"}
                      </FormLabel>
                      <div className="flex items-center gap-2">
                        {(mlsData?.mlsNumber || transaction.mlsNumber) && (
                          <Tooltip delayDuration={300}>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleAutoSelectPhotos}
                                disabled={isAutoSelecting}
                                className="h-6 text-xs gap-1"
                                data-testid="button-auto-select-photos"
                              >
                                {isAutoSelecting ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Sparkles className="h-3 w-3" />
                                )}
                                Auto-Select
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-[250px] p-3">
                              <div className="font-semibold mb-1">Smart Photo Selection</div>
                              <div className="text-xs text-muted-foreground mb-2">
                                Using AI Image Insights to select:
                              </div>
                              {format === "social" ? (
                                <ul className="text-xs space-y-0.5">
                                  <li>• Best Exterior/Front photo</li>
                                </ul>
                              ) : (
                                <ul className="text-xs space-y-0.5">
                                  <li>• Photo 1: Best Exterior/Front</li>
                                  <li>• Photo 2: Best Kitchen</li>
                                  <li>• Photo 3: Best Living Room</li>
                                </ul>
                              )}
                              <div className="text-[10px] text-muted-foreground mt-2">
                                Based on room classification & quality scores
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {selectedPhotos.length}/{maxPhotos} selected
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 sm:gap-1.5 max-h-32 sm:max-h-28 overflow-y-auto p-1.5 sm:p-1 border rounded-md bg-muted/30">
                      {mlsPhotos.map((photo, index) => {
                        const isSelected = selectedPhotos.includes(photo);
                        const selectionIndex = selectedPhotos.indexOf(photo);
                        const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(photo)}`;
                        const insight = photoInsights[photo];
                        const roomType = insight?.classification && insight.classification !== "Unknown" 
                          ? insight.classification 
                          : null;
                        return (
                          <div key={index} className="relative aspect-square group">
                            <button
                              type="button"
                              onClick={() => togglePhotoSelection(photo)}
                              className={`w-full h-full rounded overflow-hidden group transition-all ${
                                isSelected 
                                  ? "ring-2 ring-primary ring-offset-1" 
                                  : "hover:ring-1 hover:ring-muted-foreground/50"
                              }`}
                              data-testid={`button-mls-photo-${index}`}
                            >
                              <img
                                src={proxyUrl}
                                alt={`MLS Photo ${index + 1}`}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                              {isSelected && (
                                <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                  <div className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">
                                    {selectionIndex + 1}
                                  </div>
                                </div>
                              )}
                              {!isSelected && selectedPhotos.length < maxPhotos && (
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <Check className="h-4 w-4 text-white" />
                                </div>
                              )}
                              {roomType && (
                                <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                                  <span className="text-[8px] text-white font-medium truncate block">
                                    {roomType}
                                  </span>
                                </div>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedPhotoUrl(proxyUrl);
                              }}
                              className="absolute top-0.5 right-0.5 p-0.5 bg-black/50 hover:bg-black/70 rounded text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
                              data-testid={`button-expand-photo-${index}`}
                            >
                              <ZoomIn className="h-3 w-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {mlsPhotos.length > 0 && (
                  <div className="border rounded-md overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowUploadSection(!showUploadSection)}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
                      data-testid="button-toggle-upload"
                    >
                      <span className="flex items-center gap-1.5">
                        <Upload className="h-3.5 w-3.5" />
                        {totalSelectedPhotos >= maxPhotos ? "Replace with custom photos" : "Upload custom photos"}
                      </span>
                      {showUploadSection ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                    
                    {showUploadSection && (
                      <div className="px-3 pb-3 pt-1 border-t space-y-2">
                        <div
                          className={`border-2 border-dashed rounded-md p-3 text-center transition-colors ${
                            isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"
                          }`}
                          onDrop={handleDrop}
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          data-testid="dropzone-photos"
                        >
                          <Upload className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground mb-1">
                            {totalSelectedPhotos >= maxPhotos 
                              ? "Upload to replace MLS photos" 
                              : "Drag photos or click to browse"}
                          </p>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            id="photo-upload"
                            onChange={(e) => handleFileUpload(e.target.files)}
                            data-testid="input-photo-upload"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={() => document.getElementById("photo-upload")?.click()}
                            data-testid="button-browse-photos"
                          >
                            {totalSelectedPhotos >= maxPhotos ? "Replace Photos" : "Browse"}
                          </Button>
                        </div>
                        
                        {uploadedPhotos.length > 0 && (
                          <div className="flex gap-1.5 flex-wrap">
                            {uploadedPhotos.map((photo, index) => (
                              <div key={index} className="relative w-12 h-12 rounded overflow-hidden group">
                                <img src={photo} alt={`Upload ${index + 1}`} className="w-full h-full object-cover" />
                                <button
                                  type="button"
                                  onClick={() => removeUploadedPhoto(index)}
                                  className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                  data-testid={`button-remove-photo-${index}`}
                                >
                                  <X className="h-2 w-2" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {mlsPhotos.length === 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-sm">Property Photos</FormLabel>
                      <span className="text-xs text-muted-foreground">
                        {maxPhotos - totalSelectedPhotos} slot{maxPhotos - totalSelectedPhotos !== 1 ? 's' : ''} left
                      </span>
                    </div>
                    <div
                      className={`border-2 border-dashed rounded-md p-3 text-center transition-colors ${
                        isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"
                      } ${totalSelectedPhotos >= maxPhotos ? "opacity-50 pointer-events-none" : ""}`}
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      data-testid="dropzone-photos"
                    >
                      <Upload className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground mb-1">
                        Drag photos or click to browse
                      </p>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        id="photo-upload-no-mls"
                        onChange={(e) => handleFileUpload(e.target.files)}
                        disabled={totalSelectedPhotos >= maxPhotos}
                        data-testid="input-photo-upload"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => document.getElementById("photo-upload-no-mls")?.click()}
                        disabled={totalSelectedPhotos >= maxPhotos}
                        data-testid="button-browse-photos"
                      >
                        Browse
                      </Button>
                    </div>

                    {uploadedPhotos.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap">
                        {uploadedPhotos.map((photo, index) => (
                          <div key={index} className="relative w-12 h-12 rounded overflow-hidden group">
                            <img src={photo} alt={`Upload ${index + 1}`} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => removeUploadedPhoto(index)}
                              className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                              data-testid={`button-remove-photo-${index}`}
                            >
                              <X className="h-2 w-2" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Price</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="$500,000"
                            className="h-8"
                            data-testid="input-flyer-price"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-8" data-testid="select-flyer-status">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {STATUS_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <FormField
                    control={form.control}
                    name="bedrooms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Beds</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="3"
                            type="number"
                            className="h-8"
                            data-testid="input-flyer-beds"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bathrooms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Baths</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="2"
                            type="number"
                            className="h-8"
                            data-testid="input-flyer-baths"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="sqft"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Sq Ft</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="1,500"
                            type="number"
                            className="h-8"
                            data-testid="input-flyer-sqft"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => {
                    // Use maxDescriptionLength directly for consistency
                    const isOverLimit = currentDescriptionLength > maxDescriptionLength;
                    const isNearLimit = currentDescriptionLength > maxDescriptionLength - 10 && currentDescriptionLength <= maxDescriptionLength;
                    
                    return (
                      <FormItem>
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <FormLabel className="text-sm">Description</FormLabel>
                          <div className="flex items-center gap-1.5">
                            {/* AI Summarize button - shown for BOTH formats */}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={handleSummarize}
                              disabled={isSummarizing || !originalDescription}
                              className="h-7 text-xs"
                              data-testid="button-ai-summarize"
                            >
                              {isSummarizing ? (
                                <>
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                  Summarizing...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="h-3 w-3 mr-1" />
                                  AI Summarize
                                </>
                              )}
                            </Button>
                            
                            {/* Revert dropdown - shown after AI has been used */}
                            {hasSummarized && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs px-2"
                                    data-testid="button-revert-dropdown"
                                  >
                                    <Undo2 className="h-3 w-3 mr-1" />
                                    Revert
                                    <ChevronDown className="h-3 w-3 ml-1" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem 
                                    onClick={handleRevertToPrevious}
                                    disabled={previousDescription === null}
                                    data-testid="button-revert-previous"
                                  >
                                    Revert to Previous
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={handleRevertToOriginal}
                                    data-testid="button-revert-original"
                                  >
                                    Revert to Original
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </div>
                        <FormControl>
                          <Textarea
                            placeholder="Enter a brief property description..."
                            className="resize-none h-20"
                            data-testid="input-flyer-description"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription className="flex flex-col gap-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                              {hasSummarized 
                                ? "Click AI Summarize again for a different variation"
                                : "Click 'AI Summarize' to create a concise summary"
                              }
                            </span>
                            <span className={
                              isOverLimit 
                                ? "text-red-600 font-medium" 
                                : isNearLimit 
                                  ? "text-amber-600 font-medium" 
                                  : "text-green-600"
                            }>
                              {currentDescriptionLength}/{maxDescriptionLength}
                              {isOverLimit && " (will truncate)"}
                            </span>
                          </div>
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />

                {format === "print" && (
                  <>
                    <div className="border-t pt-3 mt-2">
                      <FormLabel className="text-sm font-medium text-muted-foreground">Agent Information</FormLabel>
                    </div>

                    <FormField
                      control={form.control}
                      name="listingHeadline"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">Listing Headline (optional)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., OPEN HOUSE SATURDAY"
                              className="h-8"
                              maxLength={39}
                              data-testid="input-listing-headline"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
                            Optional headline (39 characters max) - appears above description
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={form.control}
                        name="agentName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm">Agent Name *</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Enter your name"
                                className="h-8"
                                data-testid="input-agent-name"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="agentTitle"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm">Agent Title</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="REALTOR®"
                                className="h-8"
                                data-testid="input-agent-title"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="agentPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">Agent Phone *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="(512) 555-1234"
                              className="h-8"
                              data-testid="input-agent-phone"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-2">
                      <FormLabel className="text-sm">Agent Photo</FormLabel>
                      <div className="flex items-center gap-3">
                        {effectiveAgentPhoto ? (
                          <div className="relative">
                            <img
                              src={effectiveAgentPhoto}
                              alt="Agent"
                              className="w-14 h-14 rounded-full object-cover border-2 border-muted"
                            />
                            <button
                              type="button"
                              onClick={() => setLocalAgentPhoto(null)}
                              className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                              data-testid="button-remove-agent-photo"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center border-2 border-dashed border-muted-foreground/25">
                            <User className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            id="agent-photo-upload"
                            onChange={(e) => handleAgentPhotoUpload(e.target.files?.[0] || null)}
                            data-testid="input-agent-photo"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => document.getElementById("agent-photo-upload")?.click()}
                            data-testid="button-upload-agent-photo"
                          >
                            <Upload className="h-3 w-3 mr-1" />
                            {effectiveAgentPhoto ? "Change Photo" : "Upload Photo"}
                          </Button>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Optional - shows placeholder if not uploaded
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="w-full lg:w-48 flex-shrink-0 order-first lg:order-last">
                <div className="sticky top-0">
                  <p className="text-xs font-medium text-muted-foreground mb-2 text-center">
                    Preview
                  </p>
                  <div 
                    className="flex justify-center lg:block cursor-pointer relative group"
                    onClick={() => setPreviewEnlarged(true)}
                    data-testid="button-enlarge-preview"
                  >
                    {format === "social" ? (
                      <SocialMediaPreview
                        photoUrls={previewPhotoUrls}
                        status={watchedValues.status || "just_listed"}
                        price={watchedValues.price || "$0"}
                        address={transaction.propertyAddress}
                        bedrooms={watchedValues.bedrooms}
                        bathrooms={watchedValues.bathrooms}
                        sqft={watchedValues.sqft}
                        description={watchedValues.description}
                      />
                    ) : (
                      <PrintFlyerPreview
                        photoUrls={previewPhotoUrls}
                        status={watchedValues.status || "just_listed"}
                        price={watchedValues.price || "$0"}
                        address={transaction.propertyAddress}
                        bedrooms={watchedValues.bedrooms}
                        bathrooms={watchedValues.bathrooms}
                        sqft={watchedValues.sqft}
                        description={watchedValues.description}
                        agentName={watchedValues.agentName}
                        agentTitle={watchedValues.agentTitle}
                        agentPhone={watchedValues.agentPhone}
                        agentPhotoUrl={effectiveAgentPhoto || undefined}
                        listingHeadline={watchedValues.listingHeadline}
                      />
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                      <div className="bg-white/90 rounded-full p-2">
                        <Maximize2 className="h-4 w-4 text-gray-700" />
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground text-center mt-1">
                    Click to enlarge
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-3 sm:pt-4 border-t mt-3 sm:mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="w-full sm:w-auto"
                data-testid="button-cancel-flyer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isGenerating || !hasPhotosSelected}
                className="w-full sm:w-auto"
                data-testid="button-generate-flyer"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                {format === "social" ? "Download Graphic" : "Download Flyer"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>

      {/* Enlarged Preview Modal */}
      {previewEnlarged && (
        <Dialog open={previewEnlarged} onOpenChange={setPreviewEnlarged}>
          <DialogContent className="w-[95vw] max-w-[min(95vw,1000px)] max-h-[90vh] p-2 sm:p-3 flex flex-col">
            <DialogHeader className="pb-1 px-2">
              <DialogTitle className="text-base">Preview - {format === "social" ? "Social Media" : "Print Flyer"}</DialogTitle>
              <DialogDescription className="text-xs">
                Full-size preview of your flyer
              </DialogDescription>
            </DialogHeader>

            {/* Zoom Controls Toolbar */}
            <div className="flex items-center justify-center gap-2 py-1.5 border-b">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={handleZoomOut}
                disabled={zoomLevel <= 50}
                data-testid="button-zoom-out"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <div className="w-14 text-center text-sm font-medium" data-testid="text-zoom-level">
                {zoomLevel}%
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={handleZoomIn}
                disabled={zoomLevel >= 300}
                data-testid="button-zoom-in"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="ml-2 h-8"
                onClick={handleZoomReset}
                disabled={zoomLevel === 100}
                data-testid="button-zoom-fit"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Fit
              </Button>
            </div>

            {/* Scrollable Preview Area - Reduced padding */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="flex justify-center py-2 px-1">
                <div 
                  className="transition-transform duration-200 ease-out origin-top"
                  style={{ transform: `scale(${zoomLevel / 100})` }}
                >
                  {/* Larger preview sizes for better fill */}
                  <div className={format === "social" ? "w-72 sm:w-80" : "w-[340px] sm:w-[400px]"}>
                    {format === "social" ? (
                      <SocialMediaPreview
                        photoUrls={previewPhotoUrls}
                        status={watchedValues.status || "just_listed"}
                        price={watchedValues.price || "$0"}
                        address={transaction.propertyAddress}
                        bedrooms={watchedValues.bedrooms}
                        bathrooms={watchedValues.bathrooms}
                        sqft={watchedValues.sqft}
                        description={watchedValues.description}
                      />
                    ) : (
                      <PrintFlyerPreview
                        photoUrls={previewPhotoUrls}
                        status={watchedValues.status || "just_listed"}
                        price={watchedValues.price || "$0"}
                        address={transaction.propertyAddress}
                        bedrooms={watchedValues.bedrooms}
                        bathrooms={watchedValues.bathrooms}
                        sqft={watchedValues.sqft}
                        description={watchedValues.description}
                        agentName={watchedValues.agentName}
                        agentTitle={watchedValues.agentTitle}
                        agentPhone={watchedValues.agentPhone}
                        agentPhotoUrl={effectiveAgentPhoto || undefined}
                        listingHeadline={watchedValues.listingHeadline}
                      />
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>

            <div className="flex justify-end pt-2 border-t">
              <Button variant="outline" onClick={() => setPreviewEnlarged(false)}>
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Expanded Photo Modal */}
      {expandedPhotoUrl && (
        <Dialog open={!!expandedPhotoUrl} onOpenChange={() => setExpandedPhotoUrl(null)}>
          <DialogContent className="w-[95vw] max-w-3xl max-h-[90vh] p-2">
            <DialogHeader className="sr-only">
              <DialogTitle>Photo Preview</DialogTitle>
              <DialogDescription>Enlarged view of selected photo</DialogDescription>
            </DialogHeader>
            <div className="relative">
              <img
                src={expandedPhotoUrl}
                alt="Expanded photo"
                className="w-full h-auto max-h-[80vh] object-contain rounded"
              />
              <Button
                variant="outline"
                size="icon"
                className="absolute top-2 right-2 bg-white/90 hover:bg-white"
                onClick={() => setExpandedPhotoUrl(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}
