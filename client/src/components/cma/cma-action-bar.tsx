import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { 
  Save,
  Share2, 
  Download, 
  MoreHorizontal, 
  Mail, 
  Link, 
  Printer, 
  FileText, 
  LayoutGrid, 
  SlidersHorizontal, 
  StickyNote, 
  Copy, 
  ExternalLink,
  ChevronDown,
  Loader2,
  Play
} from 'lucide-react';

interface CMAActionBarProps {
  onSave?: () => void;
  isSaving?: boolean;
  onCopyEmail?: () => void;
  onCopyLiveUrl?: () => void;
  onShareCMA?: () => void;
  onPrint?: () => void;
  onExportPDF?: () => void;
  onPresentation?: () => void;
  onCmaPresentation?: () => void;
  onAdjustFilters?: () => void;
  onNotes?: () => void;
  onProduceUrl?: () => void;
  hasSavedCma?: boolean;
}

export function CMAActionBar({ 
  onSave,
  isSaving = false,
  onCopyEmail,
  onCopyLiveUrl,
  onShareCMA,
  onPrint,
  onExportPDF,
  onPresentation,
  onCmaPresentation,
  onAdjustFilters,
  onNotes,
  onProduceUrl,
  hasSavedCma = false,
}: CMAActionBarProps) {
  return (
    <div className="flex items-center justify-between" data-testid="cma-action-bar">
      {/* Left side - Save and Presentation Builder */}
      <div className="flex items-center gap-2">
        <Button 
          onClick={onSave}
          disabled={isSaving}
          className="gap-2"
          data-testid="button-save-cma"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {isSaving ? 'Saving...' : 'Save CMA'}
        </Button>

        {/* Presentation Builder - Standalone Button */}
        <Button 
          variant="outline" 
          onClick={onPresentation}
          className="gap-2"
          data-testid="button-presentation-builder"
        >
          <LayoutGrid className="w-4 h-4" />
          Presentation Builder
        </Button>

        {/* CMA Presentation - Interactive Player */}
        <Button 
          variant="outline" 
          onClick={onCmaPresentation}
          className="gap-2"
          data-testid="button-cma-presentation"
        >
          <Play className="w-4 h-4" />
          CMA Presentation
        </Button>
      </div>

      {/* Right side - Share, Export, More */}
      <div className="flex items-center gap-2">
        {/* Share Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2" data-testid="button-share-dropdown">
              <Share2 className="w-4 h-4" />
              Share
              <ChevronDown className="w-3 h-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onCopyEmail} className="gap-2" data-testid="menu-item-copy-email">
              <Mail className="w-4 h-4" />
              Copy Email
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCopyLiveUrl} className="gap-2" data-testid="menu-item-copy-url">
              <Link className="w-4 h-4" />
              Copy Live URL
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onShareCMA} className="gap-2" data-testid="menu-item-share-cma">
              <ExternalLink className="w-4 h-4" />
              Share CMA
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Export Dropdown - Only Print & Export PDF */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2" data-testid="button-export-dropdown">
              <Download className="w-4 h-4" />
              Export
              <ChevronDown className="w-3 h-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onPrint} className="gap-2" data-testid="menu-item-print">
              <Printer className="w-4 h-4" />
              Print
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExportPDF} className="gap-2" data-testid="menu-item-export-pdf">
              <FileText className="w-4 h-4" />
              Export PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* More options */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" data-testid="button-more-dropdown">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onProduceUrl} className="gap-2" data-testid="menu-item-produce-url">
              <Copy className="w-4 h-4" />
              Produce URL
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onAdjustFilters} className="gap-2" data-testid="menu-item-adjust-filters">
              <SlidersHorizontal className="w-4 h-4" />
              Adjust Filters
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onNotes} className="gap-2" data-testid="menu-item-notes">
              <StickyNote className="w-4 h-4" />
              Notes
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
