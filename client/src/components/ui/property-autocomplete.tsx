import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Loader2, MapPin, Hash, Home, Bed, Bath, Square } from 'lucide-react';

interface PropertyOption {
  mlsNumber: string;
  address: string;
  fullAddress: string;
  listPrice?: number;
  status?: string;
  beds?: number;
  baths?: number;
  sqft?: number;
}

interface PropertyAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (option: PropertyOption) => void;
  options: PropertyOption[];
  isLoading?: boolean;
  placeholder?: string;
  type: 'address' | 'mls';
  helperText?: string;
  className?: string;
  disabled?: boolean;
  testId?: string;
}

export function PropertyAutocomplete({
  value,
  onChange,
  onSelect,
  options,
  isLoading,
  placeholder,
  type,
  helperText,
  className,
  disabled,
  testId,
}: PropertyAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (options.length > 0 && value.length >= 3) {
      setIsOpen(true);
      setHighlightedIndex(-1);
    } else if (options.length === 0) {
      setIsOpen(false);
    }
  }, [options, value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || options.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => prev < options.length - 1 ? prev + 1 : 0);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : options.length - 1);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && options[highlightedIndex]) {
          handleSelect(options[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  const handleSelect = (option: PropertyOption) => {
    onSelect(option);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const formatPrice = (price?: number) => {
    if (!price) return '';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(price);
  };

  const getStatusBadge = (status?: string) => {
    const statusLower = status?.toLowerCase() || '';
    const config: Record<string, { bg: string; text: string; label: string }> = {
      'active': { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', label: 'Active' },
      'a': { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', label: 'Active' },
      'pending': { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', label: 'Pending' },
      'p': { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', label: 'Pending' },
      'under contract': { bg: 'bg-[#EF4923]/10 dark:bg-[#EF4923]/20/30', text: 'text-[#EF4923] dark:text-[#EF4923]/80', label: 'Under Contract' },
      'u': { bg: 'bg-[#EF4923]/10 dark:bg-[#EF4923]/20/30', text: 'text-[#EF4923] dark:text-[#EF4923]/80', label: 'Under Contract' },
      'sold': { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', label: 'Sold' },
      's': { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', label: 'Sold' },
    };
    const found = Object.entries(config).find(([key]) => statusLower.includes(key));
    return found ? config[found[0]] : { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', label: status || 'Unknown' };
  };

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (options.length > 0 && value.length >= 3) {
              setIsOpen(true);
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            type === 'mls' && 'font-mono',
            'pr-8'
          )}
          data-testid={testId}
        />
        {isLoading && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {!isLoading && type === 'address' && (
          <MapPin className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        )}
        {!isLoading && type === 'mls' && (
          <Hash className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {helperText && (
        <p className="text-xs text-muted-foreground mt-1">{helperText}</p>
      )}

      {isOpen && options.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-80 overflow-y-auto">
          {options.map((option, index) => {
            const statusBadge = getStatusBadge(option.status);
            return (
              <div
                key={option.mlsNumber}
                className={cn(
                  "px-3 py-2 cursor-pointer transition-colors border-b last:border-b-0 border-border/50",
                  highlightedIndex === index ? "bg-accent" : "hover:bg-accent/50"
                )}
                onClick={() => handleSelect(option)}
                onMouseEnter={() => setHighlightedIndex(index)}
                data-testid={`autocomplete-option-${option.mlsNumber}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    <Home className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">
                        {option.fullAddress}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                        <span className="font-mono">MLS# {option.mlsNumber}</span>
                        {option.beds && (
                          <span className="flex items-center gap-0.5">
                            <Bed className="h-3 w-3" />
                            {option.beds}
                          </span>
                        )}
                        {option.baths && (
                          <span className="flex items-center gap-0.5">
                            <Bath className="h-3 w-3" />
                            {option.baths}
                          </span>
                        )}
                        {option.sqft && (
                          <span className="flex items-center gap-0.5">
                            <Square className="h-3 w-3" />
                            {option.sqft.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {option.listPrice && (
                      <span className="font-semibold text-sm text-primary">
                        {formatPrice(option.listPrice)}
                      </span>
                    )}
                    <span className={cn(
                      "text-xs px-1.5 py-0.5 rounded",
                      statusBadge.bg,
                      statusBadge.text
                    )}>
                      {statusBadge.label}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
