import { Star, ExternalLink, MoreVertical } from 'lucide-react';
import { GOOGLE_REVIEWS_URL, SAMPLE_REVIEWS, type Review } from '../constants/widgets';

export function ClientTestimonialsWidget() {
  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900" data-testid="client-testimonials-widget">
      <div className="flex-1 overflow-auto">
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {SAMPLE_REVIEWS.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      </div>
      
      <div className="border-t border-gray-200 dark:border-gray-700 p-4 md:p-6 bg-white dark:bg-gray-900">
        <a
          href={GOOGLE_REVIEWS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 text-[#EF4923] hover:text-[#D13D1A] 
                     font-medium transition-colors min-h-[44px]"
          data-testid="link-google-reviews"
        >
          <span>Click to read all of our reviews on Google!</span>
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <div className="p-4 md:p-6" data-testid={`review-card-${review.id}`}>
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white 
                     font-semibold text-lg flex-shrink-0"
          style={{ backgroundColor: review.avatarColor }}
        >
          {review.authorInitial}
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="text-gray-500 dark:text-gray-400 text-sm">{review.reviewCount}</p>
          
          <div className="flex items-center gap-2 mt-0.5">
            <div className="flex items-center">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`w-4 h-4 ${
                    i < review.rating 
                      ? 'text-yellow-400 fill-yellow-400' 
                      : 'text-gray-300 dark:text-gray-600'
                  }`}
                />
              ))}
            </div>
            
            <span className="text-gray-500 dark:text-gray-400 text-sm">{review.timeAgo}</span>
          </div>
        </div>
        
        <button 
          type="button"
          className="text-gray-400 dark:text-gray-500 p-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="More options"
        >
          <MoreVertical className="w-5 h-5" />
        </button>
      </div>
      
      {review.positiveHighlights && review.positiveHighlights.length > 0 && (
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          <span className="font-medium text-gray-700 dark:text-gray-300">Positive: </span>
          {review.positiveHighlights.join(', ')}
        </p>
      )}
      
      <p className="mt-3 text-gray-800 dark:text-gray-200 leading-relaxed text-sm md:text-base">
        {review.text}
      </p>
    </div>
  );
}
