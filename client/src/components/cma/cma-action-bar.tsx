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
  ChevronDown
} from 'lucide-react';

interface CMAActionBarProps {
  onSave?: () => void;
  hasUnsavedChanges?: boolean;
  onCopyEmail?: () => void;
  onCopyLiveUrl?: () => void;
  onShareCMA?: () => void;
  onPrint?: () => void;
  onExportPDF?: () => void;
  onPresentation?: () => void;
  onAdjustFilters?: () => void;
  onNotes?: () => void;
  onProduceUrl?: () => void;
}

export function CMAActionBar({ 
  onSave, 
  hasUnsavedChanges = false,
  onCopyEmail,
  onCopyLiveUrl,
  onShareCMA,
  onPrint,
  onExportPDF,
  onPresentation,
  onAdjustFilters,
  onNotes,
  onProduceUrl,
}: CMAActionBarProps) {
  return (
    <div className="flex items-center justify-between" data-testid="cma-action-bar">
      <div className="flex items-center gap-2">
        <Button 
          onClick={onSave}
          disabled={!hasUnsavedChanges}
          className="gap-2"
          data-testid="button-save-cma"
        >
          <Save className="w-4 h-4" />
          Save
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2" data-testid="button-share-dropdown">
              <Share2 className="w-4 h-4" />
              Share
              <ChevronDown className="w-3 h-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2" data-testid="button-export-dropdown">
              <Download className="w-4 h-4" />
              Export
              <ChevronDown className="w-3 h-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onClick={onPrint} className="gap-2" data-testid="menu-item-print">
              <Printer className="w-4 h-4" />
              Print
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExportPDF} className="gap-2" data-testid="menu-item-export-pdf">
              <FileText className="w-4 h-4" />
              Export PDF
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onPresentation} className="gap-2" data-testid="menu-item-presentation">
              <LayoutGrid className="w-4 h-4" />
              Presentation Builder
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" data-testid="button-more-dropdown">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
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
