import { useState, useCallback, useEffect, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, X, Upload, Check, Download, Image, FileText, Bed, Bath, Square, ZoomIn, ChevronDown, ChevronUp, Maximize2 } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import type { Transaction, MLSData } from "@shared/schema";

import spyglassLogoWhite from "@assets/White-Orange_(1)_1767129299733.png";

type FlyerFormat = "social" | "print";

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
});

type FormValues = z.infer<typeof formSchema>;

function truncateDescription(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text || "";
  const truncated = text.substring(0, maxLength);
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
  const truncatedDesc = truncateDescription(description || "", 350);

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
}: PreviewProps) {
  const [imagesLoaded, setImagesLoaded] = useState<Record<number, boolean>>({});
  
  const statusLabel = STATUS_OPTIONS.find(s => s.value === status)?.label || "Just Listed";
  const truncatedDesc = truncateDescription(description || "", 250);
  
  const spacedAddress = address.split(",")[0].split("").join(" ").toUpperCase();
  const cityStateZip = address.split(",").slice(1).join(",").trim().toUpperCase();

  return (
    <div className="relative w-full aspect-[8.5/11] bg-[#1a1a1a] rounded-lg overflow-hidden shadow-lg border border-border">
      {/* Header Section */}
      <div className="flex items-center justify-between px-2 py-1.5 bg-[#1a1a1a]">
        <img
          src={spyglassLogoWhite}
          alt="Spyglass Realty"
          className="h-3.5 w-auto"
        />
        <p className="text-[5px] text-gray-400 tracking-wider">LEADING REAL ESTATE COMPANIES</p>
        <div className="bg-[#b39960] text-white px-2 py-1 rounded-sm">
          <p className="text-[4px] tracking-[0.15em] text-center">{statusLabel.toUpperCase()} AT</p>
          <p className="text-[8px] font-bold text-center">{price || "$0"}</p>
        </div>
      </div>

      {/* Address Bar */}
      <div className="bg-[#2a2a2a] py-1 px-2 text-center">
        <p className="text-[5px] text-white tracking-[0.25em] font-medium">
          {spacedAddress}
        </p>
        <p className="text-[4px] text-gray-400 tracking-[0.2em]">
          {cityStateZip}
        </p>
      </div>

      {/* Photos Section */}
      <div className="bg-white px-1 pt-1">
        {/* Main Photo */}
        <div className="relative aspect-[16/9] bg-muted overflow-hidden">
          {photoUrls[0] ? (
            <img
              src={photoUrls[0]}
              alt="Main"
              className="w-full h-full object-cover"
              onLoad={() => setImagesLoaded(prev => ({ ...prev, 0: true }))}
            />
          ) : (
            <div className="flex items-center justify-center h-full bg-gray-200">
              <p className="text-[8px] text-muted-foreground">Main Photo</p>
            </div>
          )}
        </div>

        {/* Secondary Photos */}
        <div className="grid grid-cols-2 gap-0.5 mt-0.5">
          {[1, 2].map(idx => (
            <div key={idx} className="relative aspect-[16/10] bg-muted overflow-hidden">
              {photoUrls[idx] ? (
                <img
                  src={photoUrls[idx]}
                  alt={`Photo ${idx + 1}`}
                  className="w-full h-full object-cover"
                  onLoad={() => setImagesLoaded(prev => ({ ...prev, [idx]: true }))}
                />
              ) : (
                <div className="flex items-center justify-center h-full bg-gray-200">
                  <p className="text-[6px] text-muted-foreground">Photo {idx + 1}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Info Section - 3 Columns */}
      <div className="bg-white px-1 py-1.5 grid grid-cols-3 gap-1">
        {/* Left Column - Property Stats */}
        <div className="space-y-0.5 pl-1">
          <div className="flex items-center gap-1 text-gray-700">
            <Bed className="h-2 w-2" />
            <span className="text-[6px]">{bedrooms || "—"} bedrooms</span>
          </div>
          <div className="flex items-center gap-1 text-gray-700">
            <Bath className="h-2 w-2" />
            <span className="text-[6px]">{bathrooms || "—"} bathrooms</span>
          </div>
          <div className="flex items-center gap-1 text-gray-700">
            <Square className="h-2 w-2" />
            <span className="text-[6px]">{sqft ? parseInt(sqft).toLocaleString() : "—"} sq. ft</span>
          </div>
        </div>

        {/* Center Column - Description */}
        <div className="text-center px-0.5">
          {truncatedDesc && (
            <p className="text-[5px] text-gray-600 leading-relaxed line-clamp-4">
              {truncatedDesc}
            </p>
          )}
        </div>

        {/* Right Column - Agent Info */}
        <div className="text-center pr-1 space-y-0.5">
          <div className="w-5 h-5 mx-auto bg-gray-300 rounded-full flex items-center justify-center">
            <span className="text-[4px] text-gray-500">Photo</span>
          </div>
          <p className="text-[5px] font-bold text-gray-800">Agent Name</p>
          <p className="text-[4px] text-gray-500">REALTOR®</p>
          <p className="text-[4px] text-gray-600">(XXX) XXX-XXXX</p>
        </div>
      </div>

      {/* Bottom decorative bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#b39960]" />
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

  const mlsData = transaction.mlsData as MLSData | null;
  const maxPhotos = format === "social" ? 1 : 3;
  const maxDescriptionLength = format === "social" ? 350 : 250;

  const resetPhotoSelection = useCallback((newFormat: FlyerFormat) => {
    const limit = newFormat === "social" ? 1 : 3;
    if (mlsPhotos.length > 0) {
      setSelectedPhotos(mlsPhotos.slice(0, limit));
    } else {
      setSelectedPhotos([]);
    }
    setUploadedPhotos([]);
  }, [mlsPhotos]);

  useEffect(() => {
    if (open) {
      resetPhotoSelection(format);
      if (mlsPhotos.length === 0) {
        setShowUploadSection(true);
      }
    }
  }, [open, mlsPhotos.length]);

  useEffect(() => {
    if (!open) {
      setSelectedPhotos([]);
      setUploadedPhotos([]);
      setShowUploadSection(false);
      setFormat("social");
    }
  }, [open]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      price: transaction.listPrice ? `$${transaction.listPrice.toLocaleString()}` : "",
      status: "just_listed",
      bedrooms: mlsData?.bedrooms?.toString() || transaction.bedrooms?.toString() || "",
      bathrooms: mlsData?.bathrooms?.toString() || transaction.bathrooms?.toString() || "",
      sqft: mlsData?.sqft?.toString() || transaction.sqft?.toString() || "",
      description: mlsData?.description || "",
    },
  });

  const watchedValues = useWatch({ control: form.control });
  const currentDescriptionLength = watchedValues.description?.length || 0;

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
      const truncatedDesc = truncateDescription(data.description, 350);
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

    const address = transaction.propertyAddress;
    const addressParts = address.split(",");
    const spacedAddress = addressParts[0].split("").join(" ").toUpperCase();
    const cityStateZip = addressParts.slice(1).join(",").trim().toUpperCase();
    const statusLabel = STATUS_OPTIONS.find(s => s.value === data.status)?.label || "Just Listed";

    // Header Section - Dark background
    const headerHeight = 200;
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, canvas.width, headerHeight);

    // Load and draw logo
    const logo = document.createElement('img');
    logo.crossOrigin = "anonymous";
    await new Promise<void>((resolve) => {
      logo.onload = () => resolve();
      logo.onerror = () => resolve();
      logo.src = spyglassLogoWhite;
    });
    
    const logoHeight = 100;
    const logoWidth = (logo.width / logo.height) * logoHeight || 300;
    ctx.drawImage(logo, 80, 50, logoWidth, logoHeight);

    // Center text - "Leading Real Estate Companies"
    ctx.fillStyle = "#888888";
    ctx.font = "28px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("LEADING REAL ESTATE COMPANIES", canvas.width / 2, 110);

    // Price badge - gold background
    const badgeWidth = 450;
    const badgeHeight = 120;
    const badgeX = canvas.width - badgeWidth - 80;
    const badgeY = 40;
    ctx.fillStyle = "#b39960";
    ctx.fillRect(badgeX, badgeY, badgeWidth, badgeHeight);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "24px Inter, sans-serif";
    ctx.letterSpacing = "4px";
    ctx.textAlign = "center";
    ctx.fillText(`${statusLabel.toUpperCase()} AT`, badgeX + badgeWidth / 2, badgeY + 45);
    ctx.font = "bold 56px Inter, sans-serif";
    ctx.fillText(data.price || "$0", badgeX + badgeWidth / 2, badgeY + 100);

    // Address Bar - slightly lighter dark background
    const addressBarY = headerHeight;
    const addressBarHeight = 100;
    ctx.fillStyle = "#2a2a2a";
    ctx.fillRect(0, addressBarY, canvas.width, addressBarHeight);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "36px Inter, sans-serif";
    ctx.letterSpacing = "10px";
    ctx.textAlign = "center";
    ctx.fillText(spacedAddress, canvas.width / 2, addressBarY + 45);
    
    ctx.fillStyle = "#888888";
    ctx.font = "24px Inter, sans-serif";
    ctx.letterSpacing = "6px";
    ctx.fillText(cityStateZip, canvas.width / 2, addressBarY + 80);

    // Photos Section - white background
    const photosY = addressBarY + addressBarHeight;
    const photosPadding = 40;
    
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, photosY, canvas.width, canvas.height - photosY);

    // Main Photo
    const mainPhotoY = photosY + photosPadding;
    const mainPhotoHeight = 1400;
    const mainPhotoWidth = canvas.width - photosPadding * 2;
    
    if (photosToUse[0]) {
      const mainPhoto = document.createElement('img');
      mainPhoto.crossOrigin = "anonymous";
      await new Promise<void>((resolve) => {
        mainPhoto.onload = () => resolve();
        mainPhoto.onerror = () => resolve();
        mainPhoto.src = photosToUse[0];
      });
      if (mainPhoto.complete && mainPhoto.naturalWidth > 0) {
        ctx.drawImage(mainPhoto, photosPadding, mainPhotoY, mainPhotoWidth, mainPhotoHeight);
      }
    } else {
      ctx.fillStyle = "#e0e0e0";
      ctx.fillRect(photosPadding, mainPhotoY, mainPhotoWidth, mainPhotoHeight);
      ctx.fillStyle = "#999999";
      ctx.font = "48px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Main Photo", canvas.width / 2, mainPhotoY + mainPhotoHeight / 2);
    }

    // Secondary Photos
    const secondaryY = mainPhotoY + mainPhotoHeight + 20;
    const secondaryHeight = 550;
    const secondaryWidth = (mainPhotoWidth - 20) / 2;

    for (let i = 1; i <= 2; i++) {
      const x = photosPadding + (i - 1) * (secondaryWidth + 20);
      if (photosToUse[i]) {
        const photo = document.createElement('img');
        photo.crossOrigin = "anonymous";
        await new Promise<void>((resolve) => {
          photo.onload = () => resolve();
          photo.onerror = () => resolve();
          photo.src = photosToUse[i];
        });
        if (photo.complete && photo.naturalWidth > 0) {
          ctx.drawImage(photo, x, secondaryY, secondaryWidth, secondaryHeight);
        }
      } else {
        ctx.fillStyle = "#e0e0e0";
        ctx.fillRect(x, secondaryY, secondaryWidth, secondaryHeight);
        ctx.fillStyle = "#999999";
        ctx.font = "36px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`Photo ${i + 1}`, x + secondaryWidth / 2, secondaryY + secondaryHeight / 2);
      }
    }

    // Info Section - 3 columns
    const infoY = secondaryY + secondaryHeight + 60;
    const columnWidth = (canvas.width - photosPadding * 2) / 3;

    // Left Column - Property Stats
    const leftColumnX = photosPadding + 40;
    ctx.textAlign = "left";
    ctx.fillStyle = "#1a1a1a";
    
    ctx.font = "36px Inter, sans-serif";
    ctx.fillText(`${data.bedrooms || "—"} bedrooms`, leftColumnX, infoY + 50);
    ctx.fillText(`${data.bathrooms || "—"} bathrooms`, leftColumnX, infoY + 100);
    ctx.fillText(`${data.sqft ? parseInt(data.sqft).toLocaleString() : "—"} sq. ft`, leftColumnX, infoY + 150);

    // Center Column - Description
    if (data.description) {
      const truncatedDesc = truncateDescription(data.description, 250);
      ctx.font = "28px Inter, sans-serif";
      ctx.fillStyle = "#444444";
      ctx.textAlign = "center";
      
      const maxWidth = columnWidth - 40;
      const words = truncatedDesc.split(" ");
      let line = "";
      let descY = infoY + 40;
      const lineHeight = 38;
      const descX = canvas.width / 2;
      
      words.forEach((word) => {
        const testLine = line + word + " ";
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && line !== "") {
          ctx.fillText(line.trim(), descX, descY);
          line = word + " ";
          descY += lineHeight;
        } else {
          line = testLine;
        }
      });
      if (line.trim()) {
        ctx.fillText(line.trim(), descX, descY);
      }
    }

    // Right Column - Agent Info (placeholder)
    const rightColumnX = photosPadding + columnWidth * 2 + columnWidth / 2;
    ctx.textAlign = "center";
    
    // Agent photo placeholder (circle)
    const agentCircleR = 60;
    ctx.beginPath();
    ctx.arc(rightColumnX, infoY + 50, agentCircleR, 0, Math.PI * 2);
    ctx.fillStyle = "#cccccc";
    ctx.fill();
    ctx.fillStyle = "#666666";
    ctx.font = "20px Inter, sans-serif";
    ctx.fillText("Photo", rightColumnX, infoY + 55);

    ctx.fillStyle = "#1a1a1a";
    ctx.font = "bold 32px Inter, sans-serif";
    ctx.fillText("Agent Name", rightColumnX, infoY + 140);
    
    ctx.fillStyle = "#666666";
    ctx.font = "24px Inter, sans-serif";
    ctx.fillText("REALTOR®", rightColumnX, infoY + 175);
    ctx.fillText("(XXX) XXX-XXXX", rightColumnX, infoY + 210);

    // Bottom decorative bar - gold
    ctx.fillStyle = "#b39960";
    ctx.fillRect(0, canvas.height - 30, canvas.width, 30);
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
          <form onSubmit={form.handleSubmit(generateFlyer)} className="flex-1 overflow-hidden">
            <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 h-full overflow-y-auto pr-1 sm:pr-2">
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
                      <span className="text-xs text-muted-foreground">
                        {selectedPhotos.length}/{maxPhotos} selected
                      </span>
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 sm:gap-1.5 max-h-32 sm:max-h-28 overflow-y-auto p-1.5 sm:p-1 border rounded-md bg-muted/30">
                      {mlsPhotos.map((photo, index) => {
                        const isSelected = selectedPhotos.includes(photo);
                        const selectionIndex = selectedPhotos.indexOf(photo);
                        const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(photo)}`;
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
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter a brief property description..."
                          className="resize-none h-20"
                          data-testid="input-flyer-description"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          Will be truncated to {maxDescriptionLength} chars on flyer
                        </span>
                        <span className={currentDescriptionLength > maxDescriptionLength ? "text-amber-600 font-medium" : ""}>
                          {currentDescriptionLength}/{maxDescriptionLength}
                        </span>
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
          <DialogContent className="w-[95vw] max-w-xl max-h-[90vh] p-4 flex flex-col">
            <DialogHeader className="pb-2">
              <DialogTitle>Preview - {format === "social" ? "Social Media" : "Print Flyer"}</DialogTitle>
              <DialogDescription>
                Full-size preview of your flyer
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-auto flex justify-center py-4">
              <div className={format === "social" ? "w-64" : "w-80"}>
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
                  />
                )}
              </div>
            </div>
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
