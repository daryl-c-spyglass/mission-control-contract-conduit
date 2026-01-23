export function MarketingWidget() {
  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900" data-testid="marketing-widget">
      <div className="flex-1 overflow-auto p-6 md:p-10">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-6">
              Where are homebuyers looking for information?
            </h2>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              One of our top priorities is making sure we market your property in the places 
              your future buyer is looking. We take a look at marketing- and buyer-behavior 
              trends to determine where to invest our resources. The latest data indicates 
              we need to invest in our website, our signage and marketing materials, and 
              our continued professional development.
            </p>
          </div>

          <div>
            <img
              src="/cma-widgets/marketing-infographic.png"
              alt="How We Drive Interest To Your Property - Private Facebook Groups and Google SEO"
              className="w-full h-auto"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
