import { ChevronLeft, ChevronRight, Pencil, Trash2, X } from 'lucide-react';

interface BottomNavigationProps {
  mode: 'home' | 'slide';
  currentSlide?: number;
  totalSlides?: number;
  prevSlideTitle?: string | null;
  nextSlideTitle?: string | null;
  onPrevious?: () => void;
  onNext?: () => void;
  onHome?: () => void;
  onStartPresentation?: () => void;
  onToggleDrawing: () => void;
  onClearDrawing?: () => void;
  isDrawingMode: boolean;
}

export function BottomNavigation({
  mode,
  currentSlide = 0,
  totalSlides = 0,
  prevSlideTitle,
  nextSlideTitle,
  onPrevious,
  onNext,
  onHome,
  onStartPresentation,
  onToggleDrawing,
  onClearDrawing,
  isDrawingMode,
}: BottomNavigationProps) {
  const isFirst = currentSlide === 0;
  const isLast = currentSlide === totalSlides - 1;

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 h-14 bg-white dark:bg-gray-900 
                 border-t border-gray-200 dark:border-gray-700 flex items-center 
                 justify-between px-4 md:px-6 z-[55]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      data-testid="bottom-navigation"
    >
      {mode === 'home' ? (
        <>
          <div className="w-40" />
          
          <div className="flex items-center gap-2">
            {isDrawingMode && (
              <button
                type="button"
                onClick={onClearDrawing}
                className="min-w-[44px] min-h-[44px] p-3 rounded-full bg-gray-100 dark:bg-gray-800 
                           text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                title="Clear drawing"
                data-testid="button-clear-drawing"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button
              type="button"
              onClick={onToggleDrawing}
              className={`min-w-[44px] min-h-[44px] p-3 rounded-full transition-colors
                          ${isDrawingMode 
                            ? 'bg-[#EF4923] text-white' 
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                          }`}
              title={isDrawingMode ? "Exit drawing mode" : "Draw on screen"}
              data-testid="button-toggle-drawing"
            >
              {isDrawingMode ? <X className="w-5 h-5" /> : <Pencil className="w-5 h-5" />}
            </button>
          </div>
          
          <button
            type="button"
            onClick={onStartPresentation}
            className="flex items-center gap-2 text-gray-700 dark:text-gray-300 
                       hover:text-[#EF4923] dark:hover:text-[#EF4923] transition-colors
                       min-h-[44px] px-4"
            data-testid="button-start-presentation"
          >
            <span className="text-sm font-medium">Start Presentation</span>
            <ChevronRight className="w-5 h-5 flex-shrink-0" />
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={isFirst ? onHome : onPrevious}
            className="flex items-center gap-2 text-gray-700 dark:text-gray-300 
                       hover:text-[#EF4923] dark:hover:text-[#EF4923] transition-colors
                       min-h-[44px] px-2 md:px-4 min-w-[60px] max-w-[140px]"
            data-testid="button-nav-prev"
          >
            <ChevronLeft className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium truncate hidden sm:inline max-w-[100px]">
              {isFirst ? 'Home' : prevSlideTitle || 'Previous'}
            </span>
          </button>
          
          <div className="flex items-center gap-2">
            {isDrawingMode && (
              <button
                type="button"
                onClick={onClearDrawing}
                className="min-w-[44px] min-h-[44px] p-3 rounded-full bg-gray-100 dark:bg-gray-800 
                           text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                title="Clear drawing"
                data-testid="button-clear-drawing-slide"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button
              type="button"
              onClick={onToggleDrawing}
              className={`min-w-[44px] min-h-[44px] p-3 rounded-full transition-colors
                          ${isDrawingMode 
                            ? 'bg-[#EF4923] text-white' 
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                          }`}
              title={isDrawingMode ? "Exit drawing mode" : "Draw on screen"}
              data-testid="button-toggle-drawing-slide"
            >
              {isDrawingMode ? <X className="w-5 h-5" /> : <Pencil className="w-5 h-5" />}
            </button>
          </div>
          
          {!isLast ? (
            <button
              type="button"
              onClick={onNext}
              className="flex items-center gap-2 text-gray-700 dark:text-gray-300 
                         hover:text-[#EF4923] dark:hover:text-[#EF4923] transition-colors
                         min-h-[44px] px-2 md:px-4 min-w-[60px] max-w-[140px]"
              data-testid="button-nav-next"
            >
              <span className="text-sm font-medium truncate hidden sm:inline max-w-[100px]">
                {nextSlideTitle || 'Next'}
              </span>
              <ChevronRight className="w-5 h-5 flex-shrink-0" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onHome}
              className="flex items-center gap-2 text-gray-700 dark:text-gray-300 
                         hover:text-[#EF4923] dark:hover:text-[#EF4923] transition-colors
                         min-h-[44px] px-2 md:px-4"
              data-testid="button-nav-home"
            >
              <span className="text-sm font-medium">Home</span>
              <ChevronRight className="w-5 h-5 flex-shrink-0" />
            </button>
          )}
        </>
      )}
    </div>
  );
}
