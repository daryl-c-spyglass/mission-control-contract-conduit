# CMA Action Buttons & Preview Banner Reference
Extracted from Client Data Portal for replication

## 1. Component Structure

### Top Action Buttons Bar
Location: `client/src/pages/CMADetailPage.tsx`
```tsx
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
  <Button 
    variant="outline" 
    onClick={() => setLocation(`/cmas/${id}/presentation`)}
    data-testid="button-presentation-builder"
  >
    <LayoutGrid className="w-4 h-4 mr-2" />
    Presentation
  </Button>
  <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
    <DialogTrigger asChild>
      <Button variant="outline" data-testid="button-share-cma">
        <Share2 className="w-4 h-4 mr-2" />
        Share
      </Button>
    </DialogTrigger>
    {/* Dialog content... */}
  </Dialog>
</div>
```

### Preview Banner
Location: `client/src/components/CMAReport.tsx`
```tsx
{/* Preview Banner - hidden in print/PDF */}
{isPreview && expiresAt && (
  <div className="bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-400 dark:border-yellow-600 rounded-md p-4 flex items-center justify-between gap-4 flex-wrap print:hidden cma-preview-banner" data-testid="cma-preview-banner">
    <p className="text-sm">
      You are seeing a preview of the report.
    </p>
    <div className="flex items-center gap-2 flex-wrap">
      <Button size="sm" onClick={onSave} data-testid="button-save-cma">
        <Save className="w-4 h-4 mr-2" />
        Save
      </Button>
      <Button size="sm" variant="outline" onClick={onPublicLink} data-testid="button-copy-live-url">
        <ExternalLink className="w-4 h-4 mr-2" />
        Copy Live URL
      </Button>
      <Button size="sm" variant="outline" onClick={onShareCMA} data-testid="button-share-cma-email">
        <Mail className="w-4 h-4 mr-2" />
        Share CMA
      </Button>
      <Button size="sm" variant="outline" onClick={onModifySearch} data-testid="button-modify-search">
        <Edit className="w-4 h-4 mr-2" />
        Modify Search
      </Button>
      {activeTab === "home-averages" && (
        <Button size="sm" variant="outline" onClick={onModifyStats} data-testid="button-modify-stats">
          <FileText className="w-4 h-4 mr-2" />
          Modify Stats
        </Button>
      )}
      <Button size="sm" variant="outline" onClick={onAddNotes} data-testid="button-notes">
        <FileText className="w-4 h-4 mr-2" />
        Notes
      </Button>
    </div>
  </div>
)}
```

## 2. Button Functionality

### Copy Email Button
- Purpose: Generates a formatted client-ready email summarizing CMA statistics and copies to clipboard
- Location: `client/src/pages/CMADetailPage.tsx` (lines 294-405)
- Implementation:
```tsx
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
  
  // ... statistics extraction for price ranges, price/sqft, DOM, etc.
  
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
```

### Produce URL Button
- Purpose: Generates a public share link for the CMA and copies it to clipboard
- Implementation:
```tsx
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
});

// Button onClick handler:
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
```

### Print Button
- Purpose: Triggers browser print dialog for the CMA report
- Implementation:
```tsx
const handlePrint = () => {
  window.print();
};
```

### Presentation Button
- Purpose: Navigates to the CMA Presentation Builder page
- Navigation: `/cmas/${id}/presentation`
- Implementation:
```tsx
<Button 
  variant="outline" 
  onClick={() => setLocation(`/cmas/${id}/presentation`)}
  data-testid="button-presentation-builder"
>
  <LayoutGrid className="w-4 h-4 mr-2" />
  Presentation
</Button>
```

### Share Button
- Purpose: Opens share dialog with link management and social sharing options
- Opens: `shareDialogOpen` dialog state
- Implementation:
```tsx
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
    {/* ... dialog content with link copy, social sharing, remove link buttons */}
  </DialogContent>
</Dialog>
```

## 3. Preview Banner Buttons

### Save Button
- Purpose: Confirms CMA is saved (CMAs are auto-saved)
- API: N/A (CMAs already persisted)
- Implementation:
```tsx
const handleSave = () => {
  toast({
    title: "CMA Saved",
    description: "Your CMA has been saved successfully.",
  });
};

<Button size="sm" onClick={onSave} data-testid="button-save-cma">
  <Save className="w-4 h-4 mr-2" />
  Save
</Button>
```

### Copy Live URL Button
- Purpose: Generates and copies public share URL to clipboard
- Implementation: Same as `onPublicLink` prop passed from CMADetailPage
```tsx
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
```

### Share CMA Button
- Purpose: Opens email share dialog
- Implementation:
```tsx
onShareCMA={() => setEmailShareDialogOpen(true)}

<Button size="sm" variant="outline" onClick={onShareCMA} data-testid="button-share-cma-email">
  <Mail className="w-4 h-4 mr-2" />
  Share CMA
</Button>
```

### Modify Search Button
- Purpose: Navigate back to CMA builder with current data pre-loaded
- Navigation: `/cmas/new?from=${id}`
- Implementation:
```tsx
const handleModifySearch = () => {
  setLocation(`/cmas/new?from=${id}`);
};

<Button size="sm" variant="outline" onClick={onModifySearch} data-testid="button-modify-search">
  <Edit className="w-4 h-4 mr-2" />
  Modify Search
</Button>
```

### Notes Button
- Purpose: Opens notes dialog to add/edit agent commentary
- Implementation:
```tsx
const handleOpenNotesDialog = () => {
  setNotes(cma?.notes || "");
  setNotesDialogOpen(true);
};

<Button size="sm" variant="outline" onClick={onAddNotes} data-testid="button-notes">
  <FileText className="w-4 h-4 mr-2" />
  Notes
</Button>
```

## 4. API Endpoints

### POST /api/cmas/:id/share
Location: `server/routes.ts` (lines 2396-2428)
- Request: Empty body
- Response: `{ shareToken: string, shareUrl: string }`
```typescript
app.post("/api/cmas/:id/share", async (req, res) => {
  try {
    const cma = await storage.getCma(req.params.id);
    if (!cma) {
      res.status(404).json({ error: "CMA not found" });
      return;
    }

    // Ownership check
    const user = req.user as any;
    if (cma.userId && cma.userId !== user?.id) {
      res.status(403).json({ error: "Not authorized to share this CMA" });
      return;
    }

    // Generate new permanent share token
    const shareToken = crypto.randomUUID();

    await storage.updateCma(req.params.id, {
      publicLink: shareToken,
      expiresAt: null, // No expiration - links are permanent
    });

    res.json({
      shareToken,
      shareUrl: `/share/cma/${shareToken}`,
    });
  } catch (error) {
    console.error("Error generating share link:", error);
    res.status(500).json({ error: "Failed to generate share link" });
  }
});
```

### DELETE /api/cmas/:id/share
Location: `server/routes.ts` (lines 2430-2454)
- Request: Empty body
- Response: `{ message: "Share link removed" }`
```typescript
app.delete("/api/cmas/:id/share", async (req, res) => {
  try {
    const cma = await storage.getCma(req.params.id);
    if (!cma) {
      res.status(404).json({ error: "CMA not found" });
      return;
    }

    // Ownership check
    const user = req.user as any;
    if (cma.userId && cma.userId !== user?.id) {
      res.status(403).json({ error: "Not authorized to manage this CMA" });
      return;
    }

    await storage.updateCma(req.params.id, {
      publicLink: null,
      expiresAt: null,
    });

    res.json({ message: "Share link removed" });
  } catch (error) {
    res.status(500).json({ error: "Failed to remove share link" });
  }
});
```

### POST /api/cmas/:id/email-share
Location: `server/routes.ts` (lines 2457-2570)
- Request:
```typescript
{
  senderName: string,
  senderEmail: string,
  recipientName: string,
  recipientEmail: string,
  message?: string
}
```
- Response:
```typescript
{ 
  success: true, 
  message: string, 
  emailSent: boolean, 
  shareUrl: string 
}
```
```typescript
app.post("/api/cmas/:id/email-share", async (req, res) => {
  try {
    const cma = await storage.getCma(req.params.id);
    if (!cma) {
      res.status(404).json({ error: "CMA not found" });
      return;
    }

    const { senderName, senderEmail, recipientName, recipientEmail, message } = req.body;

    if (!senderName || !senderEmail || !recipientName || !recipientEmail) {
      res.status(400).json({ error: "All fields are required" });
      return;
    }

    if (!cma.publicLink) {
      res.status(400).json({ error: "CMA must have a public link to share" });
      return;
    }

    const shareUrl = `${req.protocol}://${req.get('host')}/share/cma/${cma.publicLink}`;

    // Generate HTML email with Spyglass branding
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #F37216;">CMA Report Shared with You</h2>
        <p>Hi ${recipientName},</p>
        <p>${senderName} has shared a Comparative Market Analysis with you.</p>
        ${message ? `<p style="background-color: #f5f5f5; padding: 15px;">${message}</p>` : ''}
        <a href="${shareUrl}" style="background-color: #F37216; color: white; padding: 12px 24px;">View Full CMA Report</a>
      </div>
    `;

    // Send via SendGrid if configured
    const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
    if (SENDGRID_API_KEY) {
      // ... SendGrid API call
      res.json({ success: true, message: "Email sent successfully", emailSent: true, shareUrl });
    } else {
      res.json({ 
        success: true, 
        message: "Email service not configured. Copy the link below to share manually.", 
        emailSent: false, 
        shareUrl 
      });
    }
  } catch (error) {
    console.error("Error sharing CMA via email:", error);
    res.status(500).json({ error: "Failed to share CMA" });
  }
});
```

### PATCH /api/cmas/:id (for notes)
Location: `server/routes.ts` (lines 2369-2380)
- Request: `{ notes: string }` (or any partial CMA update)
- Response: Updated CMA object
```typescript
app.patch("/api/cmas/:id", async (req, res) => {
  try {
    const cma = await storage.updateCma(req.params.id, req.body);
    if (!cma) {
      res.status(404).json({ error: "CMA not found" });
      return;
    }
    res.json(cma);
  } catch (error) {
    res.status(500).json({ error: "Failed to update CMA" });
  }
});
```

### GET /api/share/cma/:token (Public access)
Location: `server/routes.ts` (lines 2573-2650+)
- Purpose: Retrieve CMA data for public shared view
- Response: `{ cma, properties, statistics, timelineData }`

## 5. Share Dialog Component

Location: `client/src/pages/CMADetailPage.tsx` (lines 567-696)
```tsx
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
              <Input value={getShareUrl()} readOnly data-testid="input-share-link" />
              <Button size="icon" variant="outline" onClick={handleCopyLink} data-testid="button-copy-link">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>
          
          {/* Social Media Sharing */}
          <div className="space-y-2 pt-4 border-t">
            <Label>Share on Social Media</Label>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => {
                const url = encodeURIComponent(getShareUrl());
                window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
              }} data-testid="button-share-facebook">
                <SiFacebook className="w-4 h-4 mr-2" /> Facebook
              </Button>
              <Button variant="outline" size="sm" onClick={() => {
                const url = encodeURIComponent(getShareUrl());
                const text = encodeURIComponent(`Check out this CMA report: ${cma.name}`);
                window.open(`https://twitter.com/intent/tweet?url=${url}&text=${text}`, '_blank');
              }} data-testid="button-share-x">
                <SiX className="w-4 h-4 mr-2" /> X
              </Button>
              <Button variant="outline" size="sm" onClick={() => {
                navigator.clipboard.writeText(getShareUrl());
                window.open('https://www.instagram.com/', '_blank');
              }} data-testid="button-share-instagram">
                <SiInstagram className="w-4 h-4 mr-2" /> Instagram
              </Button>
              <Button variant="outline" size="sm" onClick={() => {
                navigator.clipboard.writeText(getShareUrl());
                window.open('https://www.tiktok.com/', '_blank');
              }} data-testid="button-share-tiktok">
                <SiTiktok className="w-4 h-4 mr-2" /> TikTok
              </Button>
            </div>
          </div>
          
          <div className="flex justify-between pt-4">
            <Button variant="destructive" onClick={() => unshareMutation.mutate()} disabled={unshareMutation.isPending} data-testid="button-remove-share">
              <Trash2 className="w-4 h-4 mr-2" /> Remove Link
            </Button>
            <Button onClick={() => setShareDialogOpen(false)}>Done</Button>
          </div>
        </>
      ) : (
        <div className="text-center py-4">
          <p className="text-muted-foreground mb-4">
            Generate a shareable link for this CMA. Links are permanent and can be manually revoked.
          </p>
          <Button onClick={() => shareMutation.mutate()} disabled={shareMutation.isPending} data-testid="button-generate-link">
            <LinkIcon className="w-4 h-4 mr-2" />
            {shareMutation.isPending ? 'Generating...' : 'Generate Share Link'}
          </Button>
        </div>
      )}
    </div>
  </DialogContent>
</Dialog>
```

## 6. Email Share Component

Location: `client/src/pages/CMADetailPage.tsx` (lines 821-928)
```tsx
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
            <Input value={emailFallbackUrl} readOnly className="text-xs" data-testid="input-fallback-share-url" />
            <Button size="sm" variant="outline" onClick={() => {
              navigator.clipboard.writeText(emailFallbackUrl);
              toast({ title: "Copied!", description: "Link copied to clipboard." });
            }} data-testid="button-copy-fallback-url">
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setEmailShareDialogOpen(false)}>Cancel</Button>
      <Button onClick={handleEmailShare} disabled={emailShareMutation.isPending} data-testid="button-send-email-share">
        {emailShareMutation.isPending ? 'Sending...' : 'Share'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

## 7. Notes Modal/Panel Component

Location: `client/src/pages/CMADetailPage.tsx` (lines 740-777)
```tsx
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
      <Button variant="outline" onClick={() => setNotesDialogOpen(false)}>Cancel</Button>
      <Button onClick={handleSaveNotes} disabled={updateNotesMutation.isPending} data-testid="button-save-notes">
        {updateNotesMutation.isPending ? 'Saving...' : 'Save Notes'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

Notes Update Mutation:
```tsx
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
    toast({ title: "Notes saved", description: "Your notes have been updated." });
  },
});
```

## 8. Styling

### Action Buttons Bar
```css
/* From CMADetailPage.tsx */
.flex.items-center.justify-between.flex-wrap.gap-4.print\\:hidden {
  /* Responsive flex layout with print hiding */
}

/* Button styling via shadcn/ui Button component */
/* variant="outline" provides bordered, transparent background buttons */
```

### Preview Banner
```css
/* From CMAReport.tsx */
.bg-yellow-100.dark\\:bg-yellow-900\\/20 {
  /* Light mode: light yellow background */
  /* Dark mode: dark yellow with 20% opacity */
}

.border.border-yellow-400.dark\\:border-yellow-600 {
  /* Yellow border with dark mode variant */
}

.rounded-md.p-4 {
  /* Medium border radius, 1rem padding */
}

.flex.items-center.justify-between.gap-4.flex-wrap {
  /* Responsive flex layout */
}

.print\\:hidden {
  /* Hidden when printing */
}

.cma-preview-banner {
  /* Custom class for targeting */
}
```

## 9. Dependencies Used

### Clipboard
- Native `navigator.clipboard.writeText()` API

### Icons
- `lucide-react`: ArrowLeft, Share2, Link as LinkIcon, Copy, Check, Trash2, ExternalLink, Printer, Loader2, Mail, LayoutGrid, Save, Edit, FileText
- `react-icons/si`: SiFacebook, SiX, SiInstagram, SiTiktok

### UI Components
- `@/components/ui/button`: Button
- `@/components/ui/dialog`: Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
- `@/components/ui/input`: Input
- `@/components/ui/textarea`: Textarea
- `@/components/ui/label`: Label
- `@/components/ui/badge`: Badge
- `@/components/ui/skeleton`: Skeleton

### Email Service
- SendGrid API (optional, with fallback to manual link copy)
- Environment variables: `SENDGRID_API_KEY`, `FROM_EMAIL`, `FROM_NAME`

### Routing
- `wouter`: useRoute, useLocation, Link

### Data Fetching
- `@tanstack/react-query`: useQuery, useMutation

## 10. State Management

### Share Status Tracking
```tsx
// CMA publicLink field stores the share token
const cma = useQuery<Cma>({ queryKey: ['/api/cmas', id] });
const hasPublicLink = !!cma?.publicLink;
const shareUrl = hasPublicLink ? `${window.location.origin}/share/cma/${cma.publicLink}` : '';
```

### Notes Storage/Updates
```tsx
// Local state synced with CMA notes field
const [notes, setNotes] = useState("");
const [notesDialogOpen, setNotesDialogOpen] = useState(false);

// Sync on dialog open
const handleOpenNotesDialog = () => {
  setNotes(cma?.notes || "");
  setNotesDialogOpen(true);
};

// PATCH /api/cmas/:id with { notes: string }
const updateNotesMutation = useMutation({
  mutationFn: async (newNotes: string) => {
    const response = await fetch(`/api/cmas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: newNotes }),
    });
    return response.json();
  },
});
```

### Preview Mode Determination
```tsx
// Passed as prop from CMADetailPage to CMAReport
<CMAReport
  isPreview={true}  // In CMADetailPage (agent view)
  expiresAt={cma.expiresAt ? new Date(cma.expiresAt) : new Date(Date.now() + 30 * 60 * 1000)}
/>

// In SharedCMAView (public view)
<CMAReport
  isPreview={false}  // No preview banner shown
/>
```

### Dialog State
```tsx
const [shareDialogOpen, setShareDialogOpen] = useState(false);
const [emailShareDialogOpen, setEmailShareDialogOpen] = useState(false);
const [notesDialogOpen, setNotesDialogOpen] = useState(false);
const [copied, setCopied] = useState(false); // For copy feedback

// Email form state
const [emailForm, setEmailForm] = useState({
  yourName: '',
  yourEmail: '',
  friendName: '',
  friendEmail: '',
  comments: 'Check out this CMA report I created for you.',
});

// Fallback URL when email service not configured
const [emailFallbackUrl, setEmailFallbackUrl] = useState<string | null>(null);
```
