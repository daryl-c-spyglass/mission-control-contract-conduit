import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, X, Upload, Check, Download } from "lucide-react";
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
  description: z.string().max(200, "Description must be 200 characters or less").optional(),
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

interface FlyerPreviewProps {
  mainPhotoUrl: string | null;
  status: string;
  price: string;
  address: string;
  bedrooms?: string;
  bathrooms?: string;
  sqft?: string;
  description?: string;
}

function FlyerPreview({
  mainPhotoUrl,
  status,
  price,
  address,
  bedrooms,
  bathrooms,
  sqft,
  description,
}: FlyerPreviewProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

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
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#1a1a2e] to-transparent" />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-xs text-muted-foreground">Select a photo</p>
          </div>
        )}
      </div>

      <div className="p-3 space-y-2">
        <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wide">
          {statusLabel}
        </p>
        <p className="text-sm font-bold text-white">
          {price || "$0"}
        </p>
        <div className="space-y-0.5">
          {addressParts.map((part, i) => (
            <p key={i} className="text-[10px] text-white leading-tight">
              {part.trim()}
            </p>
          ))}
        </div>
        {specs.length > 0 && (
          <p className="text-[9px] text-gray-400">
            {specs.join("  |  ")}
          </p>
        )}
        {truncatedDesc && (
          <p className="text-[8px] text-gray-300 leading-relaxed line-clamp-4">
            {truncatedDesc}
          </p>
        )}
      </div>

      <div className="absolute bottom-2 right-2">
        <img
          src={spyglassLogoWhite}
          alt="Logo"
          className="h-5 w-auto opacity-90"
        />
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
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showUploadSection, setShowUploadSection] = useState(false);

  const mlsData = transaction.mlsData as MLSData | null;

  useEffect(() => {
    if (open && mlsPhotos.length > 0) {
      setSelectedPhotos(mlsPhotos.slice(0, 3));
    } else if (open && mlsPhotos.length === 0) {
      setShowUploadSection(true);
    }
  }, [open, mlsPhotos]);

  useEffect(() => {
    if (!open) {
      setSelectedPhotos([]);
      setUploadedPhotos([]);
      setShowUploadSection(false);
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

  const togglePhotoSelection = (photoUrl: string) => {
    setSelectedPhotos((prev) => {
      if (prev.includes(photoUrl)) {
        return prev.filter((p) => p !== photoUrl);
      }
      if (prev.length >= 3) {
        toast({
          title: "Maximum photos selected",
          description: "You can select up to 3 photos for the flyer",
        });
        return prev;
      }
      return [...prev, photoUrl];
    });
  };

  const handleFileUpload = useCallback((files: FileList | null) => {
    if (!files) return;
    
    const totalPhotos = selectedPhotos.length + uploadedPhotos.length;
    const remainingSlots = 3 - totalPhotos;
    if (remainingSlots <= 0) {
      toast({
        title: "Maximum photos reached",
        description: "You can only use up to 3 photos. Deselect MLS photos to upload more.",
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
          if (prev.length >= 3) return prev;
          return [...prev, result];
        });
      };
      reader.readAsDataURL(file);
    });
  }, [selectedPhotos.length, uploadedPhotos.length, toast]);

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
    return combined.slice(0, 3);
  }, [selectedPhotos, uploadedPhotos]);

  const previewPhotoUrl = useMemo(() => {
    const photos = getPhotosForFlyer();
    return photos.length > 0 ? photos[0] : null;
  }, [getPhotosForFlyer]);

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

      canvas.width = 1080;
      canvas.height = 1920;

      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const mainPhoto = new Image();
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

      const logo = new Image();
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
        const agentPhoto = new Image();
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

      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      const addressSlug = transaction.propertyAddress.split(",")[0].replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
      link.download = `${addressSlug}_flyer.png`;
      link.href = dataUrl;
      link.click();

      toast({
        title: "Flyer downloaded",
        description: "Your property flyer has been saved",
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Create Property Flyer</DialogTitle>
          <DialogDescription>
            Select photos and customize details. Preview updates in real-time.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(generateFlyer)} className="flex-1 overflow-hidden">
            <div className="flex flex-col lg:flex-row gap-6 h-full overflow-y-auto pr-2">
              <div className="flex-1 space-y-5 min-w-0">
                {mlsPhotos.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-sm">Select Photos ({mlsPhotos.length} available)</FormLabel>
                      <span className="text-xs text-muted-foreground">
                        {selectedPhotos.length}/3 selected
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-1.5 max-h-32 overflow-y-auto p-1 border rounded-md bg-muted/30">
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
                            {!isSelected && selectedPhotos.length < 3 && (
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
                      {mlsPhotos.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {3 - selectedPhotos.length} slot{3 - selectedPhotos.length !== 1 ? 's' : ''} left
                        </span>
                      )}
                    </div>
                    <div
                      className={`border-2 border-dashed rounded-md p-4 text-center transition-colors ${
                        isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"
                      } ${selectedPhotos.length + uploadedPhotos.length >= 3 ? "opacity-50 pointer-events-none" : ""}`}
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      data-testid="dropzone-photos"
                    >
                      <Upload className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground mb-2">
                        Drag photos or click to browse
                      </p>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        id="photo-upload"
                        onChange={(e) => handleFileUpload(e.target.files)}
                        disabled={selectedPhotos.length + uploadedPhotos.length >= 3}
                        data-testid="input-photo-upload"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => document.getElementById("photo-upload")?.click()}
                        disabled={selectedPhotos.length + uploadedPhotos.length >= 3}
                        data-testid="button-browse-photos"
                      >
                        Browse
                      </Button>
                    </div>

                    {uploadedPhotos.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap">
                        {uploadedPhotos.map((photo, index) => (
                          <div key={index} className="relative w-14 h-14 rounded overflow-hidden group">
                            <img src={photo} alt={`Upload ${index + 1}`} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => removeUploadedPhoto(index)}
                              className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                              data-testid={`button-remove-photo-${index}`}
                            >
                              <X className="h-2.5 w-2.5" />
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
                            className="h-9"
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
                            <SelectTrigger className="h-9" data-testid="select-flyer-status">
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

                <div className="grid grid-cols-3 gap-3">
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
                            className="h-9"
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
                            className="h-9"
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
                            className="h-9"
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
                          maxLength={200}
                          data-testid="input-flyer-description"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className="text-right text-xs">
                        {field.value?.length || 0}/200
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="lg:w-56 flex-shrink-0">
                <div className="sticky top-0">
                  <p className="text-xs font-medium text-muted-foreground mb-2 text-center lg:text-left">
                    Preview
                  </p>
                  <FlyerPreview
                    mainPhotoUrl={previewPhotoUrl}
                    status={watchedValues.status || "just_listed"}
                    price={watchedValues.price || "$0"}
                    address={transaction.propertyAddress}
                    bedrooms={watchedValues.bedrooms}
                    bathrooms={watchedValues.bathrooms}
                    sqft={watchedValues.sqft}
                    description={watchedValues.description}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-flyer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isGenerating || !hasPhotosSelected}
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
    </Dialog>
  );
}
