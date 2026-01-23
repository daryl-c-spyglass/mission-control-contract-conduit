import { ChevronLeft, ChevronRight, Pencil } from 'lucide-react';

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
          
          <button
            onClick={onToggleDrawing}
            className={`min-w-[44px] min-h-[44px] p-3 rounded-full transition-colors
                        ${isDrawingMode 
                          ? 'bg-[#F37216] text-white' 
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
            title="Draw on screen"
            data-testid="button-toggle-drawing"
          >
            <Pencil className="w-5 h-5" />
          </button>
          
          <button
            onClick={onStartPresentation}
            className="flex items-center gap-2 text-gray-700 dark:text-gray-300 
                       hover:text-[#F37216] dark:hover:text-[#F37216] transition-colors
                       min-h-[44px] px-4"
            data-testid="button-start-presentation"
          >
            <span className="text-sm font-medium">Start Presentation</span>
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      ) : (
        <>
          <button
            onClick={isFirst ? onHome : onPrevious}
            className="flex items-center gap-2 text-gray-700 dark:text-gray-300 
                       hover:text-[#F37216] dark:hover:text-[#F37216] transition-colors
                       min-h-[44px] px-2 md:px-4 max-w-[200px]"
            data-testid="button-nav-prev"
          >
            <ChevronLeft className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium truncate hidden sm:block">
              {isFirst ? 'Home' : prevSlideTitle || 'Previous'}
            </span>
          </button>
          
          <button
            onClick={onToggleDrawing}
            className={`min-w-[44px] min-h-[44px] p-3 rounded-full transition-colors
                        ${isDrawingMode 
                          ? 'bg-[#F37216] text-white' 
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
            title="Draw on screen"
            data-testid="button-toggle-drawing-slide"
          >
            <Pencil className="w-5 h-5" />
          </button>
          
          {!isLast ? (
            <button
              onClick={onNext}
              className="flex items-center gap-2 text-gray-700 dark:text-gray-300 
                         hover:text-[#F37216] dark:hover:text-[#F37216] transition-colors
                         min-h-[44px] px-2 md:px-4 max-w-[200px]"
              data-testid="button-nav-next"
            >
              <span className="text-sm font-medium truncate hidden sm:block">
                {nextSlideTitle || 'Next'}
              </span>
              <ChevronRight className="w-5 h-5 flex-shrink-0" />
            </button>
          ) : (
            <button
              onClick={onHome}
              className="flex items-center gap-2 text-gray-700 dark:text-gray-300 
                         hover:text-[#F37216] dark:hover:text-[#F37216] transition-colors
                         min-h-[44px] px-2 md:px-4"
              data-testid="button-nav-home"
            >
              <span className="text-sm font-medium">Home</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </>
      )}
    </div>
  );
}
