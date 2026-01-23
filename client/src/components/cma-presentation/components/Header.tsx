import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Menu, Search, Star, Download, Phone, Mail, X } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import type { AgentProfile } from '../types';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface HeaderProps {
  propertyAddress: string;
  mlsNumber?: string;
  preparedFor?: string;
  agent: AgentProfile;
  onMenuClick: () => void;
  onClose: () => void;
  latitude?: number;
  longitude?: number;
}

export function Header({
  propertyAddress,
  mlsNumber,
  preparedFor,
  agent,
  onMenuClick,
  onClose,
  latitude = 30.2672,
  longitude = -97.7431,
}: HeaderProps) {
  const { theme, mapStyle } = useTheme();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    
    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!token) {
      console.warn('Mapbox token not found');
      return;
    }

    mapboxgl.accessToken = token;

    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: mapStyle,
      center: [longitude, latitude],
      zoom: 14,
      interactive: false,
      attributionControl: false,
    });

    return () => {
      mapRef.current?.remove();
    };
  }, []);

  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setStyle(mapStyle);
    }
  }, [mapStyle]);

  const logoPath = theme === 'dark' 
    ? '/assets/spyglass-logo-white.png' 
    : '/assets/spyglass-logo-white.png';

  return (
    <div className="relative h-40 md:h-48 flex-shrink-0" data-testid="presentation-header">
      <div 
        ref={mapContainerRef} 
        className="absolute inset-0"
        data-testid="header-map"
      />
      
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80" />
      
      <div className="relative z-10 h-full flex flex-col">
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onMenuClick}
              className="text-white hover:bg-white/20"
              data-testid="button-menu"
            >
              <Menu className="w-5 h-5" />
            </Button>
            {logoError ? (
              <div className="flex flex-col items-center">
                <span className="text-sm font-bold text-[#F37216] tracking-wider">SPYGLASS</span>
                <span className="text-xs text-white/80">REALTY</span>
              </div>
            ) : (
              <img 
                src={logoPath} 
                alt="Spyglass Realty" 
                className="h-6 md:h-8 w-auto"
                data-testid="header-logo"
                onError={() => setLogoError(true)}
              />
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              data-testid="button-search"
            >
              <Search className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              data-testid="button-favorite"
            >
              <Star className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              data-testid="button-download"
            >
              <Download className="w-5 h-5" />
            </Button>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center gap-2 text-white hover:bg-white/20 px-2"
                  data-testid="button-agent-profile"
                >
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={agent.photo} alt={agent.name} />
                    <AvatarFallback className="bg-[#F37216] text-white text-sm">
                      {agent.name?.charAt(0) || 'A'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm hidden sm:block">{agent.name}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64" align="end" data-testid="agent-popover">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={agent.photo} alt={agent.name} />
                      <AvatarFallback className="bg-[#F37216] text-white">
                        {agent.name?.charAt(0) || 'A'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{agent.name}</p>
                      <p className="text-sm text-muted-foreground">{agent.company}</p>
                    </div>
                  </div>
                  {agent.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <a href={`tel:${agent.phone}`} className="hover:underline">
                        {agent.phone}
                      </a>
                    </div>
                  )}
                  {agent.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <a href={`mailto:${agent.email}`} className="hover:underline truncate">
                        {agent.email}
                      </a>
                    </div>
                  )}
                  <Button variant="outline" className="w-full gap-2" size="sm">
                    <Mail className="w-4 h-4" />
                    Email Report
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-white hover:bg-white/20 ml-2"
              data-testid="button-close-header"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <h1 
            className="text-xl md:text-3xl font-bold tracking-wide text-white"
            data-testid="text-header-title"
          >
            COMPARATIVE MARKET ANALYSIS
          </h1>
          <p 
            className="text-sm md:text-base text-gray-200 mt-1"
            data-testid="text-property-address"
          >
            {propertyAddress}
          </p>
          {preparedFor && (
            <p className="text-xs text-gray-300 mt-1">
              Prepared for {preparedFor}
            </p>
          )}
          {mlsNumber && (
            <p 
              className="text-xs text-gray-400"
              data-testid="text-mls-number"
            >
              MLS# {mlsNumber}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
