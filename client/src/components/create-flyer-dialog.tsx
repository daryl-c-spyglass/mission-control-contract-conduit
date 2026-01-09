import { useState, useCallback, useEffect, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, X, Upload, Check, Download, Image, FileText, Bed, Bath, Square } from "lucide-react";
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
  const truncatedDesc = truncateDescription(description || "", 150);

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
  const truncatedDesc = truncateDescription(description || "", 115);

  return (
    <div className="relative w-full aspect-[8.5/11] bg-white rounded-lg overflow-hidden shadow-lg border border-border">
      <div className="flex items-center justify-between p-2 border-b border-gray-100">
        <img
          src={spyglassLogoWhite}
          alt="Logo"
          className="h-4 w-auto"
          style={{ filter: 'invert(1) brightness(0.3)' }}
        />
        <div className="bg-amber-500 text-white text-[7px] font-bold px-1.5 py-0.5 rounded">
          {statusLabel.toUpperCase()} AT {price || "$0"}
        </div>
      </div>

      <div className="px-2 py-1">
        <p className="text-[8px] font-bold text-gray-800 tracking-widest uppercase text-center">
          {address.split(",")[0]}
        </p>
        <p className="text-[6px] text-gray-500 text-center">
          {address.split(",").slice(1).join(",").trim()}
        </p>
      </div>

      <div className="px-2">
        <div className="relative aspect-[16/10] bg-muted rounded overflow-hidden">
          {photoUrls[0] ? (
            <img
              src={photoUrls[0]}
              alt="Main"
              className="w-full h-full object-cover"
              onLoad={() => setImagesLoaded(prev => ({ ...prev, 0: true }))}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-[8px] text-muted-foreground">Main photo</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-1 mt-1">
          {[1, 2].map(idx => (
            <div key={idx} className="relative aspect-[16/10] bg-muted rounded overflow-hidden">
              {photoUrls[idx] ? (
                <img
                  src={photoUrls[idx]}
                  alt={`Photo ${idx + 1}`}
                  className="w-full h-full object-cover"
                  onLoad={() => setImagesLoaded(prev => ({ ...prev, [idx]: true }))}
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-[6px] text-muted-foreground">Photo {idx + 1}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="px-2 py-1.5 mt-1 border-t border-gray-100">
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center">
            <div className="flex items-center justify-center gap-0.5 text-gray-700">
              <Bed className="h-2.5 w-2.5" />
              <span className="text-[8px] font-bold">{bedrooms || "—"}</span>
            </div>
            <p className="text-[6px] text-gray-500">Beds</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-0.5 text-gray-700">
              <Bath className="h-2.5 w-2.5" />
              <span className="text-[8px] font-bold">{bathrooms || "—"}</span>
            </div>
            <p className="text-[6px] text-gray-500">Baths</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-0.5 text-gray-700">
              <Square className="h-2.5 w-2.5" />
              <span className="text-[8px] font-bold">{sqft ? parseInt(sqft).toLocaleString() : "—"}</span>
            </div>
            <p className="text-[6px] text-gray-500">Sq Ft</p>
          </div>
        </div>
      </div>

      {truncatedDesc && (
        <div className="px-2 pb-1">
          <p className="text-[6px] text-gray-600 text-center leading-relaxed line-clamp-3">
            {truncatedDesc}
          </p>
        </div>
      )}

      <div className="absolute bottom-1 left-0 right-0 text-center">
        <p className="text-[6px] text-gray-400 italic">Agent info coming soon</p>
      </div>
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

  const mlsData = transaction.mlsData as MLSData | null;
  const maxPhotos = format === "social" ? 1 : 3;
  const maxDescriptionLength = format === "social" ? 200 : 115;

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
      description: truncateDescription(mlsData?.description || "", 200),
    },
  });

  const watchedValues = useWatch({ control: form.control });

  const handleFormatChange = (newFormat: FlyerFormat) => {
    setFormat(newFormat);
    resetPhotoSelection(newFormat);
    const newMaxLength = newFormat === "social" ? 200 : 115;
    const currentDescription = form.getValues("description") || "";
    if (currentDescription.length > newMaxLength) {
      form.setValue("description", truncateDescription(currentDescription, newMaxLength));
    }
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
      toast({
        title: "Maximum photos reached",
        description: `You can only use ${maxPhotos === 1 ? "1 photo" : `up to ${maxPhotos} photos`}. Deselect photos to upload more.`,
      });
      return;
    }
    const filesToProcess = Array.from(files).slice(0, remainingSlots);
    
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
      const truncatedDesc = truncateDescription(data.description, 200);
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

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const logo = document.createElement('img');
    logo.crossOrigin = "anonymous";
    await new Promise<void>((resolve) => {
      logo.onload = () => resolve();
      logo.onerror = () => resolve();
      logo.src = spyglassLogoWhite;
    });
    
    const logoHeight = 120;
    const logoWidth = (logo.width / logo.height) * logoHeight || 300;
    ctx.save();
    ctx.filter = 'invert(1) brightness(0.3)';
    ctx.drawImage(logo, 100, 80, logoWidth, logoHeight);
    ctx.restore();

    const statusLabel = STATUS_OPTIONS.find(s => s.value === data.status)?.label || "Just Listed";
    ctx.fillStyle = "#d97706";
    ctx.fillRect(canvas.width - 700, 80, 600, 100);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 48px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${statusLabel.toUpperCase()} AT ${data.price}`, canvas.width - 400, 145);
    ctx.textAlign = "left";

    const address = transaction.propertyAddress;
    const addressParts = address.split(",");
    ctx.fillStyle = "#1a1a1a";
    ctx.font = "bold 72px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.letterSpacing = "8px";
    ctx.fillText(addressParts[0].toUpperCase(), canvas.width / 2, 320);
    ctx.font = "36px Inter, sans-serif";
    ctx.fillStyle = "#666666";
    ctx.fillText(addressParts.slice(1).join(",").trim(), canvas.width / 2, 380);
    ctx.textAlign = "left";

    const mainPhoto = document.createElement('img');
    mainPhoto.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      mainPhoto.onload = () => resolve();
      mainPhoto.onerror = () => reject(new Error("Failed to load main photo"));
      mainPhoto.src = photosToUse[0];
    });

    const mainPhotoY = 450;
    const mainPhotoHeight = 1500;
    ctx.drawImage(mainPhoto, 100, mainPhotoY, canvas.width - 200, mainPhotoHeight);

    const secondaryY = mainPhotoY + mainPhotoHeight + 40;
    const secondaryHeight = 600;
    const secondaryWidth = (canvas.width - 240) / 2;

    for (let i = 1; i <= 2; i++) {
      const x = 100 + (i - 1) * (secondaryWidth + 40);
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
        ctx.fillStyle = "#f0f0f0";
        ctx.fillRect(x, secondaryY, secondaryWidth, secondaryHeight);
        ctx.fillStyle = "#999999";
        ctx.font = "32px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`Photo ${i + 1}`, x + secondaryWidth / 2, secondaryY + secondaryHeight / 2);
        ctx.textAlign = "left";
      }
    }

    const bottomY = secondaryY + secondaryHeight + 80;
    
    const specWidth = 600;
    const specX = 100;
    
    ctx.fillStyle = "#1a1a1a";
    ctx.font = "bold 72px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(data.bedrooms || "—", specX + specWidth / 6, bottomY + 60);
    ctx.fillText(data.bathrooms || "—", specX + specWidth / 2, bottomY + 60);
    ctx.fillText(data.sqft ? parseInt(data.sqft).toLocaleString() : "—", specX + (5 * specWidth) / 6, bottomY + 60);
    
    ctx.font = "28px Inter, sans-serif";
    ctx.fillStyle = "#666666";
    ctx.fillText("BEDS", specX + specWidth / 6, bottomY + 100);
    ctx.fillText("BATHS", specX + specWidth / 2, bottomY + 100);
    ctx.fillText("SQ FT", specX + (5 * specWidth) / 6, bottomY + 100);
    ctx.textAlign = "left";

    if (data.description) {
      const truncatedDesc = truncateDescription(data.description, 115);
      ctx.font = "32px Inter, sans-serif";
      ctx.fillStyle = "#444444";
      ctx.textAlign = "center";
      
      const maxWidth = 1000;
      const words = truncatedDesc.split(" ");
      let line = "";
      let descY = bottomY + 40;
      const lineHeight = 45;
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
      ctx.textAlign = "left";
    }

    ctx.font = "italic 28px Inter, sans-serif";
    ctx.fillStyle = "#999999";
    ctx.textAlign = "right";
    ctx.fillText("Agent info coming soon", canvas.width - 100, bottomY + 80);
    ctx.textAlign = "left";

    ctx.save();
    ctx.filter = 'invert(1) brightness(0.3)';
    ctx.drawImage(logo, canvas.width / 2 - logoWidth / 2, canvas.height - 180, logoWidth, logoHeight);
    ctx.restore();
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
                        return (
                          <button
                            key={index}
                            type="button"
                            onClick={() => togglePhotoSelection(photo)}
                            className={`relative aspect-square rounded overflow-hidden group transition-all ${
                              isSelected 
                                ? "ring-2 ring-primary ring-offset-1" 
                                : "hover:ring-1 hover:ring-muted-foreground/50"
                            }`}
                            data-testid={`button-mls-photo-${index}`}
                          >
                            <img
                              src={`/api/proxy-image?url=${encodeURIComponent(photo)}`}
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
                        );
                      })}
                    </div>
                  </div>
                )}

                {mlsPhotos.length > 0 && !showUploadSection && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowUploadSection(true)}
                    className="text-muted-foreground text-xs h-7"
                    data-testid="button-show-upload"
                  >
                    <Upload className="h-3 w-3 mr-1" />
                    Or upload your own
                  </Button>
                )}

                {(showUploadSection || mlsPhotos.length === 0) && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-sm">
                        {mlsPhotos.length > 0 ? "Upload Custom Photos" : "Property Photos"}
                      </FormLabel>
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
                        id="photo-upload"
                        onChange={(e) => handleFileUpload(e.target.files)}
                        disabled={totalSelectedPhotos >= maxPhotos}
                        data-testid="input-photo-upload"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => document.getElementById("photo-upload")?.click()}
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
                          className="resize-none h-16"
                          maxLength={maxDescriptionLength}
                          data-testid="input-flyer-description"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className="text-right text-xs">
                        {field.value?.length || 0}/{maxDescriptionLength}
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
                  <div className="flex justify-center lg:block">
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
    </Dialog>
  );
}
