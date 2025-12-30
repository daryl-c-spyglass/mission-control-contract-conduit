import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, X, Upload, Image as ImageIcon } from "lucide-react";
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

interface CreateFlyerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction;
  agentName?: string;
  agentPhone?: string;
  agentPhotoUrl?: string;
}

export function CreateFlyerDialog({
  open,
  onOpenChange,
  transaction,
  agentName = "",
  agentPhone = "",
  agentPhotoUrl,
}: CreateFlyerDialogProps) {
  const { toast } = useToast();
  const [photos, setPhotos] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const mlsData = transaction.mlsData as MLSData | null;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      price: transaction.listPrice ? `$${transaction.listPrice.toLocaleString()}` : "",
      status: "just_listed",
      bedrooms: mlsData?.bedrooms?.toString() || transaction.bedrooms?.toString() || "",
      bathrooms: mlsData?.bathrooms?.toString() || transaction.bathrooms?.toString() || "",
      sqft: mlsData?.sqft?.toString() || transaction.sqft?.toString() || "",
      description: mlsData?.description?.slice(0, 200) || "",
    },
  });

  const handleFileUpload = useCallback((files: FileList | null) => {
    if (!files) return;
    
    const remainingSlots = 3 - photos.length;
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
        setPhotos((prev) => {
          if (prev.length >= 3) return prev;
          return [...prev, result];
        });
      };
      reader.readAsDataURL(file);
    });
  }, [photos.length, toast]);

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

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const generateFlyer = async (data: FormValues) => {
    if (photos.length === 0) {
      toast({
        title: "Photos required",
        description: "Please upload at least one photo for the flyer",
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
        mainPhoto.src = photos[0];
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
        ctx.font = "24px Inter, sans-serif";
        ctx.fillStyle = "#cccccc";
        const maxWidth = canvas.width - 120;
        const words = data.description.split(" ");
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
        title: "Flyer generated",
        description: "Your property flyer has been downloaded",
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Create Property Flyer</DialogTitle>
          <DialogDescription>
            Upload photos and customize details to generate a printable property flyer.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(generateFlyer)} className="space-y-6 overflow-y-auto flex-1 pr-2">
            <div className="space-y-2">
              <FormLabel>Property Photos (up to 3)</FormLabel>
              <div
                className={`border-2 border-dashed rounded-md p-6 text-center transition-colors ${
                  isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"
                } ${photos.length >= 3 ? "opacity-50 pointer-events-none" : ""}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                data-testid="dropzone-photos"
              >
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-2">
                  Drag and drop photos here, or click to browse
                </p>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  id="photo-upload"
                  onChange={(e) => handleFileUpload(e.target.files)}
                  disabled={photos.length >= 3}
                  data-testid="input-photo-upload"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById("photo-upload")?.click()}
                  disabled={photos.length >= 3}
                  data-testid="button-browse-photos"
                >
                  Browse Files
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  {photos.length}/3 photos uploaded
                </p>
              </div>

              {photos.length > 0 && (
                <div className="flex gap-2 flex-wrap mt-3">
                  {photos.map((photo, index) => (
                    <div key={index} className="relative w-20 h-20 rounded-md overflow-hidden group">
                      <img src={photo} alt={`Upload ${index + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        data-testid={`button-remove-photo-${index}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="$500,000"
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
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-flyer-status">
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

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="bedrooms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Beds</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="3"
                        type="number"
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
                    <FormLabel>Baths</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="2"
                        type="number"
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
                    <FormLabel>Sq Ft</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="1,500"
                        type="number"
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
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter a brief property description..."
                      className="resize-none"
                      maxLength={200}
                      data-testid="input-flyer-description"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-right">
                    {field.value?.length || 0}/200 characters
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4 pb-2 sticky bottom-0 bg-background border-t mt-4">
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
                disabled={isGenerating || photos.length === 0}
                data-testid="button-generate-flyer"
              >
                {isGenerating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Generate Flyer
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
