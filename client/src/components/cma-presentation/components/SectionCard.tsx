import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  User, MessageSquareQuote, Home, Clock, DollarSign, 
  BarChart3, Megaphone, ClipboardList, Link2 
} from 'lucide-react';
import { SPYGLASS_LOGO_BLACK } from '../constants/widgets';
import type { WidgetDefinition } from '../types';
import { useTheme } from '../hooks/useTheme';

interface SectionCardProps {
  widget: WidgetDefinition;
  onClick: () => void;
  badge?: string | number;
}

export function SectionCard({ widget, onClick, badge }: SectionCardProps) {
  const { theme } = useTheme();
  const [logoError, setLogoError] = useState(false);
  const logoPath = theme === 'dark' 
    ? '/assets/spyglass-logo-white.png' 
    : '/assets/spyglass-logo-black.png';

  const renderIcon = () => {
    const iconClass = "w-8 h-8 text-muted-foreground";
    
    switch (widget.icon) {
      case 'user':
        return (
          <div className="relative">
            <User className={iconClass} />
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#F37216] rounded-full flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">i</span>
            </div>
          </div>
        );
      case 'spyglass':
        if (logoError) {
          return (
            <div className="flex flex-col items-center">
              <span className="text-sm font-bold text-[#F37216] tracking-wider">SPYGLASS</span>
              <span className="text-xs text-muted-foreground">REALTY</span>
            </div>
          );
        }
        return (
          <img 
            src={logoPath} 
            alt="Spyglass Realty" 
            className="w-12 h-auto object-contain"
            onError={() => setLogoError(true)}
          />
        );
      case 'quote':
        return <MessageSquareQuote className={iconClass} />;
      case 'homes':
        return (
          <div className="relative">
            <Home className={iconClass} />
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#F37216] rounded-full flex items-center justify-center">
              <DollarSign className="w-3 h-3 text-white" />
            </div>
          </div>
        );
      case 'clock':
        return <Clock className={`${iconClass} text-[#F37216]`} />;
      case 'dollar':
        return <DollarSign className={`${iconClass} text-[#F37216]`} />;
      case 'chart':
        return <BarChart3 className={`${iconClass} text-[#F37216]`} />;
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
      {widget.subtitle && (
        <span className="text-xs text-muted-foreground text-center">
          {widget.subtitle}
        </span>
      )}
      {(badge || widget.badge) && (
        <Badge variant="secondary" className="text-[#F37216]">
          {badge || widget.badge}
        </Badge>
      )}
    </Card>
  );
}
