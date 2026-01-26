import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  User, MessageSquareQuote, Home, Clock, DollarSign, 
  BarChart3, Megaphone, ClipboardList, Link2 
} from 'lucide-react';
import type { WidgetDefinition } from '../types';
import { useTheme } from '../hooks/useTheme';

interface SectionCardProps {
  widget: WidgetDefinition;
  onClick: () => void;
  badge?: string | number;
  agentPhoto?: string;
  agentName?: string;
}

export function SectionCard({ widget, onClick, badge, agentPhoto, agentName }: SectionCardProps) {
  const { theme } = useTheme();
  const [logoError, setLogoError] = useState(false);
  const [photoError, setPhotoError] = useState(false);
  
  // Theme-aware logo: white for dark mode, black for light mode
  const logoPath = theme === 'dark' 
    ? '/logos/SpyglassRealty_Logo_White.png' 
    : '/logos/SpyglassRealty_Logo_Black.png';

  const renderIcon = () => {
    const iconClass = "w-8 h-8 text-muted-foreground";
    
    switch (widget.icon) {
      case 'user':
        // Show agent photo if available, otherwise show user icon
        if (agentPhoto && !photoError) {
          return (
            <img 
              src={agentPhoto}
              alt={agentName || 'Agent'}
              className="w-12 h-12 rounded-full object-cover border-2 border-border"
              onError={() => setPhotoError(true)}
            />
          );
        }
        return <User className={iconClass} />;
      case 'spyglass':
        if (logoError) {
          return (
            <div className="flex flex-col items-center">
              <span className="text-sm font-bold text-[#EF4923] tracking-wider">SPYGLASS</span>
              <span className="text-xs text-muted-foreground">REALTY</span>
            </div>
          );
        }
        return (
          <img 
            src={logoPath}
            alt="Spyglass Realty" 
            className="h-10 w-auto max-w-[120px] object-contain"
            onError={() => setLogoError(true)}
          />
        );
      case 'quote':
        return <MessageSquareQuote className={iconClass} />;
      case 'homes':
        return (
          <div className="relative">
            <Home className={iconClass} />
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#EF4923] rounded-full flex items-center justify-center">
              <DollarSign className="w-3 h-3 text-white" />
            </div>
          </div>
        );
      case 'clock':
        return <Clock className={`${iconClass} text-[#EF4923]`} />;
      case 'dollar':
        return <DollarSign className={`${iconClass} text-[#EF4923]`} />;
      case 'chart':
        return <BarChart3 className={`${iconClass} text-[#EF4923]`} />;
      case 'megaphone':
        return <Megaphone className={iconClass} />;
      case 'clipboard':
        return <ClipboardList className={iconClass} />;
      case 'link':
        return <Link2 className={iconClass} />;
      default:
        return null;
    }
  };

  return (
    <Card
      onClick={onClick}
      className="p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover-elevate min-h-[120px] touch-manipulation"
      data-testid={`section-card-${widget.id}`}
    >
      {renderIcon()}
      <span className="text-xs font-bold text-center uppercase tracking-wide line-clamp-2">
        {widget.title}
      </span>
      {(widget.subtitle || (widget.id === 'agent_resume' && agentName)) && (
        <span className="text-xs text-muted-foreground text-center">
          {widget.id === 'agent_resume' ? agentName || 'Agent' : widget.subtitle}
        </span>
      )}
      {(badge || widget.badge) && (
        <Badge variant="secondary" className="text-[#EF4923]">
          {badge || widget.badge}
        </Badge>
      )}
    </Card>
  );
}
