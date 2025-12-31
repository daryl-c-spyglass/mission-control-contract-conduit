import { useState, useRef } from "react";
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
} from "lucide-react";
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
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
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

export function TransactionDetails({ transaction, coordinators, activities, onBack, onMarketingClick }: TransactionDetailsProps) {
  const { toast } = useToast();
  const [flyerDialogOpen, setFlyerDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const status = statusConfig[transaction.status] || statusConfig.in_contract;
  const mlsData = transaction.mlsData as MLSData | null;
  const cmaData = transaction.cmaData as CMAComparable[] | null;

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
      const res = await apiRequest("POST", `/api/transactions/${transaction.id}/refresh-mls`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "MLS data refreshed" });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions", transaction.id] });
    },
    onError: () => {
      toast({ title: "Failed to refresh MLS data", variant: "destructive" });
    },
  });

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

      <Tabs defaultValue="overview" className="space-y-6">
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
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">MLS Listing Data</h2>
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
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Listing Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Listing ID</p>
                      <p className="font-mono font-medium">{mlsData.listingId}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">List Date</p>
                      <p className="font-medium">{formatDate(mlsData.listDate)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">List Price</p>
                      <p className="font-medium">{formatPrice(mlsData.listPrice)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Property Type</p>
                      <p className="font-medium">{mlsData.propertyType}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Property Specifications</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Bedrooms</p>
                      <p className="font-medium">{mlsData.bedrooms}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Bathrooms</p>
                      <p className="font-medium">{mlsData.bathrooms}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Square Feet</p>
                      <p className="font-medium">{mlsData.sqft?.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Year Built</p>
                      <p className="font-medium">{mlsData.yearBuilt}</p>
                    </div>
                    {mlsData.lotSize && (
                      <div>
                        <p className="text-muted-foreground">Lot Size</p>
                        <p className="font-medium">{mlsData.lotSize.toLocaleString()} sqft</p>
                      </div>
                    )}
                    {mlsData.garage !== undefined && (
                      <div>
                        <p className="text-muted-foreground">Garage</p>
                        <p className="font-medium">{mlsData.garage} car</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {mlsData.agent && (
                <Card className="md:col-span-2">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Listing Agent</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 flex-wrap">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>
                          {mlsData.agent.name.split(" ").map((n) => n[0]).join("").toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium">{mlsData.agent.name}</p>
                        <p className="text-sm text-muted-foreground">{mlsData.agent.brokerage}</p>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5" />
                          <span>{mlsData.agent.phone}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5" />
                          <span>{mlsData.agent.email}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {mlsData.description && (
                <Card className="md:col-span-2">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Description</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed">{mlsData.description}</p>
                  </CardContent>
                </Card>
              )}
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
      </Tabs>
    </div>
  );
}
