import { useState, useMemo } from 'react';
import { 
  FileText, 
  Home, 
  BarChart3, 
  ChevronUp, 
  ChevronDown, 
  GripVertical 
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { CMA_REPORT_SECTIONS, EDITABLE_SECTIONS } from '@shared/cma-sections';

interface CMASectionItem {
  id: string;
  name: string;
  enabled: boolean;
  customizable?: boolean;
  customizableLabel?: string;
}

interface CMASectionCategory {
  id: 'introduction' | 'listings' | 'analysis';
  name: string;
  sections: CMASectionItem[];
}

interface ReportSectionsProps {
  includedSections: string[];
  sectionOrder: string[];
  onSectionsChange: (includedSections: string[], sectionOrder: string[]) => void;
}

const CATEGORY_ORDER: Array<'introduction' | 'listings' | 'analysis'> = ['introduction', 'listings', 'analysis'];

const CATEGORY_NAMES: Record<string, string> = {
  introduction: 'Introduction',
  listings: 'Listings',
  analysis: 'Analysis',
};

const EDITABLE_SECTION_IDS = new Set(EDITABLE_SECTIONS.map(s => s.id));

const CategoryIcon = ({ categoryId }: { categoryId: string }) => {
  switch (categoryId) {
    case 'introduction':
      return <FileText className="w-4 h-4" />;
    case 'listings':
      return <Home className="w-4 h-4" />;
    case 'analysis':
      return <BarChart3 className="w-4 h-4" />;
    default:
      return <FileText className="w-4 h-4" />;
  }
};

export function ReportSections({ 
  includedSections, 
  sectionOrder, 
  onSectionsChange 
}: ReportSectionsProps) {
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    introduction: true,
    listings: true,
    analysis: true,
  });

  const categories = useMemo((): CMASectionCategory[] => {
    return CATEGORY_ORDER.map(categoryId => ({
      id: categoryId,
      name: CATEGORY_NAMES[categoryId],
      sections: CMA_REPORT_SECTIONS
        .filter(s => s.category === categoryId)
        .map(s => ({
          id: s.id,
          name: s.name,
          enabled: includedSections.includes(s.id),
          customizable: EDITABLE_SECTION_IDS.has(s.id),
          customizableLabel: EDITABLE_SECTION_IDS.has(s.id) ? 'Customizable content' : undefined,
        })),
    }));
  }, [includedSections]);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  const toggleSection = (sectionId: string) => {
    const isCurrentlyEnabled = includedSections.includes(sectionId);
    let newIncludedSections: string[];
    
    if (isCurrentlyEnabled) {
      newIncludedSections = includedSections.filter(id => id !== sectionId);
    } else {
      newIncludedSections = [...includedSections, sectionId];
    }
    
    onSectionsChange(newIncludedSections, sectionOrder);
  };

  const moveSectionUp = (categoryId: string, sectionId: string) => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return;
    
    const categorySectionIds = category.sections.map(s => s.id);
    const orderedCategorySections = sectionOrder.filter(id => categorySectionIds.includes(id));
    const sectionIndex = orderedCategorySections.indexOf(sectionId);
    
    if (sectionIndex <= 0) return;
    
    const newOrder = [...sectionOrder];
    const globalIndex = newOrder.indexOf(sectionId);
    const prevSectionId = orderedCategorySections[sectionIndex - 1];
    const prevGlobalIndex = newOrder.indexOf(prevSectionId);
    
    [newOrder[globalIndex], newOrder[prevGlobalIndex]] = [newOrder[prevGlobalIndex], newOrder[globalIndex]];
    
    onSectionsChange(includedSections, newOrder);
  };

  const moveSectionDown = (categoryId: string, sectionId: string) => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return;
    
    const categorySectionIds = category.sections.map(s => s.id);
    const orderedCategorySections = sectionOrder.filter(id => categorySectionIds.includes(id));
    const sectionIndex = orderedCategorySections.indexOf(sectionId);
    
    if (sectionIndex >= orderedCategorySections.length - 1) return;
    
    const newOrder = [...sectionOrder];
    const globalIndex = newOrder.indexOf(sectionId);
    const nextSectionId = orderedCategorySections[sectionIndex + 1];
    const nextGlobalIndex = newOrder.indexOf(nextSectionId);
    
    [newOrder[globalIndex], newOrder[nextGlobalIndex]] = [newOrder[nextGlobalIndex], newOrder[globalIndex]];
    
    onSectionsChange(includedSections, newOrder);
  };

  const getEnabledCount = (category: CMASectionCategory) => {
    const enabled = category.sections.filter(s => includedSections.includes(s.id)).length;
    const total = category.sections.length;
    return `${enabled}/${total}`;
  };

  const getOrderedSections = (category: CMASectionCategory) => {
    const categorySectionIds = category.sections.map(s => s.id);
    const orderedIds = sectionOrder.filter(id => categorySectionIds.includes(id));
    const remainingIds = categorySectionIds.filter(id => !orderedIds.includes(id));
    const allOrderedIds = [...orderedIds, ...remainingIds];
    
    return allOrderedIds.map(id => {
      const sectionDef = category.sections.find(s => s.id === id);
      return sectionDef ? { ...sectionDef, enabled: includedSections.includes(id) } : null;
    }).filter(Boolean) as CMASectionItem[];
  };

  return (
    <div className="space-y-1">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Report Sections</h3>
        <p className="text-sm text-muted-foreground">
          Toggle sections on/off and reorder them for your presentation
        </p>
      </div>

      <div className="space-y-2">
        {categories.map((category) => {
          const orderedSections = getOrderedSections(category);
          
          return (
            <div key={category.id} className="border rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => toggleCategory(category.id)}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-3",
                  "bg-muted/50 hover:bg-muted/70 transition-colors",
                  !expandedCategories[category.id] && "border-b-0"
                )}
                data-testid={`category-${category.id}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">
                    <CategoryIcon categoryId={category.id} />
                  </span>
                  <span className="font-medium">{category.name}</span>
                  <span className="px-2 py-0.5 text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800 rounded-full">
                    {getEnabledCount(category)}
                  </span>
                </div>
                <ChevronDown 
                  className={cn(
                    "w-4 h-4 text-muted-foreground transition-transform duration-200",
                    !expandedCategories[category.id] && "rotate-180"
                  )} 
                />
              </button>

              {expandedCategories[category.id] && (
                <div className="divide-y divide-border">
                  {orderedSections.map((section, index) => (
                    <div
                      key={section.id}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3",
                        "hover:bg-muted/30 transition-colors"
                      )}
                      data-testid={`section-row-${section.id}`}
                    >
                      <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab flex-shrink-0" />

                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{section.name}</div>
                        {section.customizable && (
                          <div className="text-xs text-muted-foreground">
                            {section.customizableLabel}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveSectionUp(category.id, section.id);
                          }}
                          disabled={index === 0}
                          className={cn(
                            "p-1 rounded hover:bg-muted transition-colors",
                            index === 0 && "opacity-30 cursor-not-allowed"
                          )}
                          data-testid={`move-up-${section.id}`}
                        >
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveSectionDown(category.id, section.id);
                          }}
                          disabled={index === orderedSections.length - 1}
                          className={cn(
                            "p-1 rounded hover:bg-muted transition-colors",
                            index === orderedSections.length - 1 && "opacity-30 cursor-not-allowed"
                          )}
                          data-testid={`move-down-${section.id}`}
                        >
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </div>

                      <Switch
                        checked={includedSections.includes(section.id)}
                        onCheckedChange={() => toggleSection(section.id)}
                        className="data-[state=checked]:bg-orange-500 flex-shrink-0"
                        data-testid={`toggle-${section.id}`}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
