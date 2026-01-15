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
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import type { Transaction, MLSData } from "@shared/schema";

import spyglassLogoBlack from "@assets/SpyglassRealty_Logo_Black_(1)_1767985123384.png";

// Single source of truth for character limits
const DESCRIPTION_LIMITS = {
  print: 150,  // Character limit for print flyer description
} as const;

const STATUS_OPTIONS = [
  { value: "for_sale", label: "For Sale" },
  { value: "just_listed", label: "Just Listed" },
  { value: "under_contract", label: "Under Contract" },
  { value: "just_sold", label: "Just Sold" },
  { value: "for_lease", label: "For Lease" },
  { value: "open_house", label: "Open House" },
];

const OPEN_HOUSE_DAY_OPTIONS = [
  { value: "", label: "None" },
  { value: "Saturday", label: "Saturday" },
  { value: "Sunday", label: "Sunday" },
  { value: "Sat & Sun", label: "Sat & Sun" },
];

const formSchema = z.object({
  price: z.string().min(1, "Price is required"),
  status: z.enum(["for_sale", "just_listed", "under_contract", "just_sold", "for_lease", "open_house"]),
  bedrooms: z.string().optional(),
  bathrooms: z.string().optional(),
  sqft: z.string().optional(),
  description: z.string().optional(),
  agentName: z.string().optional(),
  agentTitle: z.string().optional(),
  agentPhone: z.string().optional(),
  listingHeadline: z.string().max(39, "Max 39 characters").optional(),
  openHouseDay: z.string().optional(),
  openHouseDate: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

function truncateDescription(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text || "";
  
  // If text ends with proper punctuation (complete sentence), truncate at last sentence
  const truncated = text.substring(0, maxLength);
  
  // Find last complete sentence ending
  const lastPeriod = truncated.lastIndexOf('.');
  const lastExclaim = truncated.lastIndexOf('!');
  const lastQuestion = truncated.lastIndexOf('?');
  const lastSentenceEnd = Math.max(lastPeriod, lastExclaim, lastQuestion);
  
  // If we have a complete sentence within the limit, use it (no ellipsis needed)
  if (lastSentenceEnd > maxLength * 0.4) {
    return truncated.substring(0, lastSentenceEnd + 1);
  }
  
  // Otherwise truncate at word boundary and add period (not ellipsis)
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > 0) {
    let result = truncated.substring(0, lastSpace).trim();
    // Remove trailing punctuation before adding period
    result = result.replace(/[,;:\-]$/, '');
    // Ensure ends with proper punctuation
    if (!/[.!?]$/.test(result)) {
      result += '.';
    }
    return result;
  }
  return truncated.trim();
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
  
  // Format address: keep numbers together, space out letters
  const formatAddressForFlyer = (addr: string): string => {
    return addr
      .split(' ')
      .map(word => {
        if (/^\d+$/.test(word)) {
          return word;
        }
        return word.split('').join(' ');
      })
      .join('   ');
  };
  const formattedStreetAddress = formatAddressForFlyer(streetAddress);

  return (
    <div className="relative w-full aspect-[8.5/11] bg-white rounded-lg overflow-hidden shadow-lg border border-border" style={{ fontFamily: "'League Spartan', 'Montserrat', sans-serif" }}>
      {/* Header Section - Logo left, Price right only */}
      <div className="flex items-center justify-between px-2 py-2 bg-white border-b border-gray-100">
        {/* Left: Spyglass logo */}
        <img
          src={spyglassLogoBlack}
          alt="Spyglass Realty"
          className="h-7 w-auto"
        />
        {/* Right: Price badge - tan/brown rectangle */}
        <div 
          className="text-white px-3 py-1.5"
          style={{ backgroundColor: '#8b7355' }}
        >
          <p className="text-[4px] tracking-[0.12em] text-center font-medium">{statusLabel.toUpperCase()} AT</p>
          <p className="text-[9px] font-bold text-center">{price || "$0"}</p>
        </div>
      </div>

      {/* Address Bar - Plain text, no dark background */}
      <div className="py-1.5 px-2 text-left">
        <p className="text-[5px] text-[#333333] tracking-[0.08em] font-medium uppercase">
          {streetAddress}
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

      {/* Info Section - 3 Columns (expanded per template) */}
      <div className="bg-white px-2 py-3 grid grid-cols-3 gap-2">
        {/* Left Column - Property Stats with custom icons (matching template) */}
        <div className="space-y-1.5 pl-0.5">
          <div className="flex items-center gap-1.5 text-[#333]">
            {/* Custom bed icon - matching template style */}
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 18v-6a2 2 0 012-2h14a2 2 0 012 2v6M3 18h18M3 12V8a2 2 0 012-2h4v6M7 6v4"/>
              <rect x="3" y="18" width="18" height="2" fill="none"/>
            </svg>
            <span className="text-[7px] font-semibold">{bedrooms || "—"} bedrooms</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#333]">
            {/* Custom bath icon - matching template style */}
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 12h16a2 2 0 012 2v2a4 4 0 01-4 4H6a4 4 0 01-4-4v-2a2 2 0 012-2z"/>
              <path d="M6 12V6a2 2 0 012-2h1a1 1 0 011 1v1a1 1 0 001 1h2"/>
              <path d="M6 20v2M18 20v2"/>
            </svg>
            <span className="text-[7px] font-semibold">{bathrooms || "—"} bathrooms</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#333]">
            {/* Custom sqft icon - rectangle with diagonal measurement */}
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="5" width="18" height="14" rx="1"/>
              <path d="M7 15l10-6M17 9l-2 1M17 9l-1 2"/>
            </svg>
            <span className="text-[7px] font-semibold">{sqft ? parseInt(sqft).toLocaleString() : "—"} sq. ft</span>
          </div>
        </div>

        {/* Center Column - Headline + Description (larger) */}
        <div className="text-center px-0.5">
          {listingHeadline && (
            <p className="text-[6px] font-semibold text-[#333] tracking-wider uppercase mb-1">
              {listingHeadline}
            </p>
          )}
          {truncatedDesc && (
            <p className="text-[6px] text-gray-600 leading-relaxed line-clamp-4">
              {truncatedDesc}
            </p>
          )}
        </div>

        {/* Right Column - Agent Info */}
        <div className="text-center pr-0.5 space-y-0.5 relative">
          {agentPhotoUrl ? (
            <img 
              src={agentPhotoUrl} 
              alt="Agent" 
              className="w-8 h-8 mx-auto rounded-full object-cover border border-gray-200"
            />
          ) : (
            <div className="w-8 h-8 mx-auto bg-gray-200 rounded-full flex items-center justify-center">
              <User className="h-4 w-4 text-gray-400" />
            </div>
          )}
          <p className="text-[7px] font-bold text-[#333] capitalize">{agentName || "Agent Name"}</p>
          <p className="text-[5px] text-gray-500">{agentTitle || "REALTOR®"}</p>
          <p className="text-[6px] text-gray-600">{agentPhone || "(XXX) XXX-XXXX"}</p>
          <img
            src={spyglassLogoBlack}
            alt="Logo"
            className="h-4 w-auto mx-auto mt-1"
          />
        </div>
      </div>

      {/* NO gold footer bar per template */}
    </div>
  );
}

export interface FlyerAssetConfig {
  status: string;
  description?: string;
  headline?: string;
  photoUrls: string[];
  agentName?: string;
  agentTitle?: string;
  agentPhone?: string;
  agentPhotoUrl?: string;
  format: 'print';
  price?: string;
  bedrooms?: string;
  bathrooms?: string;
  sqft?: string;
}

interface CreateFlyerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction;
  mlsPhotos?: string[];
  agentName?: string;
  agentPhone?: string;
  agentPhotoUrl?: string;
  onAssetSaved?: () => void;
  initialData?: FlyerAssetConfig;
  assetId?: string;
}

export function CreateFlyerDialog({
  open,
  onOpenChange,
  transaction,
  mlsPhotos = [],
  agentName = "",
  onAssetSaved,
  agentPhone = "",
  agentPhotoUrl,
  initialData,
  assetId,
}: CreateFlyerDialogProps) {
  const isEditMode = Boolean(assetId && initialData);
  const { toast } = useToast();
  // Format is always "print" - social media graphics are handled by MarketingMaterialsDialog
  const format = "print" as const;
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
  const [isGeneratingHeadline, setIsGeneratingHeadline] = useState(false);
  const [isAutoSelecting, setIsAutoSelecting] = useState(false);
  const [photoInsights, setPhotoInsights] = useState<Record<string, { classification: string; quality: number }>>({});
  const [originalDescription, setOriginalDescription] = useState<string>("");
  const [previousDescription, setPreviousDescription] = useState<string | null>(null);
  const [hasSummarized, setHasSummarized] = useState(false);
  const [previousHeadline, setPreviousHeadline] = useState<string | null>(null);
  const [hasGeneratedHeadline, setHasGeneratedHeadline] = useState(false);
  const [renderedPreviewUrl, setRenderedPreviewUrl] = useState<string | null>(null);
  const [isRenderingPreview, setIsRenderingPreview] = useState(false);

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
  const maxPhotos = 3; // Print flyer uses up to 3 photos
  const maxDescriptionLength = DESCRIPTION_LIMITS.print;

  // Build full address from MLS data (street, city, state, zip)
  const getFullAddress = useCallback((): string => {
    const mls = mlsData as any;
    
    // Get street address
    const street = mls?.address?.streetAddress || 
                   mls?.streetAddress ||
                   transaction.propertyAddress?.split(',')[0]?.trim() || 
                   '';
    
    // Get city
    const city = mls?.address?.city || 
                 mls?.city || 
                 '';
    
    // Get state
    const state = mls?.address?.state || 
                  mls?.address?.stateOrProvince ||
                  mls?.state || 
                  'TX';
    
    // Get zip
    const zip = mls?.address?.zip || 
                mls?.address?.postalCode ||
                mls?.zip || 
                mls?.postalCode ||
                '';
    
    // Build: "Street, City, ST ZIP"
    let fullAddress = street;
    if (city) fullAddress += `, ${city}`;
    if (state) fullAddress += `, ${state}`;
    if (zip) fullAddress += ` ${zip}`;
    
    return fullAddress.toUpperCase();
  }, [mlsData, transaction.propertyAddress]);

  const resetPhotoSelection = useCallback(() => {
    if (mlsPhotos.length > 0) {
      setSelectedPhotos(mlsPhotos.slice(0, 3));
    } else {
      setSelectedPhotos([]);
    }
    setUploadedPhotos([]);
  }, [mlsPhotos]);

  useEffect(() => {
    if (open) {
      // If editing, restore saved state from initialData
      if (isEditMode && initialData) {
        setSelectedPhotos(initialData.photoUrls || []);
        if (initialData.agentPhotoUrl) {
          setLocalAgentPhoto(initialData.agentPhotoUrl);
        }
        // Reset form with saved values
        form.reset({
          price: initialData.price || transaction.listPrice ? `$${transaction.listPrice?.toLocaleString()}` : "",
          status: initialData.status as any || "just_listed",
          bedrooms: initialData.bedrooms || mlsData?.bedrooms?.toString() || "",
          bathrooms: initialData.bathrooms || mlsData?.bathrooms?.toString() || "",
          sqft: initialData.sqft || mlsData?.sqft?.toString() || "",
          description: initialData.description || mlsData?.description || "",
          agentName: initialData.agentName || agentName || "",
          agentTitle: initialData.agentTitle || "REALTOR®",
          agentPhone: initialData.agentPhone || agentPhone || "",
          listingHeadline: initialData.headline || "",
        });
      } else {
        resetPhotoSelection();
        if (mlsPhotos.length === 0) {
          setShowUploadSection(true);
        }
      }
      // Store original MLS description when dialog opens
      const mlsDescription = mlsData?.description || "";
      setOriginalDescription(mlsDescription);
      setPreviousDescription(null);
      setHasSummarized(false);
      // Reset headline revert state
      setPreviousHeadline(null);
      setHasGeneratedHeadline(false);
    }
  }, [open, mlsPhotos.length, mlsData?.description, isEditMode, initialData]);

  useEffect(() => {
    if (!open) {
      setSelectedPhotos([]);
      setUploadedPhotos([]);
      setShowUploadSection(false);
      setLocalAgentPhoto(null);
      setZoomLevel(100);
      // Clear rendered preview when dialog closes
      if (renderedPreviewUrl) {
        URL.revokeObjectURL(renderedPreviewUrl);
        setRenderedPreviewUrl(null);
      }
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
      openHouseDay: "",
      openHouseDate: "",
    },
  });

  const watchedValues = useWatch({ control: form.control });
  const currentDescriptionLength = watchedValues.description?.length || 0;

  // Clear Open House fields when status changes away from "open_house"
  useEffect(() => {
    if (watchedValues.status !== 'open_house') {
      form.setValue('openHouseDay', '');
      form.setValue('openHouseDate', '');
    }
  }, [watchedValues.status, form]);

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
  }, [form, transaction.propertyAddress, toast, originalDescription]);

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

  const handleGenerateHeadline = useCallback(async () => {
    if (!originalDescription || originalDescription.trim().length === 0) {
      toast({
        title: "No description",
        description: "No MLS description available to generate headline from.",
        variant: "destructive",
      });
      return;
    }

    // Save current headline before generating new one
    const currentHeadline = form.getValues("listingHeadline");
    setPreviousHeadline(currentHeadline || null);

    setIsGeneratingHeadline(true);
    try {
      const response = await apiRequest("POST", "/api/generate-headline", {
        description: originalDescription,
        address: transaction.propertyAddress,
        beds: form.getValues("bedrooms"),
        baths: form.getValues("bathrooms"),
        sqft: form.getValues("sqft"),
      });

      const data = await response.json();
      
      if (data.headline) {
        form.setValue("listingHeadline", data.headline);
        setHasGeneratedHeadline(true);
        toast({
          title: "Headline generated!",
          description: "AI created a catchy headline for your flyer.",
        });
      }
    } catch (error) {
      console.error("Headline generation error:", error);
      toast({
        title: "Generation failed",
        description: "Could not generate headline. Please try again or enter manually.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingHeadline(false);
    }
  }, [originalDescription, form, toast, transaction.propertyAddress]);

  const handleRevertToPreviousHeadline = useCallback(() => {
    if (previousHeadline !== null) {
      const currentHeadline = form.getValues("listingHeadline");
      form.setValue("listingHeadline", previousHeadline);
      setPreviousHeadline(currentHeadline || null);
      toast({
        title: "Reverted",
        description: "Headline reverted to previous version.",
      });
    }
  }, [form, previousHeadline, toast]);

  const handleClearHeadline = useCallback(() => {
    const currentHeadline = form.getValues("listingHeadline");
    setPreviousHeadline(currentHeadline || null);
    form.setValue("listingHeadline", "");
    toast({
      title: "Cleared",
      description: "Headline has been cleared.",
    });
  }, [form, toast]);

  const togglePhotoSelection = (photoUrl: string) => {
    setSelectedPhotos((prev) => {
      if (prev.includes(photoUrl)) {
        return prev.filter((p) => p !== photoUrl);
      }
      if (prev.length >= maxPhotos) {
        toast({
          title: "Maximum photos selected",
          description: `You can select up to ${maxPhotos} photos for the print flyer`,
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

  // Render pixel-identical preview using Puppeteer (same as download)
  const renderActualPreview = useCallback(async () => {
    const photosToUse = getPhotosForFlyer();
    if (photosToUse.length === 0) {
      toast({
        title: "Photos required",
        description: "Please select at least one photo first",
        variant: "destructive",
      });
      return;
    }
    
    const data = form.getValues();
    if (!data.agentName?.trim() || !data.agentPhone?.trim()) {
      toast({
        title: "Agent info required",
        description: "Please fill in agent name and phone",
        variant: "destructive",
      });
      return;
    }
    
    setIsRenderingPreview(true);
    
    try {
      const effectiveAgentPhoto = localAgentPhoto || agentPhotoUrl || "";
      
      const response = await fetch('/api/flyer/render', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: data.status,
          price: data.price,
          address: getFullAddress(),
          photos: photosToUse,
          beds: mlsData?.bedrooms || 0,
          baths: mlsData?.bathrooms || 0,
          sqft: mlsData?.sqft || 0,
          headline: data.listingHeadline,
          description: data.description,
          agentName: data.agentName,
          agentTitle: data.agentTitle,
          agentPhone: data.agentPhone,
          agentPhoto: effectiveAgentPhoto,
          openHouseDay: data.openHouseDay && data.openHouseDay !== 'none' ? data.openHouseDay.toUpperCase() : '',
          openHouseDate: data.openHouseDate || '',
          mlsNumber: transaction.mlsNumber || '',
          outputType: 'pngPreview'
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to render preview');
      }
      
      const blob = await response.blob();
      
      // Revoke old URL if exists
      if (renderedPreviewUrl) {
        URL.revokeObjectURL(renderedPreviewUrl);
      }
      
      const url = URL.createObjectURL(blob);
      setRenderedPreviewUrl(url);
      
      toast({
        title: "Preview rendered",
        description: "Showing actual output preview",
      });
    } catch (error) {
      console.error("Preview render error:", error);
      toast({
        title: "Preview failed",
        description: "Could not render preview. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRenderingPreview(false);
    }
  }, [form, toast, getFullAddress, mlsData, localAgentPhoto, agentPhotoUrl, renderedPreviewUrl, getPhotosForFlyer]);

  const generatePrintFlyer = async (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, data: FormValues, photosToUse: string[]) => {
    canvas.width = 2550;
    canvas.height = 3300;
    
    // Clear canvas for clean render
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const GOLD_COLOR = "#c4a962";
    const DARK_TEXT = "#333333";
    const FONT_LEAGUE = "League Spartan, sans-serif";
    const FONT_MONTSERRAT = "Montserrat, sans-serif";

    const address = transaction.propertyAddress;
    const addressParts = address.split(",");
    const streetAddress = addressParts[0].trim().toUpperCase();
    const cityStateZip = addressParts.slice(1).join(",").trim().toUpperCase();
    
    // Format address: keep numbers together, space out letters
    const formatAddressForFlyer = (addr: string): string => {
      return addr
        .split(' ')
        .map(word => {
          // Keep numbers together (street number)
          if (/^\d+$/.test(word)) {
            return word;
          }
          // Space out letters for text words
          return word.split('').join(' ');
        })
        .join('   '); // Triple space between words
    };
    
    const formattedStreetAddress = formatAddressForFlyer(streetAddress);
    const statusLabel = STATUS_OPTIONS.find(s => s.value === data.status)?.label || "Listed";

    // Fill white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // ============ HEADER SECTION (height: ~250px) ============
    const headerHeight = 250;
    
    // WHITE header background (per template)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, headerHeight);
    
    // Load and draw BLACK Spyglass logo (left) on white background - LARGER per template
    const logo = document.createElement('img');
    logo.crossOrigin = "anonymous";
    await new Promise<void>((resolve) => {
      logo.onload = () => resolve();
      logo.onerror = () => resolve();
      logo.src = spyglassLogoBlack;
    });
    
    const logoWidth = 250; // Larger logo per template (~250px wide)
    const logoHeight = (logo.height / logo.width) * logoWidth || 180;
    
    // Draw logo directly on white background (no dark panel needed)
    ctx.drawImage(logo, 60, 35, logoWidth, logoHeight);
    
    // No "Leading" section - header is just logo + price

    // Price badge (right) - TAN/BROWN RECTANGLE
    const badgeWidth = 400;
    const badgeHeight = 130;
    const badgeX = canvas.width - badgeWidth - 80;
    const badgeY = 55;
    
    // Simple rectangle, tan/brown color
    ctx.fillStyle = '#8b7355';
    ctx.fillRect(badgeX, badgeY, badgeWidth, badgeHeight);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = `500 24px ${FONT_LEAGUE}`;
    ctx.textAlign = "center";
    const badgeCenterX = badgeX + badgeWidth / 2;
    ctx.fillText(`${statusLabel.toUpperCase()} AT`, badgeCenterX, badgeY + 45);
    ctx.font = `700 54px ${FONT_LEAGUE}`;
    ctx.fillText(data.price || "$0", badgeCenterX, badgeY + 100);

    // ============ ADDRESS BAR (height: ~100px) ============
    const addressBarY = headerHeight;
    const addressBarHeight = 100;
    
    // Plain text address on white background (no dark bar)
    ctx.fillStyle = "#333333";
    ctx.font = `500 36px ${FONT_MONTSERRAT}`;
    ctx.textAlign = "left";
    ctx.fillText(streetAddress.toUpperCase(), 60, addressBarY + 55);

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
    // Reduced gap for less white space (was 80, now 50)
    const infoY = secondaryY + secondaryHeight + 50;
    
    // Three column layout
    const leftColX = 100;
    const centerColX = canvas.width / 2;
    const rightColX = canvas.width - 450;
    const rightColWidth = 380;

    // LEFT COLUMN - Property Stats with simple line icons (larger per template)
    ctx.textAlign = "left";
    ctx.fillStyle = DARK_TEXT;
    ctx.font = `600 52px ${FONT_MONTSERRAT}`;  // Larger font per refinement
    
    const statsStartY = infoY + 100;  // Move down to reduce white space
    const statSpacing = 110;  // More vertical spacing
    const iconSize = 55;      // Larger icons
    
    // Helper to draw line icons matching template style
    const drawBedIcon = (x: number, y: number) => {
      ctx.strokeStyle = DARK_TEXT;
      ctx.lineWidth = 3;
      ctx.beginPath();
      // Headboard (left side, tall rectangle)
      ctx.moveTo(x, y + iconSize * 0.8);
      ctx.lineTo(x, y - iconSize * 0.3);
      ctx.lineTo(x + iconSize * 0.25, y - iconSize * 0.3);
      ctx.lineTo(x + iconSize * 0.25, y + iconSize * 0.1);
      // Bed surface (horizontal line from headboard)
      ctx.moveTo(x, y + iconSize * 0.2);
      ctx.lineTo(x + iconSize, y + iconSize * 0.2);
      // Footboard (right side, shorter)
      ctx.lineTo(x + iconSize, y + iconSize * 0.5);
      ctx.moveTo(x + iconSize, y + iconSize * 0.2);
      ctx.lineTo(x + iconSize, y + iconSize * 0.8);
      // Bottom frame
      ctx.moveTo(x, y + iconSize * 0.8);
      ctx.lineTo(x + iconSize, y + iconSize * 0.8);
      ctx.stroke();
    };
    
    const drawBathIcon = (x: number, y: number) => {
      ctx.strokeStyle = DARK_TEXT;
      ctx.lineWidth = 3;
      ctx.beginPath();
      // Faucet (left side)
      ctx.moveTo(x + iconSize * 0.15, y - iconSize * 0.3);
      ctx.lineTo(x + iconSize * 0.15, y + iconSize * 0.1);
      ctx.lineTo(x + iconSize * 0.35, y + iconSize * 0.1);
      // Tub rim (horizontal line)
      ctx.moveTo(x, y + iconSize * 0.15);
      ctx.lineTo(x + iconSize, y + iconSize * 0.15);
      // Tub body (rounded bottom)
      ctx.moveTo(x + iconSize * 0.05, y + iconSize * 0.15);
      ctx.lineTo(x + iconSize * 0.05, y + iconSize * 0.55);
      ctx.quadraticCurveTo(x + iconSize * 0.05, y + iconSize * 0.7, x + iconSize * 0.2, y + iconSize * 0.7);
      ctx.lineTo(x + iconSize * 0.8, y + iconSize * 0.7);
      ctx.quadraticCurveTo(x + iconSize * 0.95, y + iconSize * 0.7, x + iconSize * 0.95, y + iconSize * 0.55);
      ctx.lineTo(x + iconSize * 0.95, y + iconSize * 0.15);
      // Claw feet
      ctx.moveTo(x + iconSize * 0.15, y + iconSize * 0.7);
      ctx.lineTo(x + iconSize * 0.1, y + iconSize * 0.9);
      ctx.moveTo(x + iconSize * 0.85, y + iconSize * 0.7);
      ctx.lineTo(x + iconSize * 0.9, y + iconSize * 0.9);
      ctx.stroke();
    };
    
    const drawSqftIcon = (x: number, y: number) => {
      ctx.strokeStyle = DARK_TEXT;
      ctx.lineWidth = 3;
      ctx.beginPath();
      // Rectangle representing floor area
      ctx.rect(x, y - iconSize * 0.2, iconSize, iconSize * 0.7);
      ctx.stroke();
      // Diagonal line with arrow (area measurement symbol)
      ctx.beginPath();
      ctx.moveTo(x + iconSize * 0.2, y + iconSize * 0.35);
      ctx.lineTo(x + iconSize * 0.8, y - iconSize * 0.05);
      // Arrow head
      ctx.lineTo(x + iconSize * 0.62, y - iconSize * 0.02);
      ctx.moveTo(x + iconSize * 0.8, y - iconSize * 0.05);
      ctx.lineTo(x + iconSize * 0.77, y + iconSize * 0.13);
      ctx.stroke();
    };
    
    // Draw icons
    drawBedIcon(leftColX, statsStartY);
    drawBathIcon(leftColX, statsStartY + statSpacing);
    drawSqftIcon(leftColX, statsStartY + statSpacing * 2);
    
    // Draw stat text (offset for larger icons)
    ctx.fillText(`${data.bedrooms || "—"} bedrooms`, leftColX + 80, statsStartY);
    ctx.fillText(`${data.bathrooms || "—"} bathrooms`, leftColX + 80, statsStartY + statSpacing);
    ctx.fillText(`${data.sqft ? parseInt(data.sqft).toLocaleString() : "—"} sq. ft`, leftColX + 80, statsStartY + statSpacing * 2);

    // CENTER COLUMN - Headline + Description (larger fonts per template)
    ctx.textAlign = "center";
    let descStartY = infoY + 70;
    
    if (data.listingHeadline) {
      ctx.font = `600 46px ${FONT_LEAGUE}`;  // Larger headline per refinement
      ctx.fillStyle = DARK_TEXT;
      ctx.fillText(data.listingHeadline.toUpperCase(), centerColX, descStartY);
      descStartY += 80;
    }
    
    if (data.description) {
      const truncatedDesc = truncateDescription(data.description, DESCRIPTION_LIMITS.print);
      ctx.font = `400 38px ${FONT_MONTSERRAT}`;  // Larger description per refinement
      ctx.fillStyle = "#444444";
      
      const maxWidth = 900;
      const words = truncatedDesc.split(" ");
      let line = "";
      let descY = descStartY;
      const lineHeight = 52;  // More line height (was 45)
      
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

    // RIGHT COLUMN - Agent Info (expand right column for bigger elements)
    const expandedRightColX = canvas.width - 550;
    const expandedRightColWidth = 480;
    ctx.textAlign = "center";
    const agentCenterX = expandedRightColX + expandedRightColWidth / 2;
    
    // Agent photo (circle) - 200px diameter per template
    const agentCircleR = 130;  // Larger (was 100)
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

    // Helper: Title Case for agent name
    const toTitleCase = (str: string): string => {
      return str.replace(/\w\S*/g, (txt) => 
        txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
      );
    };

    // Agent name (Title Case) - larger per refinement
    ctx.fillStyle = DARK_TEXT;
    ctx.font = `700 48px ${FONT_MONTSERRAT}`;
    const formattedAgentName = data.agentName ? toTitleCase(data.agentName) : "Agent Name";
    ctx.fillText(formattedAgentName, agentCenterX, agentPhotoY + agentCircleR * 2 + 60);
    
    // Agent title
    ctx.fillStyle = "#666666";
    ctx.font = `400 26px ${FONT_MONTSERRAT}`;
    ctx.fillText(data.agentTitle || "REALTOR®, Spyglass Realty", agentCenterX, agentPhotoY + agentCircleR * 2 + 95);
    
    // Agent phone
    ctx.font = `400 30px ${FONT_MONTSERRAT}`;
    ctx.fillText(data.agentPhone || "(XXX) XXX-XXXX", agentCenterX, agentPhotoY + agentCircleR * 2 + 135);

    // Small Spyglass logo under agent info - use BLACK logo on white background
    // (Since bottom section has white background, use black logo directly)
    const agentLogo = document.createElement('img');
    agentLogo.crossOrigin = "anonymous";
    await new Promise<void>((resolve) => {
      agentLogo.onload = () => resolve();
      agentLogo.onerror = () => resolve();
      agentLogo.src = spyglassLogoBlack;
    });
    
    const smallLogoWidth = 120; // Larger agent logo per refinement (~120px wide)
    const smallLogoHeight = (agentLogo.height / agentLogo.width) * smallLogoWidth || 70;
    const smallLogoX = agentCenterX - smallLogoWidth / 2;
    const smallLogoY = agentPhotoY + agentCircleR * 2 + 190;
    
    ctx.drawImage(agentLogo, smallLogoX, smallLogoY, smallLogoWidth, smallLogoHeight);
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

    setIsGenerating(true);

    try {
      // Print flyer uses unified /api/flyer/render endpoint (PNG output)
      const response = await fetch('/api/flyer/render', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: data.status,
          price: data.price,
          address: getFullAddress(),
          photos: photosToUse,
          beds: mlsData?.bedrooms || 0,
          baths: mlsData?.bathrooms || 0,
          sqft: mlsData?.sqft || 0,
          headline: data.listingHeadline,
          description: data.description,
          agentName: data.agentName,
          agentTitle: data.agentTitle,
          agentPhone: data.agentPhone,
          agentPhoto: effectiveAgentPhoto,
          openHouseDay: data.openHouseDay && data.openHouseDay !== 'none' ? data.openHouseDay.toUpperCase() : '',
          openHouseDate: data.openHouseDate || '',
          mlsNumber: transaction.mlsNumber || '',
          outputType: 'pngPreview' // PNG for print-ready download
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate flyer');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const addressSlug = transaction.propertyAddress.split(",")[0].replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
      const fileName = `${addressSlug}_flyer.png`;
      
      // Download the file
      const link = document.createElement("a");
      link.download = fileName;
      link.href = url;
      link.click();
      
      // Save to marketing assets
      try {
        // Convert blob to base64 for storage
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        const imageData = await base64Promise;
        
        const statusLabel = STATUS_OPTIONS.find(s => s.value === data.status)?.label || data.status;
        const config: FlyerAssetConfig = {
          status: data.status,
          description: data.description,
          headline: data.listingHeadline,
          photoUrls: photosToUse,
          agentName: data.agentName,
          agentTitle: data.agentTitle,
          agentPhone: data.agentPhone,
          agentPhotoUrl: effectiveAgentPhoto || undefined,
          format: 'print',
          price: data.price,
          bedrooms: data.bedrooms,
          bathrooms: data.bathrooms,
          sqft: data.sqft,
        };
        
        if (isEditMode && assetId) {
          await apiRequest("PATCH", `/api/transactions/${transaction.id}/marketing-assets/${assetId}`, {
            imageData,
            fileName,
            metadata: {
              format: 'print',
              status: statusLabel,
              dimensions: '8.5x11',
              headline: data.listingHeadline,
              config,
            }
          });
        } else {
          await apiRequest("POST", `/api/transactions/${transaction.id}/marketing-assets`, {
            type: 'print_flyer',
            imageData,
            fileName,
            metadata: {
              format: 'print',
              status: statusLabel,
              dimensions: '8.5x11',
              headline: data.listingHeadline,
              config,
            }
          });
        }
        onAssetSaved?.();
      } catch (saveError) {
        console.error("Failed to save marketing asset:", saveError);
        // Don't show error - the download still worked
      }
      
      window.URL.revokeObjectURL(url);

      toast({
        title: "Flyer downloaded",
        description: "Your print-ready PNG flyer has been saved.",
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
          <DialogTitle className="text-lg sm:text-xl">{isEditMode ? 'Edit Property Flyer' : 'Create Property Flyer'}</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {isEditMode ? 'Update your flyer with new details or photos.' : 'Select photos and customize details for your print flyer.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(generateFlyer)} className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 flex flex-col lg:flex-row gap-4 sm:gap-6 overflow-y-auto pr-1 sm:pr-2 min-h-0">
              <div className="flex-1 space-y-3 sm:space-y-4 min-w-0">
                {mlsPhotos.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-sm">
                        Select up to 3 photos
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
                              <ul className="text-xs space-y-0.5">
                                <li>• Photo 1: Best Exterior/Front</li>
                                <li>• Photo 2: Best Kitchen</li>
                                <li>• Photo 3: Best Living Room</li>
                              </ul>
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

                {/* Open House Fields - Only show when status is "open_house" */}
                {watchedValues.status === 'open_house' && (
                  <div className="grid grid-cols-2 gap-2">
                    <FormField
                      control={form.control}
                      name="openHouseDay"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">Open House Day</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-8" data-testid="select-open-house-day">
                                <SelectValue placeholder="Select day" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {OPEN_HOUSE_DAY_OPTIONS.filter(opt => opt.value !== '').map((option) => (
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
                    <FormField
                      control={form.control}
                      name="openHouseDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">Open House Details</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., May 17th, 11AM - 3PM"
                              className="h-8"
                              data-testid="input-open-house-date"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

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
                            <span className="text-muted-foreground flex items-center gap-1">
                              {hasSummarized ? (
                                <>
                                  {/[.!?]$/.test(field.value?.trim() || "") ? (
                                    <Check className="h-3 w-3 text-green-600" />
                                  ) : null}
                                  <span>Click AI Summarize for a different variation</span>
                                </>
                              ) : (
                                "Click 'AI Summarize' to create a concise summary"
                              )}
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

                <div className="border-t pt-3 mt-2">
                  <FormLabel className="text-sm font-medium text-muted-foreground">Agent Information</FormLabel>
                </div>

                    <FormField
                      control={form.control}
                      name="listingHeadline"
                      render={({ field }) => {
                        const headlineLength = field.value?.length || 0;
                        const headlineMax = 39;
                        const headlineNearLimit = headlineLength >= 30;
                        const headlineAtLimit = headlineLength >= headlineMax;
                        
                        return (
                          <FormItem>
                            <div className="flex justify-between items-center">
                              <FormLabel className="text-sm">Listing Headline (optional)</FormLabel>
                              <div className="flex items-center gap-1">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleGenerateHeadline}
                                        disabled={isGeneratingHeadline || !originalDescription}
                                        className="h-7 text-xs"
                                        data-testid="button-ai-generate-headline"
                                      >
                                        {isGeneratingHeadline ? (
                                          <>
                                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                            Generating...
                                          </>
                                        ) : (
                                          <>
                                            <Sparkles className="h-3 w-3 mr-1" />
                                            AI Generate
                                          </>
                                        )}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs">
                                      <p className="font-medium mb-1">Generate AI Headline</p>
                                      <p className="text-xs text-muted-foreground mb-2">
                                        Creates a catchy, professional headline based on the property description.
                                      </p>
                                      <p className="text-xs italic text-muted-foreground">
                                        Examples: "A PRIME OPPORTUNITY IN NW AUSTIN", "STUNNING HILL COUNTRY RETREAT", "YOUR DREAM HOME AWAITS"
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                
                                {/* Revert dropdown - shown after AI headline has been generated */}
                                {hasGeneratedHeadline && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs px-2"
                                        data-testid="button-headline-revert-dropdown"
                                      >
                                        <Undo2 className="h-3 w-3 mr-1" />
                                        Revert
                                        <ChevronDown className="h-3 w-3 ml-1" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem 
                                        onClick={handleRevertToPreviousHeadline}
                                        disabled={previousHeadline === null}
                                        data-testid="button-headline-revert-previous"
                                      >
                                        Revert to Previous
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        onClick={handleClearHeadline}
                                        data-testid="button-headline-clear"
                                      >
                                        Clear Headline
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </div>
                            </div>
                            <FormControl>
                              <Input
                                placeholder="e.g., A PRIME OPPORTUNITY IN NW AUSTIN"
                                className="h-8 uppercase"
                                maxLength={39}
                                data-testid="input-listing-headline"
                                {...field}
                                onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                              />
                            </FormControl>
                            <FormDescription className="text-xs flex justify-between">
                              <span>Optional headline - appears above description</span>
                              <span className={
                                headlineAtLimit 
                                  ? "text-red-600 font-medium" 
                                  : headlineNearLimit 
                                    ? "text-amber-600 font-medium" 
                                    : "text-green-600"
                              }>
                                {headlineLength}/{headlineMax}
                              </span>
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
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
              </div>

              <div className="w-full lg:w-48 flex-shrink-0 order-first lg:order-last">
                <div className="sticky top-0">
                  <p className="text-xs font-medium text-muted-foreground mb-2 text-center">
                    Preview
                  </p>
                  {renderedPreviewUrl ? (
                    /* Print flyer: Show ONLY Puppeteer-rendered PNG (same as download) */
                    <div 
                      className="flex justify-center lg:block cursor-pointer relative group"
                      onClick={() => setPreviewEnlarged(true)}
                      data-testid="button-enlarge-preview"
                    >
                      <div className="relative w-[140px] lg:w-full">
                        <img 
                          src={renderedPreviewUrl} 
                          alt="Rendered flyer preview"
                          className="w-full h-auto rounded-lg border shadow-sm"
                          style={{ aspectRatio: '8.5/11' }}
                        />
                      </div>
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                        <div className="bg-white/90 rounded-full p-2">
                          <Maximize2 className="h-4 w-4 text-gray-700" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Print flyer: No preview yet - show placeholder prompting render */
                    <div className="relative w-[140px] lg:w-full aspect-[8.5/11] bg-muted rounded-lg border border-dashed border-border flex flex-col items-center justify-center p-2 text-center">
                      <Image className="h-6 w-6 text-muted-foreground mb-2" />
                      <p className="text-[9px] text-muted-foreground leading-tight">
                        Click "Render Preview" to see exact output
                      </p>
                    </div>
                  )}
                  <Button
                    type="button"
                    variant={renderedPreviewUrl ? "outline" : "default"}
                    size="sm"
                    className="w-full mt-2 h-7 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      renderActualPreview();
                    }}
                    disabled={isRenderingPreview || !hasPhotosSelected}
                    data-testid="button-render-preview"
                  >
                    {isRenderingPreview ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Rendering...
                      </>
                    ) : (
                      <>
                        <Image className="h-3 w-3 mr-1" />
                        {renderedPreviewUrl ? "Re-render" : "Render Preview"}
                      </>
                    )}
                  </Button>
                  {renderedPreviewUrl && (
                    <p className="text-[10px] text-muted-foreground text-center mt-1">
                      Click preview to enlarge
                    </p>
                  )}
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
                Download Flyer
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
              <DialogTitle className="text-base">Preview - Print Flyer</DialogTitle>
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

            {/* Scrollable Preview Area - No padding/margin/clip that changes layout */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="flex justify-center py-2 px-1">
                <div 
                  className="transition-transform duration-200 ease-out origin-top"
                  style={{ transform: `scale(${zoomLevel / 100})` }}
                >
                  {/* Preview container - simple image display only */}
                  <div className="w-[340px] sm:w-[400px]">
                    {renderedPreviewUrl ? (
                      /* Print flyer: Show ONLY Puppeteer-rendered PNG (pixel-identical to download) */
                      <img 
                        src={renderedPreviewUrl} 
                        alt="Rendered flyer preview"
                        className="w-full h-auto rounded-lg border shadow-sm"
                        style={{ aspectRatio: '8.5/11' }}
                      />
                    ) : (
                      /* Print flyer: No preview yet - prompt user to render */
                      <div className="w-full aspect-[8.5/11] bg-muted rounded-lg border border-dashed border-border flex flex-col items-center justify-center p-4 text-center">
                        <Image className="h-12 w-12 text-muted-foreground mb-3" />
                        <p className="text-sm text-muted-foreground mb-2">
                          No preview rendered yet
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Close this modal and click "Render Preview" to see exact output
                        </p>
                      </div>
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
