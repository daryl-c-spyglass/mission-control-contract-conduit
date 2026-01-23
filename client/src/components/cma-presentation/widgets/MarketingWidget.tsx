import { MARKETING_TEXT } from '../constants/widgets';

export function MarketingWidget() {
  return (
    <div className="flex flex-col h-full bg-background" data-testid="marketing-widget">
      <div className="bg-gray-900 text-white py-3 px-4 text-center flex-shrink-0">
        <span className="font-bold tracking-wider text-sm uppercase">
          MARKETING
        </span>
      </div>
      
      <div className="flex-1 overflow-auto p-6 md:p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="text-center space-y-4">
            <h2 className="text-2xl md:text-3xl font-bold">
              Where are homebuyers looking for information?
            </h2>
            <p className="text-base md:text-lg leading-relaxed text-muted-foreground">
              One of our top priorities is making sure we market your property in the places your future buyer is looking. We take a look at marketing- and buyer-behavior trends to determine where to invest our resources. The latest data indicates we need to invest in our website, our signage and marketing materials, and our continued professional development.
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-6 mt-8">
            <h3 className="text-xl font-bold text-center mb-6 uppercase tracking-wide">
              How We Drive Interest to Your Property
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-background rounded-lg p-4 text-center">
                <span className="text-4xl font-bold text-[#F37216]">96%</span>
                <p className="text-sm text-muted-foreground mt-2">
                  Of buyers search online during their home search
                </p>
              </div>
              <div className="bg-background rounded-lg p-4 text-center">
                <span className="text-4xl font-bold text-[#F37216]">52%</span>
                <p className="text-sm text-muted-foreground mt-2">
                  Of buyers found their home through the internet
                </p>
              </div>
              <div className="bg-background rounded-lg p-4 text-center">
                <span className="text-4xl font-bold text-[#F37216]">28%</span>
                <p className="text-sm text-muted-foreground mt-2">
                  Of buyers found their home through an agent
                </p>
              </div>
              <div className="bg-background rounded-lg p-4 text-center">
                <span className="text-4xl font-bold text-[#F37216]">8%</span>
                <p className="text-sm text-muted-foreground mt-2">
                  Of buyers found their home through yard signs
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
