import { useState } from 'react';
import { useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import {
  Phone, Mail, Calendar, Share2, MapPin,
  Bed, Bath, Maximize, ChevronLeft, ChevronRight,
  Facebook, Linkedin, MessageCircle, Link2, Check, Home, User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { Flyer } from '@shared/schema';

const XIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

export default function PublicFlyerPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [photoIndex, setPhotoIndex] = useState(0);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showFullDesc, setShowFullDesc] = useState(false);

  const { data: flyer, isLoading, error } = useQuery<Flyer>({
    queryKey: ['/api/public/flyer', id],
    enabled: !!id,
  });

  const photos = flyer ? [
    flyer.mainPhoto,
    flyer.kitchenPhoto,
    flyer.roomPhoto,
    ...(flyer.additionalPhotos || [])
  ].filter(Boolean) as string[] : [];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="w-10 h-10 border-4 border-[#8B7355] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !flyer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <Card className="p-8 text-center max-w-sm">
          <Home className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-2">Flyer Not Found</h1>
          <p className="text-muted-foreground">This flyer may have been removed or is no longer available.</p>
        </Card>
      </div>
    );
  }

  const price = flyer.listPrice 
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(parseFloat(flyer.listPrice))
    : '$0';

  const fullAddress = `${flyer.propertyAddress}, ${flyer.propertyCity || ''}, ${flyer.propertyState || ''} ${flyer.propertyZip || ''}`.trim();
  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

  const handleCall = () => {
    if (flyer.agentPhone) {
      window.location.href = `tel:${flyer.agentPhone.replace(/[^0-9+]/g, '')}`;
    }
  };

  const handleEmail = () => {
    if (flyer.agentEmail) {
      const subject = encodeURIComponent(`Inquiry about ${flyer.propertyAddress}`);
      const body = encodeURIComponent(
`Hi ${flyer.agentName},

I'm interested in the property at:
${flyer.propertyAddress}
${flyer.propertyCity || ''}, ${flyer.propertyState || ''} ${flyer.propertyZip || ''}
Listed at ${price}

Please contact me at your earliest convenience.

Thank you!`
      );
      window.location.href = `mailto:${flyer.agentEmail}?subject=${subject}&body=${body}`;
    }
  };

  const handleScheduleShowing = () => {
    if (flyer.agentEmail) {
      const subject = encodeURIComponent(`Showing Request: ${flyer.propertyAddress}`);
      const body = encodeURIComponent(
`Hi ${flyer.agentName},

I would like to schedule a showing for:

Property: ${flyer.propertyAddress}
   ${flyer.propertyCity || ''}, ${flyer.propertyState || ''} ${flyer.propertyZip || ''}
Price: ${price}
${flyer.bedrooms || 0} beds | ${flyer.bathrooms || 0} baths | ${flyer.squareFeet?.toLocaleString() || 0} sq ft

My preferred showing times:
- Option 1: [DATE/TIME]
- Option 2: [DATE/TIME]
- Option 3: [DATE/TIME]

My contact information:
- Name: [YOUR NAME]
- Phone: [YOUR PHONE]
- Email: [YOUR EMAIL]

I look forward to hearing from you!

Best regards`
      );
      window.location.href = `mailto:${flyer.agentEmail}?subject=${subject}&body=${body}`;
    }
  };

  const shareText = `Check out this property: ${flyer.propertyAddress} - ${price}`;
  const encodedUrl = encodeURIComponent(currentUrl);
  const encodedText = encodeURIComponent(shareText);

  const shareToFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, '_blank', 'width=600,height=400');
  };

  const shareToTwitter = () => {
    window.open(`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`, '_blank', 'width=600,height=400');
  };

  const shareToLinkedIn = () => {
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`, '_blank', 'width=600,height=400');
  };

  const shareToWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodedText}%20${encodedUrl}`, '_blank');
  };

  const shareViaSMS = () => {
    window.location.href = `sms:?body=${encodedText}%20${encodedUrl}`;
  };

  const shareViaEmail = () => {
    const subject = encodeURIComponent(`Property: ${flyer.propertyAddress}`);
    const body = encodeURIComponent(`${shareText}\n\nView details: ${currentUrl}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(currentUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const nextPhoto = () => setPhotoIndex(i => (i + 1) % photos.length);
  const prevPhoto = () => setPhotoIndex(i => (i - 1 + photos.length) % photos.length);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between gap-2">
          {flyer.companyLogo ? (
            <img src={flyer.companyLogo} alt="Logo" className="h-8 object-contain" />
          ) : (
            <span className="font-bold text-foreground">Spyglass Realty</span>
          )}
          <div className="text-right">
            <div className="text-xs text-muted-foreground uppercase">Offered At</div>
            <div className="text-lg font-bold text-[#8B7355]">{price}</div>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto pb-8">
        <div className="bg-white dark:bg-gray-800 px-4 py-3 border-b">
          <h1 className="text-xl font-bold text-foreground" data-testid="text-property-address">{flyer.propertyAddress}</h1>
          <p className="text-muted-foreground">{flyer.propertyCity}, {flyer.propertyState} {flyer.propertyZip}</p>
        </div>

        <div className="relative bg-black">
          <div className="aspect-[4/3]">
            {photos.length > 0 ? (
              <img src={photos[photoIndex]} alt="Property" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <Home className="w-16 h-16" />
              </div>
            )}
          </div>
          
          {photos.length > 1 && (
            <>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={prevPhoto} 
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full" 
                data-testid="button-prev-photo"
              >
                <ChevronLeft className="w-6 h-6" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={nextPhoto} 
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full" 
                data-testid="button-next-photo"
              >
                <ChevronRight className="w-6 h-6" />
              </Button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5" aria-hidden="true">
                {photos.map((_, i) => (
                  <span 
                    key={i} 
                    className={`w-2 h-2 rounded-full ${i === photoIndex ? 'bg-white' : 'bg-white/50'}`}
                    data-testid={`indicator-photo-dot-${i}`}
                  />
                ))}
              </div>
            </>
          )}
          
          {photos.length > 0 && (
            <div className="absolute bottom-3 right-3 bg-black/60 text-white text-sm px-2 py-1 rounded">
              {photoIndex + 1}/{photos.length}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 px-4 py-4 border-b grid grid-cols-3 gap-2">
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <Bed className="w-5 h-5 mx-auto text-[#8B7355] mb-1" />
            <div className="font-bold text-foreground" data-testid="text-bedrooms">{flyer.bedrooms || 0}</div>
            <div className="text-xs text-muted-foreground">Beds</div>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <Bath className="w-5 h-5 mx-auto text-[#8B7355] mb-1" />
            <div className="font-bold text-foreground" data-testid="text-bathrooms">{flyer.bathrooms || 0}</div>
            <div className="text-xs text-muted-foreground">Baths</div>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <Maximize className="w-5 h-5 mx-auto text-[#8B7355] mb-1" />
            <div className="font-bold text-foreground" data-testid="text-sqft">{flyer.squareFeet?.toLocaleString() || 0}</div>
            <div className="text-xs text-muted-foreground">Sq Ft</div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 px-4 py-4 border-b">
          {flyer.headline && <h2 className="font-bold text-lg mb-2 text-foreground" data-testid="text-headline">{flyer.headline}</h2>}
          <p className="text-muted-foreground leading-relaxed" data-testid="text-description">
            {showFullDesc || !flyer.description || flyer.description.length <= 200
              ? flyer.description
              : `${flyer.description.slice(0, 200)}...`}
          </p>
          {flyer.description && flyer.description.length > 200 && (
            <div className="mt-2">
              <Button 
                variant="link" 
                size="sm"
                onClick={() => setShowFullDesc(!showFullDesc)} 
                className="text-[#8B7355]" 
                data-testid="button-read-more"
              >
                {showFullDesc ? 'Show Less' : 'Read More'}
              </Button>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 px-4 py-6 border-b">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden flex-shrink-0">
              {flyer.agentPhoto ? (
                <img src={flyer.agentPhoto} alt={flyer.agentName || 'Agent'} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
            </div>
            <div>
              <h3 className="font-bold text-lg text-foreground" data-testid="text-agent-name">{flyer.agentName || 'Agent'}</h3>
              <p className="text-muted-foreground">{flyer.agentTitle || 'Real Estate Agent'}</p>
              <p className="text-muted-foreground text-sm">Spyglass Realty</p>
            </div>
          </div>

          <div className="space-y-3">
            <Button 
              onClick={handleCall} 
              disabled={!flyer.agentPhone}
              className="w-full bg-[#8B7355] border-[#8B7355] text-white"
              data-testid="button-call-agent"
            >
              <Phone className="w-5 h-5 mr-2" />
              Call {flyer.agentName?.split(' ')[0] || 'Agent'}
            </Button>
            
            <Button 
              variant="secondary"
              onClick={handleEmail} 
              disabled={!flyer.agentEmail}
              className="w-full"
              data-testid="button-email-agent"
            >
              <Mail className="w-5 h-5 mr-2" />
              Send Email
            </Button>
            
            <Button 
              onClick={handleScheduleShowing} 
              disabled={!flyer.agentEmail}
              className="w-full bg-green-600 border-green-600 text-white"
              data-testid="button-schedule-showing"
            >
              <Calendar className="w-5 h-5 mr-2" />
              Schedule a Showing
            </Button>
          </div>

          {(flyer.agentPhone || flyer.agentEmail) && (
            <div className="mt-4 pt-4 border-t text-center text-sm text-muted-foreground">
              {flyer.agentPhone && <p data-testid="text-agent-phone">{flyer.agentPhone}</p>}
              {flyer.agentEmail && <p data-testid="text-agent-email">{flyer.agentEmail}</p>}
            </div>
          )}
        </div>

        <a 
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`}
          target="_blank" 
          rel="noopener noreferrer"
          className="block bg-white dark:bg-gray-800 px-4 py-4 border-b hover-elevate"
          data-testid="link-google-maps"
        >
          <div className="flex items-center justify-center gap-2 text-[#8B7355] font-medium">
            <MapPin className="w-5 h-5" />
            View on Google Maps
          </div>
        </a>

        <div className="bg-white dark:bg-gray-800 px-4 py-5 border-b">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Share2 className="w-5 h-5 text-[#8B7355]" />
            <h3 className="font-medium text-foreground">Share This Property</h3>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <div className="flex flex-col items-center gap-1.5">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={shareToFacebook}
                className="rounded-full bg-[#1877F2] border-[#1877F2]"
                data-testid="button-share-facebook"
              >
                <Facebook className="w-5 h-5 text-white" />
              </Button>
              <span className="text-xs text-muted-foreground">Facebook</span>
            </div>

            <div className="flex flex-col items-center gap-1.5">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={shareToTwitter}
                className="rounded-full bg-black border-black"
                data-testid="button-share-x"
              >
                <span className="text-white"><XIcon /></span>
              </Button>
              <span className="text-xs text-muted-foreground">X</span>
            </div>

            <div className="flex flex-col items-center gap-1.5">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={shareToLinkedIn}
                className="rounded-full bg-[#0A66C2] border-[#0A66C2]"
                data-testid="button-share-linkedin"
              >
                <Linkedin className="w-5 h-5 text-white" />
              </Button>
              <span className="text-xs text-muted-foreground">LinkedIn</span>
            </div>

            <div className="flex flex-col items-center gap-1.5">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={shareToWhatsApp}
                className="rounded-full bg-[#25D366] border-[#25D366]"
                data-testid="button-share-whatsapp"
              >
                <MessageCircle className="w-5 h-5 text-white" />
              </Button>
              <span className="text-xs text-muted-foreground">WhatsApp</span>
            </div>

            <div className="flex flex-col items-center gap-1.5">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={shareViaSMS}
                className="rounded-full bg-green-500 border-green-500"
                data-testid="button-share-sms"
              >
                <MessageCircle className="w-5 h-5 text-white" />
              </Button>
              <span className="text-xs text-muted-foreground">Text</span>
            </div>

            <div className="flex flex-col items-center gap-1.5">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={shareViaEmail}
                className="rounded-full bg-gray-600 border-gray-600"
                data-testid="button-share-email"
              >
                <Mail className="w-5 h-5 text-white" />
              </Button>
              <span className="text-xs text-muted-foreground">Email</span>
            </div>

            <div className="flex flex-col items-center gap-1.5">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={copyLink}
                className={`rounded-full ${linkCopied ? 'bg-green-500 border-green-500' : 'bg-gray-400 border-gray-400'}`}
                data-testid="button-copy-link"
              >
                {linkCopied ? <Check className="w-5 h-5 text-white" /> : <Link2 className="w-5 h-5 text-white" />}
              </Button>
              <span className="text-xs text-muted-foreground">{linkCopied ? 'Copied!' : 'Copy'}</span>
            </div>
          </div>
        </div>

        <footer className="bg-white dark:bg-gray-800 px-4 py-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            {flyer.companyLogo && <img src={flyer.companyLogo} alt="" className="h-6" />}
            {flyer.secondaryLogo && (
              <>
                <div className="w-px h-4 bg-gray-300 dark:bg-gray-600" />
                <img src={flyer.secondaryLogo} alt="" className="h-5" />
              </>
            )}
          </div>
          <p className="text-muted-foreground text-xs">&copy; {new Date().getFullYear()} Spyglass Realty</p>
        </footer>
      </main>
    </div>
  );
}
