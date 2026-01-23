import { Check } from 'lucide-react';

const ACTION_ITEMS = [
  'Pre-listing appointment',
  'Staging Consultation',
  'Pricing analysis',
  'Listing preparation',
  'Marketing period',
  'Offer & negotiation',
  'Contingency period',
  'Closing',
];

export function ListingActionPlanWidget() {
  return (
    <div className="flex flex-col h-full bg-background" data-testid="listing-action-plan-widget">
      <div className="flex-1 overflow-auto p-6 md:p-8">
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h2 className="text-2xl md:text-3xl font-bold">
              WHAT'S NEXT?
            </h2>
            <p className="text-lg text-[#EF4923] font-medium">
              Keeping you on top of the process.
            </p>
          </div>

          <p className="text-base md:text-lg leading-relaxed text-muted-foreground text-center">
            Once we have negotiated and agreed to the terms on the contract, our next goal is to manage each and every step of the process to ensure your property closes successfully. There are countless details and loose ends to handle leading up to closing and we make sure you're always informed of WHAT'S NEXT. You can be confident that we will be as detail-oriented during the post-contract phase as we were during the marketing phase. We'll continue to keep you up-to-date on the status of the closing process and will work diligently to ensure the closing is as smooth and problem-free as possible.
          </p>

          <div className="space-y-3 max-w-md mx-auto">
            {ACTION_ITEMS.map((item, index) => (
              <div 
                key={index}
                className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
              >
                <div className="w-8 h-8 rounded-full bg-[#EF4923] flex items-center justify-center flex-shrink-0">
                  <Check className="w-4 h-4 text-white" />
                </div>
                <span className="font-medium">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
