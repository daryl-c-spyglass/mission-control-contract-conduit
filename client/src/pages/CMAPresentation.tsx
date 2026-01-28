import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/cma-presentation/components/Header';
import { Sidebar } from '@/components/cma-presentation/components/Sidebar';
import { SectionGrid } from '@/components/cma-presentation/components/SectionGrid';
import { SlideViewer } from '@/components/cma-presentation/components/SlideViewer';
import { BottomNavigation } from '@/components/cma-presentation/components/BottomNavigation';
import { DrawingCanvas, type DrawingCanvasHandle } from '@/components/cma-presentation/components/DrawingCanvas';
import { WIDGETS } from '@/components/cma-presentation/constants/widgets';
import { Loader2 } from 'lucide-react';
import { useRef } from 'react';
import type { Transaction, Cma, AgentProfile } from '@shared/schema';

export default function CMAPresentation() {
  const [, params] = useRoute('/transactions/:transactionId/cma-presentation');
  const [, navigate] = useLocation();
  const transactionId = params?.transactionId;

  const [currentSlide, setCurrentSlide] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [drawingMode, setDrawingMode] = useState(false);
  const drawingCanvasRef = useRef<DrawingCanvasHandle>(null);

  const handleClearDrawing = () => {
    drawingCanvasRef.current?.clear();
  };

  const handleClose = useCallback(() => {
    navigate(`/transactions/${transactionId}?tab=cma`);
  }, [navigate, transactionId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (drawingMode) {
          setDrawingMode(false);
        } else if (currentSlide !== null) {
          setCurrentSlide(null);
        } else if (sidebarOpen) {
          setSidebarOpen(false);
        } else {
          handleClose();
        }
      } else if (currentSlide !== null && !drawingMode) {
        if (e.key === 'ArrowLeft' && currentSlide > 0) {
          setCurrentSlide(currentSlide - 1);
        } else if (e.key === 'ArrowRight' && currentSlide < WIDGETS.length - 1) {
          setCurrentSlide(currentSlide + 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlide, sidebarOpen, drawingMode, handleClose]);

  const { data: transaction, isLoading: transactionLoading } = useQuery<Transaction>({
    queryKey: ['/api/transactions', transactionId],
    enabled: !!transactionId,
  });

  const { data: savedCma, isLoading: cmaLoading } = useQuery<Cma>({
    queryKey: ['/api/transactions', transactionId, 'cma'],
    enabled: !!transactionId,
  });

  const { data: agentProfileData, isLoading: profileLoading } = useQuery<{
    profile: {
      id?: string;
      userId?: string;
      title?: string;
      headshotUrl?: string;
      bio?: string;
      defaultCoverLetter?: string;
      marketingCompany?: string;
    } | null;
    user: { 
      firstName?: string; 
      lastName?: string;
      profileImageUrl?: string;
      marketingDisplayName?: string; 
      marketingTitle?: string; 
      marketingHeadshotUrl?: string; 
      marketingPhone?: string; 
      marketingEmail?: string;
    } | null;
  }>({
    queryKey: ['/api/agent/profile'],
  });

  const agentProfile = useMemo(() => {
    if (!agentProfileData) return { name: '', company: 'Spyglass Realty', phone: '', email: '', photo: '', bio: '' };
    
    const { profile, user } = agentProfileData;
    const displayName = user?.marketingDisplayName || 
      (user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : 
       user?.firstName || 'Agent');
    
    return {
      name: displayName,
      company: profile?.marketingCompany || 'Spyglass Realty',
      phone: user?.marketingPhone || '',
      email: user?.marketingEmail || '',
      photo: user?.marketingHeadshotUrl || profile?.headshotUrl || user?.profileImageUrl || '',
      title: profile?.title || user?.marketingTitle || '',
      bio: profile?.bio || '',
    };
  }, [agentProfileData]);

  // Normalize status checking both status and lastStatus fields
  // lastStatus="Sld" indicates a sold property, "Lsd" indicates leased (rental closed)
  const normalizeStatusWithLastStatus = useCallback((status: string | undefined | null, lastStatus: string | undefined | null): string => {
    // First check lastStatus - "Sld" (Sold), "Lsd" (Leased), etc. indicate closed transactions
    if (lastStatus) {
      const ls = lastStatus.toLowerCase();
      // Sld = Sold, Lsd = Leased (rental closed), S = Sold
      if (ls === 'sld' || ls === 'sold' || ls === 'lsd' || ls === 'leased' || ls === 's' || 
          ls.includes('sold') || ls.includes('closed') || ls.includes('leased')) {
        return 'Closed';
      }
    }
    
    // Then check the primary status field
    if (!status) return 'Active';
    const s = status.toLowerCase();
    if (s === 'u' || s === 'sc' || s.includes('pending') || s.includes('contract')) return 'Pending';
    if (s === 'a' || s.includes('active')) return 'Active';
    if (s === 'c' || s === 's' || s.includes('sold') || s.includes('closed') || s.includes('leased')) return 'Closed';
    if (s.includes('expired') || s.includes('withdrawn') || s.includes('cancel')) return 'Off Market';
    return status;
  }, []);

  const presentationComparables = useMemo(() => {
    const cmaPropertiesData = (savedCma?.propertiesData || []) as any[];
    const transactionCmaData = (transaction?.cmaData || []) as any[];
    
    // Create lookup maps from transaction.cmaData by mlsNumber for coordinates and status
    // This ensures we always use the LATEST status from MLS sync, even if savedCma has stale data
    const coordinateLookup = new Map<string, { lat: number; lng: number }>();
    const statusLookup = new Map<string, { status: string; lastStatus: string }>();
    
    transactionCmaData.forEach((comp: any) => {
      if (!comp.mlsNumber) return;
      
      const lat = comp.latitude || comp.lat || comp.map?.latitude || comp.map?.lat || 
        comp.coordinates?.latitude || comp.coordinates?.lat || comp.geo?.lat;
      const lng = comp.longitude || comp.lng || comp.map?.longitude || comp.map?.lng || 
        comp.coordinates?.longitude || comp.coordinates?.lng || comp.geo?.lng;
      if (lat && lng) {
        coordinateLookup.set(comp.mlsNumber, { lat, lng });
      }
      
      // Always store the latest status from transaction.cmaData
      statusLookup.set(comp.mlsNumber, {
        status: comp.status || comp.standardStatus || '',
        lastStatus: comp.lastStatus || ''
      });
    });
    
    // Prefer CMA propertiesData if available, otherwise use transaction.cmaData
    const rawComparables = cmaPropertiesData.length > 0 ? cmaPropertiesData : transactionCmaData;
    
    return (rawComparables as any[]).map((comp: any, index: number) => {
      const resolvedAddress = comp.unparsedAddress || comp.streetAddress || comp.address || 
        comp.fullAddress || comp.addressLine1 || comp.location?.address || '';
      
      const parsedSqft = typeof comp.sqft === 'string' ? parseFloat(comp.sqft) : (comp.sqft || comp.livingArea || 0);
      const parsedBeds = typeof comp.bedrooms === 'string' ? parseInt(comp.bedrooms) : (comp.bedrooms || comp.beds || comp.bedroomsTotal || 0);
      const parsedBaths = typeof comp.bathrooms === 'string' ? parseFloat(comp.bathrooms) : (comp.bathrooms || comp.baths || comp.bathroomsTotal || 0);
      const parsedPrice = comp.listPrice || comp.price || comp.closePrice || 0;
      
      // First try to get coordinates from the comp itself
      let lat = comp.latitude || comp.lat || comp.map?.latitude || comp.map?.lat || 
        comp.coordinates?.latitude || comp.coordinates?.lat || comp.geo?.lat;
      let lng = comp.longitude || comp.lng || comp.map?.longitude || comp.map?.lng || 
        comp.coordinates?.longitude || comp.coordinates?.lng || comp.geo?.lng;
      
      // If no coordinates and we have mlsNumber, try to get from transaction.cmaData
      if ((!lat || !lng) && comp.mlsNumber) {
        const fallbackCoords = coordinateLookup.get(comp.mlsNumber);
        if (fallbackCoords) {
          lat = fallbackCoords.lat;
          lng = fallbackCoords.lng;
        }
      }
      
      const lotAcres = comp.lotSizeAcres ?? comp.lot?.acres ?? 
        (comp.lotSizeSquareFeet ? comp.lotSizeSquareFeet / 43560 : null) ??
        (comp.lotSize && comp.lotSize > 100 ? comp.lotSize / 43560 : comp.lotSize) ?? null;
      
      // Get status from the latest transaction.cmaData if available (via lookup), 
      // otherwise fall back to the comp's own status fields
      const freshStatus = comp.mlsNumber ? statusLookup.get(comp.mlsNumber) : null;
      const statusToUse = freshStatus?.status || comp.status || comp.standardStatus || '';
      const lastStatusToUse = freshStatus?.lastStatus || comp.lastStatus || '';
      
      // Get normalized status using both status and lastStatus fields
      const normalizedStatus = normalizeStatusWithLastStatus(statusToUse, lastStatusToUse);
      
      return {
        id: comp.mlsNumber || `comp-${index}`,
        mlsNumber: comp.mlsNumber || '',
        unparsedAddress: resolvedAddress,
        streetAddress: resolvedAddress,
        address: resolvedAddress,
        city: comp.city || comp.location?.city || '',
        listPrice: parsedPrice,
        closePrice: comp.closePrice || comp.soldPrice,
        standardStatus: normalizedStatus,
        status: normalizedStatus,
        bedroomsTotal: parsedBeds,
        beds: parsedBeds,
        bathroomsTotal: parsedBaths,
        baths: parsedBaths,
        livingArea: parsedSqft,
        sqft: parsedSqft,
        lotSizeAcres: lotAcres,
        daysOnMarket: comp.daysOnMarket || comp.dom || 0,
        photos: (comp.photos || (comp.imageUrl ? [comp.imageUrl] : [])),
        map: lat && lng ? { latitude: lat, longitude: lng } : null,
        latitude: lat,
        longitude: lng,
      };
    });
  }, [savedCma?.propertiesData, transaction?.cmaData, normalizeStatusWithLastStatus]);

  const subjectProperty = useMemo(() => {
    const rawSubject = transaction?.mlsData as any;
    if (!rawSubject) return undefined;
    
    return {
      ...rawSubject,
      unparsedAddress: rawSubject.address || rawSubject.unparsedAddress || rawSubject.streetAddress || '',
      streetAddress: rawSubject.address || rawSubject.streetAddress || rawSubject.unparsedAddress || '',
      address: rawSubject.address || rawSubject.unparsedAddress || rawSubject.streetAddress || '',
      bedroomsTotal: rawSubject.bedroomsTotal || rawSubject.bedrooms || 0,
      beds: rawSubject.bedroomsTotal || rawSubject.bedrooms || 0,
      bathroomsTotal: rawSubject.bathroomsTotal || rawSubject.bathrooms || 0,
      baths: rawSubject.bathroomsTotal || rawSubject.bathrooms || 0,
      livingArea: typeof rawSubject.sqft === 'string' ? parseFloat(rawSubject.sqft) : (rawSubject.sqft || rawSubject.livingArea || 0),
      sqft: typeof rawSubject.sqft === 'string' ? parseFloat(rawSubject.sqft) : (rawSubject.sqft || rawSubject.livingArea || 0),
      standardStatus: normalizeStatusWithLastStatus(rawSubject.standardStatus || rawSubject.status, rawSubject.lastStatus),
      latitude: rawSubject.latitude || rawSubject.coordinates?.latitude,
      longitude: rawSubject.longitude || rawSubject.coordinates?.longitude,
      map: rawSubject.map || (rawSubject.coordinates?.latitude && rawSubject.coordinates?.longitude ? 
        { latitude: rawSubject.coordinates.latitude, longitude: rawSubject.coordinates.longitude } : null),
    };
  }, [transaction?.mlsData, normalizeStatusWithLastStatus]);

  const averageDaysOnMarket = useMemo(() => {
    if (!presentationComparables.length) return 30;
    const total = presentationComparables.reduce((sum: number, c: any) => sum + (c.daysOnMarket || 0), 0);
    return Math.round(total / presentationComparables.length);
  }, [presentationComparables]);

  const suggestedListPrice = useMemo(() => {
    if (!presentationComparables.length) return null;
    const prices = presentationComparables.map((c: any) => c.listPrice || c.closePrice || 0).filter(Boolean);
    if (!prices.length) return null;
    return Math.round(prices.reduce((a: number, b: number) => a + b, 0) / prices.length);
  }, [presentationComparables]);

  const avgPricePerAcre = useMemo(() => {
    const compsWithAcres = presentationComparables.filter((c: any) => c.lotSizeAcres && c.lotSizeAcres > 0);
    if (!compsWithAcres.length) return null;
    const total = compsWithAcres.reduce((sum: number, c: any) => {
      const price = c.closePrice || c.listPrice || 0;
      return sum + (price / c.lotSizeAcres);
    }, 0);
    return Math.round(total / compsWithAcres.length);
  }, [presentationComparables]);

  const isLoading = transactionLoading || cmaLoading || profileLoading;

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-muted-foreground">Loading presentation...</p>
        </div>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground">Transaction not found</p>
        </div>
      </div>
    );
  }

  if (currentSlide !== null) {
    const prevTitle = currentSlide > 0 ? WIDGETS[currentSlide - 1].title : null;
    const nextTitle = currentSlide < WIDGETS.length - 1 ? WIDGETS[currentSlide + 1].title : null;

    return (
      <>
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          widgets={WIDGETS}
          onSelectWidget={(index) => {
            setCurrentSlide(index);
            setSidebarOpen(false);
          }}
          currentWidget={currentSlide}
          compsCount={presentationComparables.length}
        />
        <SlideViewer
          currentIndex={currentSlide}
          onClose={() => setCurrentSlide(null)}
          onPrev={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
          onNext={() => setCurrentSlide(Math.min(WIDGETS.length - 1, currentSlide + 1))}
          onHome={() => setCurrentSlide(null)}
          onMenuClick={() => setSidebarOpen(true)}
          agent={agentProfile}
          comparables={presentationComparables as any}
          subjectProperty={subjectProperty as any}
          averageDaysOnMarket={averageDaysOnMarket}
          suggestedListPrice={suggestedListPrice}
        />
        <BottomNavigation
          mode="slide"
          currentSlide={currentSlide}
          totalSlides={WIDGETS.length}
          prevSlideTitle={prevTitle}
          nextSlideTitle={nextTitle}
          onPrevious={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
          onNext={() => setCurrentSlide(Math.min(WIDGETS.length - 1, currentSlide + 1))}
          onHome={() => setCurrentSlide(null)}
          onToggleDrawing={() => setDrawingMode(!drawingMode)}
          onClearDrawing={handleClearDrawing}
          isDrawingMode={drawingMode}
        />
        <DrawingCanvas ref={drawingCanvasRef} isActive={drawingMode} onClose={() => setDrawingMode(false)} />
      </>
    );
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex flex-col bg-background touch-manipulation"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
      data-testid="cma-presentation-page"
    >
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        widgets={WIDGETS}
        onSelectWidget={(index) => {
          setCurrentSlide(index);
          setSidebarOpen(false);
        }}
        currentWidget={currentSlide ?? undefined}
        compsCount={presentationComparables.length}
        daysOnMarket={averageDaysOnMarket}
        suggestedListPrice={suggestedListPrice}
        avgPricePerAcre={avgPricePerAcre}
      />

      <Header
        propertyAddress={transaction.propertyAddress || 'Property Address'}
        mlsNumber={transaction.mlsNumber || ''}
        agent={agentProfile}
        onMenuClick={() => setSidebarOpen(true)}
        onClose={handleClose}
        latitude={subjectProperty?.latitude}
        longitude={subjectProperty?.longitude}
        comparables={presentationComparables as any}
        subjectProperty={subjectProperty as any}
        averageDaysOnMarket={averageDaysOnMarket}
        suggestedListPrice={suggestedListPrice}
        avgPricePerAcre={avgPricePerAcre}
      />

      <div className="flex-1 overflow-auto bg-muted/30 pb-16">
        <SectionGrid
          widgets={WIDGETS}
          onSelectWidget={setCurrentSlide}
          compsCount={presentationComparables.length}
          daysOnMarket={averageDaysOnMarket}
          suggestedListPrice={suggestedListPrice}
          avgPricePerAcre={avgPricePerAcre}
          agent={agentProfile}
        />
      </div>

      <BottomNavigation
        mode="home"
        onStartPresentation={() => setCurrentSlide(0)}
        onToggleDrawing={() => setDrawingMode(!drawingMode)}
        onClearDrawing={handleClearDrawing}
        isDrawingMode={drawingMode}
      />
      
      <DrawingCanvas ref={drawingCanvasRef} isActive={drawingMode} onClose={() => setDrawingMode(false)} />
    </div>
  );
}
