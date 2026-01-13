import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Share2, Link as LinkIcon, Copy, Check, Trash2, ExternalLink, Printer, Loader2, Mail } from "lucide-react";
import { SiFacebook, SiX, SiInstagram, SiTiktok } from "react-icons/si";
import { Link } from "wouter";
import { CMAReport } from "@/components/CMAReport";
import { useToast } from "@/hooks/use-toast";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Cma, Property, PropertyStatistics, TimelineDataPoint } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";

// Available metrics for statistics display - keys must match CMAReport's StatMetricKey
export const STAT_METRICS = [
  { key: 'price', label: 'Price' },
  { key: 'pricePerSqFt', label: 'Price/SqFt' },
  { key: 'daysOnMarket', label: 'Days on Market' },
  { key: 'livingArea', label: 'Living SqFt' },
  { key: 'lotSize', label: 'Lot SqFt' },
  { key: 'acres', label: 'Acres' },
  { key: 'bedrooms', label: 'Beds' },
  { key: 'bathrooms', label: 'Baths' },
  { key: 'yearBuilt', label: 'Year Built' },
] as const;

export type StatMetricKey = typeof STAT_METRICS[number]['key'];

interface ShareResponse {
  shareToken: string;
  shareUrl: string;
}

export default function CMADetailPage() {
  const [, params] = useRoute("/cmas/:id");
  const [, setLocation] = useLocation();
  const id = params?.id;
  const { toast } = useToast();
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [emailShareDialogOpen, setEmailShareDialogOpen] = useState(false);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [statsDialogOpen, setStatsDialogOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [copied, setCopied] = useState(false);
  
  // Email share form state
  const [emailForm, setEmailForm] = useState({
    yourName: '',
    yourEmail: '',
    friendName: '',
    friendEmail: '',
    comments: 'Check out this CMA report I created for you.',
  });
  
  // Visible metrics state - all enabled by default
  const [visibleMetrics, setVisibleMetrics] = useState<StatMetricKey[]>(
    STAT_METRICS.map(m => m.key)
  );
  
  const toggleMetric = (key: StatMetricKey) => {
    setVisibleMetrics(prev => 
      prev.includes(key) 
        ? prev.filter(k => k !== key)
        : [...prev, key]
    );
  };

  const { data: cma, isLoading: cmaLoading, refetch: refetchCma } = useQuery<Cma>({
    queryKey: ['/api/cmas', id],
    enabled: !!id,
    queryFn: async () => {
      const response = await fetch(`/api/cmas/${id}`);
      if (!response.ok) throw new Error('Failed to fetch CMA');
      return response.json();
    },
  });

  const { data: statistics, isLoading: statsLoading } = useQuery<PropertyStatistics>({
    queryKey: ['/api/cmas', id, 'statistics'],
    enabled: !!id && !!cma,
    queryFn: async () => {
      const response = await fetch(`/api/cmas/${id}/statistics`);
      if (!response.ok) throw new Error('Failed to fetch statistics');
      return response.json();
    },
  });

  const { data: timelineData = [], isLoading: timelineLoading } = useQuery<TimelineDataPoint[]>({
    queryKey: ['/api/cmas', id, 'timeline'],
    enabled: !!id && !!cma,
    queryFn: async () => {
      const response = await fetch(`/api/cmas/${id}/timeline`);
      if (!response.ok) throw new Error('Failed to fetch timeline');
      return response.json();
    },
  });


  const shareMutation = useMutation<ShareResponse>({
    mutationFn: async () => {
      const response = await fetch(`/api/cmas/${id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to generate share link');
      return response.json();
    },
    onSuccess: () => {
      refetchCma();
      toast({
        title: "Share link generated",
        description: "Your CMA is now shareable via the link.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate share link.",
        variant: "destructive",
      });
    },
  });

  const unshareMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/cmas/${id}/share`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to remove share link');
      return response.json();
    },
    onSuccess: () => {
      refetchCma();
      setShareDialogOpen(false);
      toast({
        title: "Share link removed",
        description: "This CMA is no longer publicly accessible.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove share link.",
        variant: "destructive",
      });
    },
  });

  const updateNotesMutation = useMutation({
    mutationFn: async (newNotes: string) => {
      const response = await fetch(`/api/cmas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: newNotes }),
      });
      if (!response.ok) throw new Error('Failed to update notes');
      return response.json();
    },
    onSuccess: () => {
      refetchCma();
      setNotesDialogOpen(false);
      toast({
        title: "Notes saved",
        description: "Your notes have been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save notes.",
        variant: "destructive",
      });
    },
  });

  const properties = cma ? ((cma as any).propertiesData || []) : [];

  // Sync notes state when CMA loads
  const handleOpenNotesDialog = () => {
    setNotes(cma?.notes || "");
    setNotesDialogOpen(true);
  };

  const handleSaveNotes = () => {
    updateNotesMutation.mutate(notes);
  };

  const handleSave = () => {
    // CMA is already saved - just show confirmation
    toast({
      title: "CMA Saved",
      description: "Your CMA has been saved successfully.",
    });
  };

  const [emailFallbackUrl, setEmailFallbackUrl] = useState<string | null>(null);
  
  const emailShareMutation = useMutation({
    mutationFn: async (data: typeof emailForm) => {
      // First ensure we have a public link
      if (!cma?.publicLink) {
        await shareMutation.mutateAsync();
      }
      // Then send the email
      const response = await fetch(`/api/cmas/${id}/email-share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderName: data.yourName,
          senderEmail: data.yourEmail,
          recipientName: data.friendName,
          recipientEmail: data.friendEmail,
          message: data.comments,
        }),
      });
      if (!response.ok) throw new Error('Failed to send email');
      return response.json();
    },
    onSuccess: (data) => {
      if (data.emailSent) {
        setEmailShareDialogOpen(false);
        toast({
          title: "CMA Shared",
          description: "Your CMA has been sent via email.",
        });
        setEmailFallbackUrl(null);
      } else {
        // Email service not configured - show fallback with URL
        setEmailFallbackUrl(data.shareUrl);
        toast({
          title: "Email Not Sent",
          description: data.message,
          variant: "destructive",
        });
      }
      // Reset form
      setEmailForm({
        yourName: '',
        yourEmail: '',
        friendName: '',
        friendEmail: '',
        comments: 'Check out this CMA report I created for you.',
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send email. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleEmailShare = () => {
    // Validate form
    if (!emailForm.yourName || !emailForm.yourEmail || !emailForm.friendName || !emailForm.friendEmail) {
      toast({
        title: "Required fields missing",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    emailShareMutation.mutate(emailForm);
  };

  const handleModifySearch = () => {
    // Navigate to CMA builder with current CMA data pre-loaded
    setLocation(`/cmas/new?from=${id}`);
  };

  const handleModifyStats = () => {
    setStatsDialogOpen(true);
  };

  const handlePrint = () => {
    window.print();
  };

  const generateClientEmail = () => {
    if (!cma || !statistics) return '';
    
    const propertiesData = (cma as any).propertiesData || [];
    const compCount = propertiesData.length;
    
    const subjectProperty = cma.subjectPropertyId 
      ? propertiesData.find((p: Property) => p.id === cma.subjectPropertyId)
      : null;
    
    const subjectAddress = subjectProperty?.unparsedAddress || cma.name || 'your property';
    const subdivision = (cma.searchCriteria as any)?.subdivisionName || 
                        (cma.searchCriteria as any)?.subdivision ||
                        subjectProperty?.subdivision ||
                        (cma.searchCriteria as any)?.city || 
                        'your area';
    
    const soldWithinDays = (cma.searchCriteria as any)?.soldWithinDays;
    const timeframe = soldWithinDays 
      ? `last ${soldWithinDays} days`
      : 'last 6 months';
    
    const priceMin = statistics.price?.range?.min 
      ? `$${Math.round(statistics.price.range.min).toLocaleString()}`
      : 'N/A';
    const priceMax = statistics.price?.range?.max
      ? `$${Math.round(statistics.price.range.max).toLocaleString()}`
      : 'N/A';
    const avgPricePerSqFt = statistics.pricePerSqFt?.average
      ? `$${Math.round(statistics.pricePerSqFt.average)}`
      : 'N/A';
    const avgDOM = statistics.daysOnMarket?.average
      ? `${Math.round(statistics.daysOnMarket.average)}`
      : 'N/A';
    
    const subjectSqFt = subjectProperty?.livingArea 
      ? Number(subjectProperty.livingArea).toLocaleString()
      : (statistics.livingArea?.average ? Math.round(statistics.livingArea.average).toLocaleString() : 'comparable homes');
    
    const lowEstimate = statistics.price?.range?.min && statistics.price?.average
      ? `$${Math.round((statistics.price.range.min + statistics.price.average) / 2).toLocaleString()}`
      : priceMin;
    const highEstimate = statistics.price?.range?.max && statistics.price?.average
      ? `$${Math.round((statistics.price.average + statistics.price.range.max) / 2).toLocaleString()}`
      : priceMax;
    
    const medianDOM = statistics.daysOnMarket?.median 
      ? Math.round(statistics.daysOnMarket.median)
      : null;
    const domInsight = medianDOM 
      ? (medianDOM < 14 
          ? `Properties priced right are going under contract in under ${medianDOM} days`
          : `Typical time to contract is around ${medianDOM} days`)
      : 'Market activity is steady';
    
    const pricePerSqFtInsight = avgPricePerSqFt !== 'N/A'
      ? `Comparable homes are averaging ${avgPricePerSqFt}/sq ft`
      : '';

    const email = `Subject: Market Analysis for ${subjectAddress}

---

Hi there,

I put together a market analysis for your home based on recent activity in ${subdivision}. Here's what the data is showing:

**Comparable Sales Summary**
- Properties Analyzed: ${compCount} homes in ${subdivision} (${timeframe})
- Price Range: ${priceMin} – ${priceMax}
- Average Price/Sq Ft: ${avgPricePerSqFt}
- Average Days on Market: ${avgDOM} days

Based on your home's size (${subjectSqFt} sq ft) and features, the data suggests a competitive list price in the ${lowEstimate} – ${highEstimate} range.

A few things worth noting:
- ${pricePerSqFtInsight || 'Market conditions support pricing in this range'}
- ${domInsight}
- Well-priced homes are attracting strong buyer interest

I'd love to walk you through the full analysis and talk through your timing and goals. Want to grab 15 minutes this week?

Best regards`;

    return email;
  };

  const handleCopyClientEmail = async () => {
    const emailContent = generateClientEmail();
    if (!emailContent) {
      toast({
        title: "Unable to generate email",
        description: "CMA data is not available.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      await navigator.clipboard.writeText(emailContent);
      toast({
        title: "Email copied",
        description: "Paste into Follow Up Boss to send to your client.",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Unable to copy to clipboard.",
        variant: "destructive",
      });
    }
  };

  const isLoading = cmaLoading || statsLoading || timelineLoading;

  const getShareUrl = () => {
    if (!cma?.publicLink) return '';
    const baseUrl = window.location.origin;
    return `${baseUrl}/share/cma/${cma.publicLink}`;
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(getShareUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Link copied",
      description: "Share link copied to clipboard.",
    });
  };

  const mockStatistics: PropertyStatistics = {
    price: {
      range: { min: 371000, max: 710000 },
      average: 508577,
      median: 519500,
    },
    pricePerSqFt: {
      range: { min: 268.23, max: 503.06 },
      average: 406.53,
      median: 406.7,
    },
    daysOnMarket: {
      range: { min: 2, max: 139 },
      average: 37,
      median: 25,
    },
    livingArea: {
      range: { min: 1045, max: 1474 },
      average: 1263,
      median: 1296,
    },
    lotSize: {
      range: { min: 3816, max: 11609 },
      average: 8923,
      median: 8494,
    },
    acres: {
      range: { min: 0.09, max: 0.27 },
      average: 0.2,
      median: 0.2,
    },
    bedrooms: {
      range: { min: 3, max: 4 },
      average: 3,
      median: 3,
    },
    bathrooms: {
      range: { min: 1, max: 2 },
      average: 2,
      median: 2,
    },
    yearBuilt: {
      range: { min: 1953, max: 2018 },
      average: 1964,
      median: 1959,
    },
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!cma) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-2">CMA not found</h2>
        <Link href="/cmas">
          <Button variant="outline">Back to CMAs</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 cma-print">
      <div className="flex items-center justify-between flex-wrap gap-4 print:hidden">
        <div>
          <Link href="/cmas">
            <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back-to-cmas">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to CMAs
            </Button>
          </Link>
          <h1 className="text-3xl font-bold" data-testid="text-cma-title">{cma.name}</h1>
          {cma.publicLink && (
            <Badge variant="secondary" className="mt-2">
              <LinkIcon className="w-3 h-3 mr-1" />
              Shared
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={handleCopyClientEmail}
            data-testid="button-copy-email"
          >
            <Mail className="w-4 h-4 mr-2" />
            Copy Email
          </Button>
          <Button 
            variant="outline" 
            onClick={async () => {
              try {
                let shareUrl: string;
                if (cma?.publicLink) {
                  shareUrl = `${window.location.origin}/share/cma/${cma.publicLink}`;
                } else {
                  const result = await shareMutation.mutateAsync();
                  shareUrl = `${window.location.origin}/share/cma/${result.shareToken}`;
                }
                await navigator.clipboard.writeText(shareUrl);
                toast({
                  title: "URL copied to clipboard",
                  description: shareUrl,
                });
              } catch (error) {
                toast({
                  title: "Error",
                  description: "Failed to generate or copy share URL",
                  variant: "destructive",
                });
              }
            }}
            disabled={shareMutation.isPending}
            data-testid="button-produce-url"
          >
            {shareMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <LinkIcon className="w-4 h-4 mr-2" />
            )}
            Produce URL
          </Button>
          <Button variant="outline" onClick={handlePrint} data-testid="button-print-header">
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
          <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-share-cma">
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Share CMA</DialogTitle>
              <DialogDescription>
                Generate a public link to share this CMA with clients.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              {cma.publicLink ? (
                <>
                  <div className="space-y-2">
                    <Label>Share Link</Label>
                    <div className="flex gap-2">
                      <Input 
                        value={getShareUrl()} 
                        readOnly 
                        data-testid="input-share-link"
                      />
                      <Button 
                        size="icon" 
                        variant="outline"
                        onClick={handleCopyLink}
                        data-testid="button-copy-link"
                      >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  
                  {/* Social Media Sharing */}
                  <div className="space-y-2 pt-4 border-t">
                    <Label>Share on Social Media</Label>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const url = encodeURIComponent(getShareUrl());
                          const text = encodeURIComponent(`Check out this CMA report: ${cma.name}`);
                          window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank', 'width=600,height=400');
                        }}
                        data-testid="button-share-facebook"
                      >
                        <SiFacebook className="w-4 h-4 mr-2" />
                        Facebook
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const url = encodeURIComponent(getShareUrl());
                          const text = encodeURIComponent(`Check out this CMA report: ${cma.name}`);
                          window.open(`https://twitter.com/intent/tweet?url=${url}&text=${text}`, '_blank', 'width=600,height=400');
                        }}
                        data-testid="button-share-x"
                      >
                        <SiX className="w-4 h-4 mr-2" />
                        X
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Copy link silently, then open Instagram
                          navigator.clipboard.writeText(getShareUrl());
                          // Open Instagram web - users can share via story/post
                          window.open('https://www.instagram.com/', '_blank');
                        }}
                        data-testid="button-share-instagram"
                      >
                        <SiInstagram className="w-4 h-4 mr-2" />
                        Instagram
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Copy link silently, then open TikTok
                          navigator.clipboard.writeText(getShareUrl());
                          // Open TikTok web - users can share via post/bio
                          window.open('https://www.tiktok.com/', '_blank');
                        }}
                        data-testid="button-share-tiktok"
                      >
                        <SiTiktok className="w-4 h-4 mr-2" />
                        TikTok
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex justify-between pt-4">
                    <Button
                      variant="destructive"
                      onClick={() => unshareMutation.mutate()}
                      disabled={unshareMutation.isPending}
                      data-testid="button-remove-share"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Remove Link
                    </Button>
                    <Button onClick={() => setShareDialogOpen(false)}>
                      Done
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted-foreground mb-4">
                    Generate a shareable link for this CMA. Links are permanent and can be manually revoked.
                  </p>
                  <Button 
                    onClick={() => shareMutation.mutate()}
                    disabled={shareMutation.isPending}
                    data-testid="button-generate-link"
                  >
                    <LinkIcon className="w-4 h-4 mr-2" />
                    {shareMutation.isPending ? 'Generating...' : 'Generate Share Link'}
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <CMAReport
        properties={properties}
        statistics={statistics || mockStatistics}
        timelineData={timelineData}
        isPreview={true}
        expiresAt={cma.expiresAt ? new Date(cma.expiresAt) : new Date(Date.now() + 30 * 60 * 1000)}
        visibleMetrics={visibleMetrics}
        notes={cma.notes}
        reportTitle={cma.name}
        subjectPropertyId={cma.subjectPropertyId}
        onSave={handleSave}
        onShareCMA={() => setEmailShareDialogOpen(true)}
        onPublicLink={async () => {
          try {
            let shareUrl: string;
            if (cma?.publicLink) {
              shareUrl = `${window.location.origin}/share/cma/${cma.publicLink}`;
            } else {
              const result = await shareMutation.mutateAsync();
              shareUrl = `${window.location.origin}/share/cma/${result.shareToken}`;
            }
            await navigator.clipboard.writeText(shareUrl);
            toast({
              title: "URL copied to clipboard",
              description: shareUrl,
            });
          } catch (error) {
            toast({
              title: "Error",
              description: "Failed to generate or copy share URL",
              variant: "destructive",
            });
          }
        }}
        onModifySearch={handleModifySearch}
        onModifyStats={handleModifyStats}
        onAddNotes={handleOpenNotesDialog}
        onPrint={handlePrint}
      />

      {/* Notes Dialog */}
      <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agent Notes</DialogTitle>
            <DialogDescription>
              Add commentary or notes about this CMA for your client.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <Label htmlFor="notes">Your Notes</Label>
            <Textarea
              id="notes"
              placeholder="Enter your notes or commentary about this CMA..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={6}
              className="mt-2"
              data-testid="textarea-notes"
            />
            <p className="text-xs text-muted-foreground">
              These notes will appear on the shared CMA report and PDF.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotesDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveNotes}
              disabled={updateNotesMutation.isPending}
              data-testid="button-save-notes"
            >
              {updateNotesMutation.isPending ? 'Saving...' : 'Save Notes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stats Visibility Dialog */}
      <Dialog open={statsDialogOpen} onOpenChange={setStatsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Customize Statistics</DialogTitle>
            <DialogDescription>
              Choose which metrics to show in the Home Averages tab.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            {STAT_METRICS.map((metric) => (
              <div key={metric.key} className="flex items-center space-x-3">
                <Checkbox
                  id={`metric-${metric.key}`}
                  checked={visibleMetrics.includes(metric.key)}
                  onCheckedChange={() => toggleMetric(metric.key)}
                  data-testid={`checkbox-metric-${metric.key}`}
                />
                <Label htmlFor={`metric-${metric.key}`} className="cursor-pointer">
                  {metric.label}
                </Label>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setVisibleMetrics(STAT_METRICS.map(m => m.key))}
              data-testid="button-reset-stats"
            >
              Show All
            </Button>
            <Button 
              onClick={() => setStatsDialogOpen(false)}
              data-testid="button-apply-stats"
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Share CMA Dialog */}
      <Dialog open={emailShareDialogOpen} onOpenChange={setEmailShareDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Email CMA to a Friend</DialogTitle>
            <DialogDescription>
              Share this CMA report with your client via email.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="your-name">Your Name *</Label>
                <Input
                  id="your-name"
                  placeholder="Your Name"
                  value={emailForm.yourName}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, yourName: e.target.value }))}
                  data-testid="input-your-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="friend-name">Friend's Name *</Label>
                <Input
                  id="friend-name"
                  placeholder="Friend's Name"
                  value={emailForm.friendName}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, friendName: e.target.value }))}
                  data-testid="input-friend-name"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="your-email">Your Email Address *</Label>
                <Input
                  id="your-email"
                  type="email"
                  placeholder="name@website.com"
                  value={emailForm.yourEmail}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, yourEmail: e.target.value }))}
                  data-testid="input-your-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="friend-email">Friend's Email Address *</Label>
                <Input
                  id="friend-email"
                  type="email"
                  placeholder="name@website.com"
                  value={emailForm.friendEmail}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, friendEmail: e.target.value }))}
                  data-testid="input-friend-email"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="comments">Comments</Label>
              <Textarea
                id="comments"
                placeholder="Add a personal message..."
                value={emailForm.comments}
                onChange={(e) => setEmailForm(prev => ({ ...prev, comments: e.target.value }))}
                rows={3}
                data-testid="textarea-email-comments"
              />
            </div>
            {emailFallbackUrl && (
              <div className="p-3 bg-muted rounded-md space-y-2">
                <p className="text-sm text-muted-foreground">
                  Email service not configured. Share this link manually:
                </p>
                <div className="flex items-center gap-2">
                  <Input 
                    value={emailFallbackUrl} 
                    readOnly 
                    className="text-xs"
                    data-testid="input-fallback-share-url"
                  />
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(emailFallbackUrl);
                      toast({ title: "Copied!", description: "Link copied to clipboard." });
                    }}
                    data-testid="button-copy-fallback-url"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailShareDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleEmailShare}
              disabled={emailShareMutation.isPending}
              data-testid="button-send-email-share"
            >
              {emailShareMutation.isPending ? 'Sending...' : 'Share'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


