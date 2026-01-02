import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Calendar,
  Home,
  Hash,
  Users,
  MessageSquare,
  Mail,
  ExternalLink,
  Phone,
  MapPin,
  Bed,
  Bath,
  Square,
  Clock,
  Activity,
  FileText,
  User,
  Loader2,
  RefreshCw,
  Image as ImageIcon,
  FileImage,
  Download,
  Trash2,
  Upload,
  File,
  Search,
  Layout,
  Smartphone,
  Newspaper,
  CreditCard,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Building,
  DollarSign,
  Share2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { CreateFlyerDialog } from "./create-flyer-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Transaction, Coordinator, Activity as ActivityType, CMAComparable, MLSData, MarketingAsset, ContractDocument } from "@shared/schema";

interface TransactionDetailsProps {
  transaction: Transaction;
  coordinators: Coordinator[];
  activities: ActivityType[];
  onBack: () => void;
  onMarketingClick?: () => void;
  initialTab?: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Active Listing", variant: "secondary" },
  in_contract: { label: "In Contract", variant: "default" },
  pending_inspection: { label: "Pending Inspection", variant: "secondary" },
  clear_to_close: { label: "Clear to Close", variant: "outline" },
  closed: { label: "Closed", variant: "secondary" },
  cancelled: { label: "Cancelled", variant: "destructive" },
};

function formatDate(dateString: string | null): string {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatPrice(price: number | null): string {
  if (!price) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(price);
}

function formatDateTime(dateString: Date | null): string {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Collapsible feature section component for MLS features
function FeatureSection({ title, items, defaultOpen = false }: { title: string; items: string[]; defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  if (!items || items.length === 0) return null;
  
  return (
    <div className="border-b border-border last:border-0">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-3 flex items-center justify-between gap-2 text-left hover-elevate rounded-md px-2 -mx-2"
        data-testid={`button-toggle-${title.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <span className="font-medium text-foreground">{title}</span>
        {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {isOpen && (
        <div className="pb-3 flex flex-wrap gap-2">
          {items.map((item, i) => (
            <span key={i} className="px-3 py-1 bg-muted text-muted-foreground text-sm rounded-full">
              {item}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Template listing data type
interface TemplateListing {
  mlsNumber: string;
  listPrice: number;
  address: string;
  city: string;
  state: string;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  yearBuilt: number;
  propertyType: string;
  description: string;
  listDate: string;
  status: string;
  images: string[];
  agent?: {
    name: string;
    phone: string;
    email: string;
    brokerage: string;
  };
}

export function TransactionDetails({ transaction, coordinators, activities, onBack, onMarketingClick, initialTab = "overview" }: TransactionDetailsProps) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const { toast } = useToast();
  const [flyerDialogOpen, setFlyerDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [templateSearch, setTemplateSearch] = useState("");
  const [templateListing, setTemplateListing] = useState<TemplateListing | null>(null);
  const [templateCategory, setTemplateCategory] = useState<string>("posts");
  const [currentPhoto, setCurrentPhoto] = useState(0);
  const status = statusConfig[transaction.status] || statusConfig.in_contract;
  const mlsData = transaction.mlsData as MLSData | null;
  const cmaData = transaction.cmaData as CMAComparable[] | null;
  
  // Photo navigation for MLS gallery
  const photos = mlsData?.photos || mlsData?.images || [];
  const nextPhoto = () => setCurrentPhoto((prev) => (prev + 1) % Math.max(photos.length, 1));
  const prevPhoto = () => setCurrentPhoto((prev) => (prev - 1 + photos.length) % Math.max(photos.length, 1));
  
  // Reset photo index when MLS data or photos change
  useEffect(() => {
    setCurrentPhoto(0);
  }, [transaction.id, mlsData?.mlsNumber, photos.length]);

  const transactionCoordinators = coordinators.filter(
    (c) => transaction.coordinatorIds?.includes(c.id)
  );

  const { data: marketingAssets = [], isLoading: assetsLoading } = useQuery<MarketingAsset[]>({
    queryKey: [`/api/transactions/${transaction.id}/marketing-assets`],
  });

  const { data: documents = [], isLoading: documentsLoading } = useQuery<ContractDocument[]>({
    queryKey: [`/api/transactions/${transaction.id}/documents`],
  });

  const uploadDocumentMutation = useMutation({
    mutationFn: async (file: File) => {
      const reader = new FileReader();
      return new Promise<ContractDocument>((resolve, reject) => {
        reader.onload = async () => {
          const fileData = reader.result as string;
          try {
            const res = await apiRequest("POST", `/api/transactions/${transaction.id}/documents`, {
              fileName: file.name,
              fileData,
              fileType: file.type,
              fileSize: file.size,
            });
            resolve(await res.json());
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/transactions/${transaction.id}/documents`] });
      toast({ title: "Document uploaded successfully" });
    },
    onError: () => {
      toast({ title: "Failed to upload document", variant: "destructive" });
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: async (docId: string) => {
      await apiRequest("DELETE", `/api/transactions/${transaction.id}/documents/${docId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/transactions/${transaction.id}/documents`] });
      toast({ title: "Document deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete document", variant: "destructive" });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        uploadDocumentMutation.mutate(file);
      });
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const downloadDocument = (doc: ContractDocument) => {
    const link = document.createElement("a");
    link.href = doc.fileData;
    link.download = doc.fileName;
    link.click();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const deleteAssetMutation = useMutation({
    mutationFn: async (assetId: string) => {
      await apiRequest("DELETE", `/api/transactions/${transaction.id}/marketing-assets/${assetId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/transactions/${transaction.id}/marketing-assets`] });
      toast({ title: "Marketing asset deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete asset", variant: "destructive" });
    },
  });

  const downloadAsset = (asset: MarketingAsset) => {
    const link = document.createElement("a");
    link.href = asset.imageData;
    link.download = asset.fileName;
    link.click();
  };

  const refreshMlsMutation = useMutation({
    mutationFn: async () => {
      console.log("=== REFRESH MLS MUTATION CALLED ===", transaction.id);
      const res = await apiRequest("POST", `/api/transactions/${transaction.id}/refresh-mls`);
      console.log("Response status:", res.status);
      return res.json();
    },
    onSuccess: (data) => {
      console.log("MLS refresh success:", data);
      toast({ title: "MLS data refreshed" });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions", transaction.id] });
    },
    onError: (error) => {
      console.error("MLS refresh error:", error);
      toast({ title: "Failed to refresh MLS data", variant: "destructive" });
    },
  });

  const searchListingMutation = useMutation({
    mutationFn: async (query: string) => {
      const res = await fetch(`/api/listings/search?query=${encodeURIComponent(query)}`, {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 404) throw new Error("No listing found");
        throw new Error("Failed to search listings");
      }
      return res.json() as Promise<TemplateListing>;
    },
    onSuccess: (data) => {
      setTemplateListing(data);
      toast({ title: "Listing found", description: data.address });
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: "destructive" });
    },
  });

  const handleTemplateSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (templateSearch.trim()) {
      searchListingMutation.mutate(templateSearch.trim());
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold" data-testid="text-detail-address">
                {transaction.propertyAddress}
              </h1>
              <Badge variant={status.variant} data-testid="badge-detail-status">
                {status.label}
              </Badge>
            </div>
            {transaction.mlsNumber && (
              <div className="flex items-center gap-1.5 mt-1 text-muted-foreground">
                <Hash className="h-3.5 w-3.5" />
                <span className="font-mono text-sm">{transaction.mlsNumber}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {transaction.slackChannelId && (
            <Button 
              variant="outline" 
              className="gap-2" 
              data-testid="button-open-slack"
              onClick={() => window.open(`https://spyglassrealty.slack.com/archives/${transaction.slackChannelId}`, "_blank")}
            >
              <MessageSquare className="h-4 w-4" />
              Open Slack
            </Button>
          )}
          {transaction.gmailLabelId && (
            <Button 
              variant="outline" 
              className="gap-2" 
              data-testid="button-view-emails"
              onClick={() => window.open(`https://mail.google.com/mail/u/0/#label/MC`, "_blank")}
            >
              <Mail className="h-4 w-4" />
              View Emails
            </Button>
          )}
          {onMarketingClick && (
            <Button 
              variant="outline" 
              className="gap-2" 
              data-testid="button-marketing-materials"
              onClick={onMarketingClick}
            >
              <ImageIcon className="h-4 w-4" />
              Marketing Materials
            </Button>
          )}
          <Button 
            variant="outline" 
            className="gap-2" 
            data-testid="button-create-flyer"
            onClick={() => setFlyerDialogOpen(true)}
          >
            <FileImage className="h-4 w-4" />
            Create Flyer
          </Button>
        </div>
      </div>

      <CreateFlyerDialog
        open={flyerDialogOpen}
        onOpenChange={setFlyerDialogOpen}
        transaction={transaction}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="mls" data-testid="tab-mls">MLS Data</TabsTrigger>
          <TabsTrigger value="cma" data-testid="tab-cma">CMA</TabsTrigger>
          <TabsTrigger value="documents" data-testid="tab-documents">
            Documents
            {documents.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">{documents.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="marketing" data-testid="tab-marketing">
            Marketing
            {marketingAssets.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">{marketingAssets.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="timeline" data-testid="tab-timeline">Timeline</TabsTrigger>
          <TabsTrigger value="templates" data-testid="tab-templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Home className="h-4 w-4" />
                  Property Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">List Price</p>
                    <p className="font-medium">{formatPrice(transaction.listPrice)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Sale Price</p>
                    <p className="font-medium">{formatPrice(transaction.salePrice)}</p>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center gap-4 text-sm">
                  {transaction.bedrooms && (
                    <div className="flex items-center gap-1.5">
                      <Bed className="h-4 w-4 text-muted-foreground" />
                      <span>{transaction.bedrooms} bed</span>
                    </div>
                  )}
                  {transaction.bathrooms && (
                    <div className="flex items-center gap-1.5">
                      <Bath className="h-4 w-4 text-muted-foreground" />
                      <span>{transaction.bathrooms} bath</span>
                    </div>
                  )}
                  {transaction.sqft && (
                    <div className="flex items-center gap-1.5">
                      <Square className="h-4 w-4 text-muted-foreground" />
                      <span>{transaction.sqft.toLocaleString()} sqft</span>
                    </div>
                  )}
                </div>
                {transaction.yearBuilt && (
                  <p className="text-sm text-muted-foreground">Built in {transaction.yearBuilt}</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Key Dates
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Contract Date</p>
                  <p className="font-medium">{formatDate(transaction.contractDate)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Expected Closing</p>
                  <p className="font-medium">{formatDate(transaction.closingDate)}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Coordinators
                </CardTitle>
              </CardHeader>
              <CardContent>
                {transactionCoordinators.length > 0 ? (
                  <div className="space-y-3">
                    {transactionCoordinators.map((coord) => (
                      <div key={coord.id} className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {coord.name.split(" ").map((n) => n[0]).join("").toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{coord.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{coord.email}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No coordinators assigned</p>
                )}
              </CardContent>
            </Card>
          </div>

          {(transaction.fubClientId || transaction.fubClientName) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Client (Follow Up Boss)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 flex-wrap">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback>
                      {transaction.fubClientName?.split(" ").map((n) => n[0]).join("").toUpperCase() || "CL"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{transaction.fubClientName || "Unknown Client"}</p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1 flex-wrap">
                      {transaction.fubClientEmail && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5" />
                          <span>{transaction.fubClientEmail}</span>
                        </div>
                      )}
                      {transaction.fubClientPhone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5" />
                          <span>{transaction.fubClientPhone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {transaction.fubClientId && (
                    <Button 
                      variant="outline" 
                      className="gap-2" 
                      data-testid="button-view-fub"
                      onClick={() => window.open(`https://spyglassrealty.followupboss.com/2/people/view/${transaction.fubClientId}`, "_blank")}
                    >
                      <ExternalLink className="h-4 w-4" />
                      View in FUB
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Media Section */}
          {(() => {
            const photos: string[] = [];
            if (transaction.propertyImages && Array.isArray(transaction.propertyImages)) {
              photos.push(...transaction.propertyImages as string[]);
            }
            if (mlsData?.images && Array.isArray(mlsData.images)) {
              photos.push(...mlsData.images);
            }
            
            if (photos.length > 0) {
              return (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-4">
                      <CardTitle className="text-base flex items-center gap-2">
                        <ImageIcon className="h-4 w-4" />
                        Property Photos
                      </CardTitle>
                      {onMarketingClick && (
                        <Button variant="outline" size="sm" onClick={onMarketingClick} data-testid="button-create-marketing">
                          Create Marketing Materials
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {photos.slice(0, 8).map((photo, index) => (
                        <div key={index} className="aspect-video bg-muted rounded-md overflow-hidden">
                          <img
                            src={`/api/proxy-image?url=${encodeURIComponent(photo)}`}
                            alt={`Property photo ${index + 1}`}
                            className="w-full h-full object-cover"
                            data-testid={`img-property-photo-${index}`}
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        </div>
                      ))}
                    </div>
                    {photos.length > 8 && (
                      <p className="text-sm text-muted-foreground mt-2 text-center">
                        +{photos.length - 8} more photos available in Marketing Materials
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            }
            return null;
          })()}
        </TabsContent>

        <TabsContent value="mls" className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h2 className="text-xl font-bold">MLS Listing Data</h2>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => refreshMlsMutation.mutate()}
              disabled={refreshMlsMutation.isPending}
              data-testid="button-refresh-mls"
            >
              {refreshMlsMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh MLS Data
            </Button>
          </div>

          {mlsData ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Photos & Description */}
              <div className="lg:col-span-2 space-y-6">
                {/* Photo Gallery */}
                {photos.length > 0 && (
                  <Card>
                    <CardContent className="p-0">
                      <div className="relative">
                        <img 
                          src={`/api/proxy-image?url=${encodeURIComponent(photos[currentPhoto] || '')}`}
                          alt={`Property photo ${currentPhoto + 1}`}
                          className="w-full h-80 object-cover rounded-t-lg"
                          data-testid="img-mls-main-photo"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%23f0f0f0' width='400' height='300'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' fill='%23999' dy='0.3em'%3ENo Image%3C/text%3E%3C/svg%3E";
                          }}
                        />
                        {photos.length > 1 && (
                          <>
                            <button 
                              onClick={prevPhoto}
                              className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                              data-testid="button-photo-prev"
                            >
                              <ChevronLeft className="h-5 w-5" />
                            </button>
                            <button 
                              onClick={nextPhoto}
                              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                              data-testid="button-photo-next"
                            >
                              <ChevronRight className="h-5 w-5" />
                            </button>
                            <div className="absolute bottom-3 right-3 px-3 py-1 bg-black/60 text-white text-sm rounded-full">
                              {currentPhoto + 1} / {photos.length}
                            </div>
                          </>
                        )}
                      </div>
                      
                      {/* Thumbnails */}
                      {photos.length > 1 && (
                        <div className="p-3 flex gap-2 overflow-x-auto">
                          {photos.slice(0, 10).map((photo, i) => (
                            <button
                              key={i}
                              onClick={() => setCurrentPhoto(i)}
                              className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                                i === currentPhoto ? 'border-primary' : 'border-transparent'
                              }`}
                              data-testid={`button-thumbnail-${i}`}
                            >
                              <img 
                                src={`/api/proxy-image?url=${encodeURIComponent(photo)}`} 
                                alt={`Thumb ${i + 1}`} 
                                className="w-full h-full object-cover" 
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = "none";
                                }}
                              />
                            </button>
                          ))}
                          {photos.length > 10 && (
                            <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-muted flex items-center justify-center text-muted-foreground text-sm">
                              +{photos.length - 10}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Photo Actions */}
                      <div className="px-4 pb-4 flex gap-2 flex-wrap">
                        <Button variant="secondary" size="sm" className="gap-2" data-testid="button-download-photos">
                          <Download className="h-4 w-4" /> Download All
                        </Button>
                        {onMarketingClick && (
                          <Button variant="secondary" size="sm" className="gap-2" onClick={onMarketingClick} data-testid="button-use-marketing">
                            <Share2 className="h-4 w-4" /> Use in Marketing
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                {/* Description */}
                {mlsData.description && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Property Description</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground leading-relaxed">{mlsData.description}</p>
                    </CardContent>
                  </Card>
                )}
                
                {/* Property Features */}
                {((mlsData.interiorFeatures?.length || 0) > 0 || (mlsData.exteriorFeatures?.length || 0) > 0 || (mlsData.appliances?.length || 0) > 0 || (mlsData.heatingCooling?.length || 0) > 0 || (mlsData.flooring?.length || 0) > 0 || (mlsData.parking?.length || 0) > 0 || (mlsData.constructionMaterials?.length || 0) > 0 || mlsData.roofMaterial || mlsData.foundation || mlsData.pool || mlsData.waterSource || mlsData.sewer) && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Property Features</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="divide-y divide-border">
                        <FeatureSection title="Interior Features" items={mlsData.interiorFeatures || []} defaultOpen={true} />
                        <FeatureSection title="Exterior Features" items={mlsData.exteriorFeatures || []} />
                        <FeatureSection title="Appliances" items={mlsData.appliances || []} />
                        <FeatureSection title="Heating & Cooling" items={mlsData.heatingCooling || []} />
                        <FeatureSection title="Flooring" items={mlsData.flooring || []} />
                        <FeatureSection title="Parking" items={mlsData.parking || []} />
                        <FeatureSection title="Construction" items={mlsData.constructionMaterials || []} />
                      </div>
                      
                      {/* Single-value property details */}
                      {(mlsData.roofMaterial || mlsData.foundation || mlsData.pool || mlsData.waterSource || mlsData.sewer) && (
                        <div className="mt-4 pt-4 border-t space-y-2">
                          {mlsData.roofMaterial && mlsData.roofMaterial !== "None" && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Roof</span>
                              <span>{mlsData.roofMaterial}</span>
                            </div>
                          )}
                          {mlsData.foundation && mlsData.foundation !== "None" && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Foundation</span>
                              <span>{mlsData.foundation}</span>
                            </div>
                          )}
                          {mlsData.pool && mlsData.pool !== "None" && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Pool</span>
                              <span>{mlsData.pool}</span>
                            </div>
                          )}
                          {mlsData.waterSource && mlsData.waterSource !== "None" && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Water Source</span>
                              <span>{mlsData.waterSource}</span>
                            </div>
                          )}
                          {mlsData.sewer && mlsData.sewer !== "None" && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Sewer</span>
                              <span>{mlsData.sewer}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
              
              {/* Right Column - Stats & Details */}
              <div className="space-y-6">
                {/* Price & Status Card */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <Badge variant={mlsData.status?.toLowerCase() === 'active' ? 'default' : 'secondary'}>
                        {mlsData.status || 'Unknown'}
                      </Badge>
                      <span className="text-sm text-muted-foreground">{mlsData.daysOnMarket || 0} days on market</span>
                    </div>
                    <div className="text-3xl font-bold mb-1" data-testid="text-mls-price">
                      {formatPrice(mlsData.listPrice)}
                    </div>
                    {mlsData.sqft > 0 && (
                      <div className="text-muted-foreground text-sm">
                        ${Math.round(mlsData.listPrice / mlsData.sqft).toLocaleString()}/sqft
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                {/* Property Stats */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Property Overview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Bed className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Beds</div>
                          <div className="font-semibold">{mlsData.bedrooms || 0}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Bath className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Baths</div>
                          <div className="font-semibold">
                            {mlsData.bathrooms || 0}{mlsData.halfBaths > 0 && `.${mlsData.halfBaths}`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Square className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Sq Ft</div>
                          <div className="font-semibold">{mlsData.sqft?.toLocaleString() || '—'}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <MapPin className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Lot</div>
                          <div className="font-semibold text-sm">{mlsData.lotSize || '—'}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Calendar className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Year Built</div>
                          <div className="font-semibold">{mlsData.yearBuilt || '—'}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Building className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Stories</div>
                          <div className="font-semibold">{mlsData.stories || 1}</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Financial Info */}
                {(mlsData.hoaFee || mlsData.taxAmount) && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Financial Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {mlsData.hoaFee && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">HOA Fee</span>
                          <span className="font-medium">${mlsData.hoaFee}/{mlsData.hoaFrequency || 'Monthly'}</span>
                        </div>
                      )}
                      {mlsData.taxAmount && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Annual Taxes</span>
                          <span className="font-medium">
                            ${typeof mlsData.taxAmount === 'object' && mlsData.taxAmount !== null
                              ? ((mlsData.taxAmount as any).annualAmount || 0).toLocaleString()
                              : (mlsData.taxAmount as number).toLocaleString()}
                          </span>
                        </div>
                      )}
                      {(mlsData.taxYear || (typeof mlsData.taxAmount === 'object' && (mlsData.taxAmount as any)?.assessmentYear)) && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Tax Year</span>
                          <span className="font-medium">
                            {mlsData.taxYear || (mlsData.taxAmount as any)?.assessmentYear}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
                
                {/* Listing Info */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Listing Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">MLS #</span>
                      <span className="font-mono font-medium">{mlsData.mlsNumber || transaction.mlsNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">List Date</span>
                      <span className="font-medium">{formatDate(mlsData.listDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Property Type</span>
                      <span className="font-medium">{mlsData.propertyType || '—'}</span>
                    </div>
                    {mlsData.propertyStyle && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Style</span>
                        <span className="font-medium">{mlsData.propertyStyle}</span>
                      </div>
                    )}
                    {mlsData.garage && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Garage</span>
                        <span className="font-medium">{mlsData.garage}</span>
                      </div>
                    )}
                    <Separator className="my-2" />
                    {(mlsData.listingAgent || mlsData.agent?.name) && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Agent</span>
                        <span className="font-medium">{mlsData.listingAgent || mlsData.agent?.name}</span>
                      </div>
                    )}
                    {(mlsData.listingOffice || mlsData.agent?.brokerage) && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Office</span>
                        <span className="font-medium text-right max-w-[150px] truncate">
                          {typeof mlsData.listingOffice === 'object' && mlsData.listingOffice !== null 
                            ? (mlsData.listingOffice as any).name 
                            : mlsData.listingOffice || 
                              (typeof mlsData.agent?.brokerage === 'object' && mlsData.agent?.brokerage !== null
                                ? (mlsData.agent.brokerage as any).name
                                : mlsData.agent?.brokerage)}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-medium mb-2">No MLS Data Available</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  MLS data hasn't been fetched for this property yet.
                </p>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => refreshMlsMutation.mutate()}
                  disabled={refreshMlsMutation.isPending}
                  data-testid="button-fetch-mls"
                >
                  {refreshMlsMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Fetch MLS Data
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="cma" className="space-y-6">
          <h2 className="text-lg font-semibold">Comparative Market Analysis</h2>

          {cmaData && cmaData.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {cmaData.map((comp, index) => (
                <Card key={index}>
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{comp.address}</p>
                        <p className="text-lg font-semibold">{formatPrice(comp.price)}</p>
                      </div>
                      <Badge variant="outline" className="shrink-0">
                        {comp.distance.toFixed(1)} mi
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Bed className="h-3.5 w-3.5" />
                        {comp.bedrooms}
                      </div>
                      <div className="flex items-center gap-1">
                        <Bath className="h-3.5 w-3.5" />
                        {comp.bathrooms}
                      </div>
                      <div className="flex items-center gap-1">
                        <Square className="h-3.5 w-3.5" />
                        {comp.sqft.toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      {comp.daysOnMarket} days on market
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Activity className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-medium mb-2">No CMA Data Available</h3>
                <p className="text-sm text-muted-foreground">
                  Comparative market analysis will appear here once MLS data is fetched.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="documents" className="space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h2 className="text-lg font-semibold">Contract Documents</h2>
            <div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
                multiple
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                data-testid="input-file-upload"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadDocumentMutation.isPending}
                data-testid="button-upload-document"
              >
                {uploadDocumentMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Upload Documents
              </Button>
            </div>
          </div>

          {documentsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-md" />
              ))}
            </div>
          ) : documents.length > 0 ? (
            <div className="space-y-3">
              {documents.map((doc) => (
                <Card key={doc.id} data-testid={`card-document-${doc.id}`}>
                  <CardContent className="flex items-center gap-4 py-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                      <File className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(doc.fileSize)} {doc.uploadedBy && `| Uploaded by ${doc.uploadedBy}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => downloadDocument(doc)}
                        data-testid={`button-download-doc-${doc.id}`}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteDocumentMutation.mutate(doc.id)}
                        disabled={deleteDocumentMutation.isPending}
                        data-testid={`button-delete-doc-${doc.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-medium mb-2">No Documents Yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Upload contract documents, amendments, and other files for this transaction.
                </p>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="button-upload-first-document"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Documents
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="marketing" className="space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h2 className="text-lg font-semibold">Marketing Assets</h2>
            {onMarketingClick && (
              <Button 
                variant="outline" 
                onClick={onMarketingClick}
                data-testid="button-create-marketing"
              >
                <ImageIcon className="h-4 w-4 mr-2" />
                Create New Graphics
              </Button>
            )}
          </div>

          {assetsLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-48 w-full rounded-md" />
              ))}
            </div>
          ) : marketingAssets.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {marketingAssets.map((asset) => (
                <Card key={asset.id} data-testid={`card-asset-${asset.id}`}>
                  <CardContent className="pt-4 space-y-3">
                    <div className="aspect-video bg-muted rounded-md overflow-hidden">
                      <img 
                        src={asset.imageData} 
                        alt={asset.fileName}
                        className="w-full h-full object-cover"
                        data-testid={`img-asset-${asset.id}`}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{asset.fileName}</p>
                        <Badge variant="outline" className="text-xs mt-1">
                          {asset.type === "facebook" ? "Facebook" : 
                           asset.type === "instagram" ? "Instagram" :
                           asset.type === "alt_style" ? "Alt Style" : asset.type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => downloadAsset(asset)}
                          data-testid={`button-download-asset-${asset.id}`}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteAssetMutation.mutate(asset.id)}
                          disabled={deleteAssetMutation.isPending}
                          data-testid={`button-delete-asset-${asset.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-medium mb-2">No Marketing Assets Yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Generate social media graphics and other marketing materials for this property.
                </p>
                {onMarketingClick && (
                  <Button onClick={onMarketingClick} data-testid="button-create-first-asset">
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Create Marketing Materials
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="timeline" className="space-y-6">
          <h2 className="text-lg font-semibold">Activity Timeline</h2>

          {activities.length > 0 ? (
            <div className="space-y-4">
              {activities.map((activity) => (
                <div key={activity.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="h-2 w-2 rounded-full bg-primary mt-2" />
                    <div className="flex-1 w-px bg-border" />
                  </div>
                  <div className="flex-1 pb-4">
                    <p className="text-sm font-medium">{activity.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDateTime(activity.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Activity className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-medium mb-2">No Activity Yet</h3>
                <p className="text-sm text-muted-foreground">
                  Activity will be recorded as actions are taken on this transaction.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Listing Marketing Templates</h2>
              <p className="text-sm text-muted-foreground">
                Search for a listing by address or MLS number to generate marketing templates
              </p>
            </div>

            <form onSubmit={handleTemplateSearch} className="flex gap-2 max-w-xl">
              <Input
                placeholder="Enter address or MLS number..."
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
                data-testid="input-template-search"
              />
              <Button 
                type="submit" 
                disabled={searchListingMutation.isPending || !templateSearch.trim()}
                data-testid="button-search-listing"
              >
                {searchListingMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </form>

            {templateListing && (
              <div className="space-y-6">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-4">
                      {templateListing.images[0] && (
                        <div className="w-24 h-16 rounded-md overflow-hidden bg-muted shrink-0">
                          <img
                            src={`/api/proxy-image?url=${encodeURIComponent(templateListing.images[0])}`}
                            alt={templateListing.address}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold">{templateListing.address}</h3>
                          <Badge variant="outline">{templateListing.status}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {templateListing.city}, {templateListing.state}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-sm">
                          <span className="font-semibold">{formatPrice(templateListing.listPrice)}</span>
                          <span className="flex items-center gap-1">
                            <Bed className="h-3.5 w-3.5" /> {templateListing.bedrooms}
                          </span>
                          <span className="flex items-center gap-1">
                            <Bath className="h-3.5 w-3.5" /> {templateListing.bathrooms}
                          </span>
                          <span className="flex items-center gap-1">
                            <Square className="h-3.5 w-3.5" /> {templateListing.sqft.toLocaleString()} sqft
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex items-center gap-2 flex-wrap border-b pb-4">
                  {[
                    { id: "posts", label: "Posts", icon: Layout },
                    { id: "stories", label: "Stories", icon: Smartphone },
                    { id: "flyers", label: "Flyers", icon: Newspaper },
                    { id: "postcards", label: "Post Cards", icon: CreditCard },
                    { id: "brochures", label: "Brochures", icon: BookOpen },
                  ].map((cat) => (
                    <Button
                      key={cat.id}
                      variant={templateCategory === cat.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTemplateCategory(cat.id)}
                      data-testid={`button-template-cat-${cat.id}`}
                    >
                      <cat.icon className="h-4 w-4 mr-2" />
                      {cat.label}
                    </Button>
                  ))}
                </div>

                <div className="space-y-4">
                  {templateCategory === "posts" && (
                    <div>
                      <h3 className="text-base font-medium mb-4">Social Media Posts</h3>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        {templateListing.images.slice(0, 4).map((img, idx) => (
                          <Card key={idx} className="overflow-hidden">
                            <div className="relative aspect-square bg-black">
                              <img
                                src={`/api/proxy-image?url=${encodeURIComponent(img)}`}
                                alt={`Post template ${idx + 1}`}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                              <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                                <p className="text-xs font-semibold uppercase tracking-wider mb-1">Just Listed</p>
                                <p className="text-sm font-medium line-clamp-2">{templateListing.address}</p>
                                <p className="text-xs mt-1">{formatPrice(templateListing.listPrice)}</p>
                              </div>
                              <div className="absolute top-2 right-2 bg-white/90 dark:bg-black/90 px-2 py-1 rounded text-xs font-semibold">
                                SPYGLASS REALTY
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {templateCategory === "stories" && (
                    <div>
                      <h3 className="text-base font-medium mb-4">Stories (9:16)</h3>
                      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                        {templateListing.images.slice(0, 4).map((img, idx) => (
                          <Card key={idx} className="overflow-hidden">
                            <div className="relative aspect-[9/16] bg-black">
                              <img
                                src={`/api/proxy-image?url=${encodeURIComponent(img)}`}
                                alt={`Story template ${idx + 1}`}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                              <div className="absolute top-4 left-0 right-0 text-center text-white">
                                <p className="text-xs font-semibold uppercase tracking-wider">Spyglass Realty</p>
                              </div>
                              <div className="absolute bottom-0 left-0 right-0 p-4 text-white text-center">
                                <p className="text-lg font-bold">{formatPrice(templateListing.listPrice)}</p>
                                <p className="text-sm">{templateListing.address}</p>
                                <p className="text-xs mt-1 opacity-80">
                                  {templateListing.bedrooms} bed | {templateListing.bathrooms} bath | {templateListing.sqft.toLocaleString()} sqft
                                </p>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {templateCategory === "flyers" && (
                    <div>
                      <h3 className="text-base font-medium mb-4">Property Flyers</h3>
                      <div className="grid gap-4 md:grid-cols-2">
                        <Card className="overflow-hidden">
                          <div className="relative aspect-[8.5/11] bg-white dark:bg-card p-4">
                            <div className="h-full border rounded-md p-4 flex flex-col">
                              <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-semibold uppercase tracking-wider">Spyglass Realty</span>
                                <Badge variant="outline" className="text-xs">Just Listed</Badge>
                              </div>
                              {templateListing.images[0] && (
                                <div className="w-full aspect-video rounded-md overflow-hidden bg-muted mb-3">
                                  <img
                                    src={`/api/proxy-image?url=${encodeURIComponent(templateListing.images[0])}`}
                                    alt="Main photo"
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )}
                              <h4 className="font-semibold text-sm">{templateListing.address}</h4>
                              <p className="text-xs text-muted-foreground">{templateListing.city}, {templateListing.state}</p>
                              <p className="text-lg font-bold mt-2">{formatPrice(templateListing.listPrice)}</p>
                              <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                                <span>{templateListing.bedrooms} Beds</span>
                                <span>{templateListing.bathrooms} Baths</span>
                                <span>{templateListing.sqft.toLocaleString()} Sqft</span>
                              </div>
                              {templateListing.description && (
                                <p className="text-xs mt-3 line-clamp-4 text-muted-foreground flex-1">
                                  {templateListing.description}
                                </p>
                              )}
                              <div className="mt-auto pt-3 border-t text-xs text-center text-muted-foreground">
                                Contact your agent for more information
                              </div>
                            </div>
                          </div>
                        </Card>
                        <Card className="overflow-hidden">
                          <div className="relative aspect-[8.5/11] bg-white dark:bg-card">
                            {templateListing.images[0] && (
                              <img
                                src={`/api/proxy-image?url=${encodeURIComponent(templateListing.images[0])}`}
                                alt="Full bleed"
                                className="w-full h-full object-cover"
                              />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                            <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                              <span className="text-white text-sm font-semibold">SPYGLASS REALTY</span>
                              <Badge className="bg-white text-black">Just Listed</Badge>
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                              <p className="text-2xl font-bold">{formatPrice(templateListing.listPrice)}</p>
                              <p className="text-lg font-medium mt-1">{templateListing.address}</p>
                              <p className="text-sm opacity-80">{templateListing.city}, {templateListing.state}</p>
                              <div className="flex gap-4 mt-3 text-sm">
                                <span>{templateListing.bedrooms} Beds</span>
                                <span>{templateListing.bathrooms} Baths</span>
                                <span>{templateListing.sqft.toLocaleString()} Sqft</span>
                              </div>
                            </div>
                          </div>
                        </Card>
                      </div>
                    </div>
                  )}

                  {templateCategory === "postcards" && (
                    <div>
                      <h3 className="text-base font-medium mb-4">Post Cards</h3>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {["Open House", "Just Listed", "Under Contract"].map((type, idx) => (
                          <Card key={idx} className="overflow-hidden">
                            <div className="relative aspect-[6/4] bg-white dark:bg-card">
                              {templateListing.images[0] && (
                                <img
                                  src={`/api/proxy-image?url=${encodeURIComponent(templateListing.images[idx % templateListing.images.length] || templateListing.images[0])}`}
                                  alt={type}
                                  className="w-full h-full object-cover"
                                />
                              )}
                              <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-transparent" />
                              <div className="absolute top-0 left-0 bottom-0 w-1/2 p-4 flex flex-col justify-between text-white">
                                <div>
                                  <span className="text-xs font-semibold opacity-80">SPYGLASS REALTY</span>
                                  <p className="text-lg font-bold mt-2">{type}</p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium">{templateListing.address}</p>
                                  <p className="text-xs opacity-80">{templateListing.city}, {templateListing.state}</p>
                                  <p className="text-base font-bold mt-1">{formatPrice(templateListing.listPrice)}</p>
                                </div>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {templateCategory === "brochures" && (
                    <div>
                      <h3 className="text-base font-medium mb-4">Brochures</h3>
                      <div className="grid gap-4 md:grid-cols-2">
                        <Card className="overflow-hidden">
                          <div className="relative aspect-[8.5/11] bg-white dark:bg-card p-6">
                            <div className="h-full flex flex-col">
                              <div className="text-center mb-4">
                                <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Spyglass Realty</span>
                              </div>
                              <p className="text-2xl font-bold text-center">{templateListing.address}</p>
                              <p className="text-center text-muted-foreground">{templateListing.city}, {templateListing.state}</p>
                              {templateListing.images[0] && (
                                <div className="w-full aspect-video rounded-md overflow-hidden bg-muted my-4">
                                  <img
                                    src={`/api/proxy-image?url=${encodeURIComponent(templateListing.images[0])}`}
                                    alt="Main"
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )}
                              <div className="flex justify-center gap-6 mb-4 text-center">
                                <div>
                                  <p className="text-xl font-bold">{templateListing.bedrooms}</p>
                                  <p className="text-xs text-muted-foreground">Beds</p>
                                </div>
                                <div>
                                  <p className="text-xl font-bold">{templateListing.bathrooms}</p>
                                  <p className="text-xs text-muted-foreground">Baths</p>
                                </div>
                                <div>
                                  <p className="text-xl font-bold">{templateListing.sqft.toLocaleString()}</p>
                                  <p className="text-xs text-muted-foreground">Sqft</p>
                                </div>
                              </div>
                              <p className="text-2xl font-bold text-center mb-4">{formatPrice(templateListing.listPrice)}</p>
                              {templateListing.description && (
                                <p className="text-xs text-muted-foreground line-clamp-6 flex-1">
                                  {templateListing.description}
                                </p>
                              )}
                              <div className="grid grid-cols-3 gap-2 mt-4">
                                {templateListing.images.slice(1, 4).map((img, i) => (
                                  <div key={i} className="aspect-square rounded-md overflow-hidden bg-muted">
                                    <img
                                      src={`/api/proxy-image?url=${encodeURIComponent(img)}`}
                                      alt={`Photo ${i + 2}`}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </Card>
                        <Card className="overflow-hidden">
                          <div className="relative aspect-[8.5/11] bg-white dark:bg-card flex">
                            <div className="w-2/5 p-4 flex flex-col justify-center bg-gradient-to-b from-primary/10 to-primary/5">
                              <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Open House</p>
                              <p className="text-lg font-bold">{formatPrice(templateListing.listPrice)}</p>
                              <p className="text-sm font-medium mt-2">{templateListing.address}</p>
                              <p className="text-xs text-muted-foreground">{templateListing.city}, {templateListing.state}</p>
                              <div className="mt-4 space-y-1 text-sm">
                                <p>{templateListing.bedrooms} Bedrooms</p>
                                <p>{templateListing.bathrooms} Bathrooms</p>
                                <p>{templateListing.sqft.toLocaleString()} Sqft</p>
                              </div>
                              <div className="mt-auto pt-4">
                                <p className="text-xs font-semibold">Spyglass Realty</p>
                              </div>
                            </div>
                            <div className="w-3/5 relative">
                              {templateListing.images[0] && (
                                <img
                                  src={`/api/proxy-image?url=${encodeURIComponent(templateListing.images[0])}`}
                                  alt="Feature"
                                  className="w-full h-full object-cover"
                                />
                              )}
                            </div>
                          </div>
                        </Card>
                      </div>
                    </div>
                  )}
                </div>

                {templateListing.images.length === 0 && (
                  <Card>
                    <CardContent className="py-8 text-center">
                      <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                      <h3 className="font-medium mb-2">No Photos Available</h3>
                      <p className="text-sm text-muted-foreground">
                        This listing doesn't have any photos to use for templates.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {!templateListing && !searchListingMutation.isPending && (
              <Card>
                <CardContent className="py-12 text-center">
                  <Search className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="font-medium mb-2">Search for a Listing</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Enter an address or MLS number above to find a listing and generate marketing templates with photos, pricing, and property details.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
