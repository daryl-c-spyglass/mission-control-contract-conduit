import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  X, ChevronLeft, ChevronRight, Play, Pause, Menu, Share2,
  User, Building2, Quote, Megaphone, Clock, DollarSign, 
  FileText, Link2, BarChart3, Settings, Check, Globe, 
  Video, Camera, Palette, Printer, Network, Star
} from 'lucide-react';

interface CmaPresentationPlayerProps {
  isOpen: boolean;
  onClose: () => void;
  propertyAddress: string;
  mlsNumber: string;
  agentName: string;
  agentPhoto?: string;
  compsCount: number;
  daysOnMarket: number;
}

interface Section {
  id: string;
  title: string;
  subtitle?: string;
  icon: string;
  type: 'image' | 'video' | 'html' | 'map' | 'chart';
  videoUrl?: string;
}

export function CmaPresentationPlayer({
  isOpen,
  onClose,
  propertyAddress,
  mlsNumber,
  agentName,
  agentPhoto,
  compsCount,
  daysOnMarket,
}: CmaPresentationPlayerProps) {
  const [currentSection, setCurrentSection] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const sections: Section[] = [
    { id: 'agent_resume', title: 'AGENT RESUME', subtitle: agentName, icon: 'user', type: 'image' },
    { id: 'listing_with_spyglass', title: 'LISTING WITH SPYGLASS REALTY', icon: 'building', type: 'video', videoUrl: 'https://www.youtube.com/embed/iB_u-ksW3ts' },
    { id: 'client_testimonials', title: 'CLIENT TESTIMONIALS', subtitle: 'What Clients Say', icon: 'quote', type: 'html' },
    { id: 'marketing', title: 'MARKETING', icon: 'megaphone', type: 'image' },
    { id: 'comps', title: 'COMPS', subtitle: `${compsCount} Comparable Homes`, icon: 'homes', type: 'map' },
    { id: 'time_to_sell', title: 'TIME TO SELL', subtitle: `${daysOnMarket} Days on Market`, icon: 'clock', type: 'chart' },
    { id: 'suggested_list_price', title: 'SUGGESTED LIST PRICE', icon: 'dollar', type: 'chart' },
    { id: 'listing_action_plan', title: 'LISTING ACTION PLAN', icon: 'clipboard', type: 'image' },
    { id: 'spyglass_resources', title: 'SPYGLASS RESOURCES AND LINKS', icon: 'link', type: 'html' },
    { id: 'average_price_acre', title: 'AVERAGE PRICE/ACRE', icon: 'chart', type: 'chart' },
    { id: 'home_selling_system', title: 'HOME SELLING SYSTEM', icon: 'settings', type: 'image' },
    { id: 'our_proven_approach', title: 'OUR PROVEN APPROACH', icon: 'check', type: 'image' },
    { id: 'seo_digital_marketing', title: 'SEO & DIGITAL MARKETING', icon: 'globe', type: 'image' },
    { id: 'google_meta_ads', title: 'GOOGLE + META ADS', icon: 'megaphone', type: 'image' },
    { id: 'professional_videography', title: 'PROFESSIONAL VIDEOGRAPHY', icon: 'video', type: 'video' },
    { id: 'why_4k_video', title: 'WHY 4K VIDEO', icon: 'video', type: 'video' },
    { id: 'example_videos', title: 'EXAMPLE VIDEOS', icon: 'play', type: 'video' },
    { id: 'aerial_photography', title: 'AERIAL PHOTOGRAPHY', icon: 'camera', type: 'image' },
    { id: 'in_house_design', title: 'IN-HOUSE DESIGN TEAM', icon: 'palette', type: 'image' },
    { id: 'print_flyers', title: 'PRINT & FLYERS', icon: 'printer', type: 'image' },
    { id: 'custom_property_page', title: 'CUSTOM PROPERTY PAGE', icon: 'globe', type: 'html' },
    { id: 'global_marketing_reach', title: 'GLOBAL MARKETING REACH', icon: 'globe', type: 'image' },
    { id: 'leadingre_network', title: 'LEADINGRE NETWORK STRENGTH', icon: 'network', type: 'image' },
    { id: 'featured_property', title: 'FEATURED PROPERTY PROGRAM', icon: 'star', type: 'image' },
  ];

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      if (e.key === 'Escape') {
        if (currentSection !== null) {
          setCurrentSection(null);
        } else {
          onClose();
        }
      } else if (e.key === 'ArrowLeft' && currentSection !== null) {
        setCurrentSection(Math.max(0, currentSection - 1));
      } else if (e.key === 'ArrowRight' && currentSection !== null) {
        setCurrentSection(Math.min(sections.length - 1, currentSection + 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentSection, onClose, sections.length]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isPlaying && currentSection !== null) {
      interval = setInterval(() => {
        setCurrentSection(prev => {
          if (prev === null || prev >= sections.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentSection, sections.length]);

  if (!isOpen) return null;

  if (currentSection === null) {
    return (
      <div 
        className="fixed inset-0 bg-black z-50 flex flex-col touch-manipulation"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        }}
        data-testid="cma-presentation-toc"
      >
        <div className="relative h-32 md:h-40 bg-gradient-to-b from-gray-800 to-gray-900">
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 to-black/80" />
          
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="absolute top-4 left-4 z-10 rounded-full bg-black/50 text-white hover:bg-black/70"
            data-testid="button-close-presentation"
          >
            <X className="w-5 h-5" />
          </Button>

          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 pt-8">
            <h1 
              className="text-lg md:text-2xl font-bold tracking-wide text-white"
              data-testid="text-presentation-title"
            >
              COMPARATIVE MARKET ANALYSIS
            </h1>
            <p 
              className="text-sm text-gray-300 mt-1"
              data-testid="text-property-address"
            >
              {propertyAddress}
            </p>
            {mlsNumber && (
              <p 
                className="text-xs text-gray-400"
                data-testid="text-mls-number"
              >
                MLS# {mlsNumber}
              </p>
            )}
          </div>

          <div 
            className="absolute top-4 right-4 flex items-center gap-2 bg-black/50 rounded-full px-3 py-1.5"
            data-testid="agent-badge"
          >
            {agentPhoto ? (
              <img src={agentPhoto} alt={agentName} className="w-6 h-6 rounded-full object-cover" />
            ) : (
              <div className="w-6 h-6 bg-[#F37216] rounded-full flex items-center justify-center text-xs font-bold text-white">
                {agentName?.charAt(0)}
              </div>
            )}
            <span className="text-xs text-white hidden sm:block" data-testid="text-agent-name">{agentName}</span>
          </div>

          <div className="absolute top-4 left-16 text-xs font-bold tracking-widest text-gray-400">
            SPYGLASS
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 bg-gray-100 dark:bg-gray-900">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {sections.map((section, index) => (
              <Card
                key={section.id}
                onClick={() => setCurrentSection(index)}
                className="p-4 text-center min-h-[100px] flex flex-col items-center justify-center gap-2 cursor-pointer hover-elevate"
                data-testid={`section-card-${section.id}`}
              >
                <SectionIcon icon={section.icon} />
                <h4 className="text-xs font-bold uppercase leading-tight">
                  {section.title}
                </h4>
                {section.subtitle && (
                  <p className="text-xs text-muted-foreground">{section.subtitle}</p>
                )}
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const section = sections[currentSection];
  
  return (
    <div 
      className="fixed inset-0 bg-black z-50 flex flex-col touch-manipulation"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
      data-testid="cma-presentation-slide"
    >
      <div className="flex items-center justify-between p-4 bg-black/90">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentSection(null)}
          className="text-white hover:bg-gray-800"
          data-testid="button-back-to-toc"
        >
          <X className="w-6 h-6" />
        </Button>
        <div className="text-center flex-1">
          <p 
            className="text-sm font-medium text-white"
            data-testid="text-section-title"
          >
            {section.title}
          </p>
          <p 
            className="text-xs text-gray-400"
            data-testid="text-section-counter"
          >
            {currentSection + 1} / {sections.length}
          </p>
        </div>
        <Button 
          variant="ghost"
          size="icon"
          className="text-white hover:bg-gray-800"
          data-testid="button-share-slide"
        >
          <Share2 className="w-5 h-5" />
        </Button>
      </div>

      <div className="h-1 bg-gray-800" data-testid="progress-bar-container">
        <div
          className="h-full bg-[#F37216] transition-all duration-300"
          style={{ width: `${((currentSection + 1) / sections.length) * 100}%` }}
          data-testid="progress-bar-fill"
        />
      </div>

      <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden">
        <SlideContent section={section} />
        
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-gray-500">
          ← Swipe to navigate →
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 p-4 bg-black/90">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentSection(Math.max(0, currentSection - 1))}
          disabled={currentSection === 0}
          className="bg-gray-800 text-white hover:bg-gray-700 rounded-full"
          data-testid="button-prev-slide"
        >
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <Button
          variant="ghost"
          size="lg"
          onClick={() => setIsPlaying(!isPlaying)}
          className="bg-[#F37216] text-white hover:bg-[#e06610] rounded-full"
          data-testid="button-play-pause"
        >
          {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentSection(Math.min(sections.length - 1, currentSection + 1))}
          disabled={currentSection === sections.length - 1}
          className="bg-gray-800 text-white hover:bg-gray-700 rounded-full"
          data-testid="button-next-slide"
        >
          <ChevronRight className="w-6 h-6" />
        </Button>
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => setCurrentSection(null)}
        className="absolute bottom-24 right-4 bg-gray-800 text-white hover:bg-gray-700 rounded-full"
        data-testid="button-toc-menu"
      >
        <Menu className="w-5 h-5" />
      </Button>
    </div>
  );
}

function SectionIcon({ icon }: { icon: string }) {
  const iconClass = "w-6 h-6 text-muted-foreground";
  
  switch (icon) {
    case 'user': return <User className={iconClass} />;
    case 'building': return <Building2 className={iconClass} />;
    case 'quote': return <Quote className={iconClass} />;
    case 'megaphone': return <Megaphone className={iconClass} />;
    case 'homes': return <Building2 className={iconClass} />;
    case 'clock': return <Clock className={iconClass} />;
    case 'dollar': return <DollarSign className={iconClass} />;
    case 'clipboard': return <FileText className={iconClass} />;
    case 'link': return <Link2 className={iconClass} />;
    case 'chart': return <BarChart3 className={iconClass} />;
    case 'settings': return <Settings className={iconClass} />;
    case 'check': return <Check className={iconClass} />;
    case 'globe': return <Globe className={iconClass} />;
    case 'video': return <Video className={iconClass} />;
    case 'play': return <Play className={iconClass} />;
    case 'camera': return <Camera className={iconClass} />;
    case 'palette': return <Palette className={iconClass} />;
    case 'printer': return <Printer className={iconClass} />;
    case 'network': return <Network className={iconClass} />;
    case 'star': return <Star className={iconClass} />;
    default: return <FileText className={iconClass} />;
  }
}

function SlideContent({ section }: { section: Section }) {
  if (section.type === 'video' && section.videoUrl) {
    return (
      <div className="w-full max-w-4xl aspect-video bg-gray-900 rounded-lg overflow-hidden">
        <iframe
          src={section.videoUrl}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={section.title}
        />
      </div>
    );
  }

  return (
    <div className="text-center" data-testid="slide-content">
      <div className="w-24 h-24 mx-auto mb-4 bg-gray-800 rounded-2xl flex items-center justify-center">
        <SectionIcon icon={section.icon} />
      </div>
      <h2 className="text-2xl font-bold text-white" data-testid="slide-title">{section.title}</h2>
      {section.subtitle && <p className="text-gray-400 mt-2" data-testid="slide-subtitle">{section.subtitle}</p>}
      <p className="text-sm text-gray-500 mt-4">Slide Type: {section.type}</p>
      <p className="text-xs text-gray-600 mt-2">(Content will be populated from CMA data)</p>
    </div>
  );
}
