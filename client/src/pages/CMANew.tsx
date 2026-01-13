import { useState, useEffect, useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { CMABuilder } from "@/components/CMABuilder";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Property } from "@shared/schema";

export default function CMANew() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Parse URL search params for "modify" mode or "fromProperties" mode
  const params = new URLSearchParams(search);
  const fromCmaId = params.get('from');
  const fromProperties = params.get('fromProperties') === 'true';
  
  // Get pre-selected properties from Properties page (via sessionStorage)
  const [preSelectedProperties, setPreSelectedProperties] = useState<Property[]>([]);
  
  useEffect(() => {
    if (fromProperties) {
      const stored = sessionStorage.getItem('propertiesForCMA');
      if (stored) {
        try {
          const properties = JSON.parse(stored);
          setPreSelectedProperties(properties);
          // Clear sessionStorage after reading
          sessionStorage.removeItem('propertiesForCMA');
        } catch (e) {
          console.error('Failed to parse pre-selected properties:', e);
        }
      }
    }
  }, [fromProperties]);
  
  // Fetch original CMA data if modifying
  const { data: originalCma } = useQuery({
    queryKey: ['/api/cmas', fromCmaId],
    enabled: !!fromCmaId,
  });

  const createCmaMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      subjectPropertyId?: string;
      comparablePropertyIds: string[];
      propertiesData: any[];
      searchCriteria?: any;
    }) => {
      const response = await apiRequest('/api/cmas', 'POST', data);
      return response.json();
    },
    onSuccess: (cma: { id: string }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/cmas'] });
      toast({
        title: "CMA created",
        description: "Your comparative market analysis has been created successfully.",
      });
      setLocation(`/cmas/${cma.id}`);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create CMA. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCreate = (data: {
    name: string;
    subjectPropertyId?: string;
    comparablePropertyIds: string[];
    propertiesData: any[];
    searchCriteria?: any;
  }) => {
    createCmaMutation.mutate(data);
  };

  // Build initialData from original CMA if modifying
  const buildInitialData = () => {
    if (!originalCma) return undefined;
    
    const cma = originalCma as any;
    const propertiesData = cma.propertiesData || [];
    const savedSearchCriteria = cma.searchCriteria || {};
    
    // Use saved searchCriteria, falling back to extracting from properties
    // Note: neighborhood is no longer used - use subdivision instead (RESO-compliant)
    const searchCriteria = {
      city: savedSearchCriteria.city || '',
      subdivision: savedSearchCriteria.subdivision || '',
      minBeds: savedSearchCriteria.minBeds || '',
      maxPrice: savedSearchCriteria.maxPrice || '',
      statuses: savedSearchCriteria.statuses || ['active'],
      minSqft: savedSearchCriteria.minSqft || '',
      maxSqft: savedSearchCriteria.maxSqft || '',
      minLotAcres: savedSearchCriteria.minLotAcres || '',
      maxLotAcres: savedSearchCriteria.maxLotAcres || '',
      minYearBuilt: savedSearchCriteria.minYearBuilt || '',
      maxYearBuilt: savedSearchCriteria.maxYearBuilt || '',
      stories: savedSearchCriteria.stories || '',
      soldDays: savedSearchCriteria.soldDays || '',
    };
    
    // If no saved criteria, try to infer from properties
    if (!cma.searchCriteria && propertiesData.length > 0) {
      const firstProp = propertiesData[0];
      if (firstProp.city) searchCriteria.city = firstProp.city;
      if (firstProp.subdivisionName) searchCriteria.subdivision = firstProp.subdivisionName;
      
      // Extract statuses from properties
      const statuses = new Set<string>();
      propertiesData.forEach((p: any) => {
        if (p.standardStatus === 'Active') statuses.add('active');
        else if (p.standardStatus === 'Active Under Contract' || p.standardStatus === 'Pending') statuses.add('under_contract');
        else if (p.standardStatus === 'Closed') statuses.add('closed');
      });
      if (statuses.size > 0) {
        searchCriteria.statuses = Array.from(statuses);
      }
    }
    
    // Separate subject property from comparables
    const subjectId = cma.subjectPropertyId;
    const subjectProperty = subjectId 
      ? propertiesData.find((p: any) => p.id === subjectId) || null
      : null;
    const comparables = subjectId
      ? propertiesData.filter((p: any) => p.id !== subjectId)
      : propertiesData;
    
    // Append "(Modified)" only if not already present
    let modifiedName = cma.name || 'CMA';
    if (!modifiedName.includes('(Modified)')) {
      modifiedName = `${modifiedName} (Modified)`;
    }
    
    return {
      name: modifiedName,
      searchCriteria,
      comparables: comparables as Property[],
      subjectProperty: subjectProperty as Property | null,
    };
  };

  const initialData = buildInitialData();
  
  // Build initial data from pre-selected properties (from Properties page)
  const propertiesInitialData = useMemo(() => {
    if (!fromProperties || preSelectedProperties.length === 0) return undefined;
    
    // Infer search criteria from selected properties
    const firstProp = preSelectedProperties[0];
    const statuses = new Set<string>();
    preSelectedProperties.forEach((p: any) => {
      if (p.standardStatus === 'Active') statuses.add('active');
      else if (p.standardStatus === 'Active Under Contract' || p.standardStatus === 'Pending') statuses.add('under_contract');
      else if (p.standardStatus === 'Closed') statuses.add('closed');
    });
    
    return {
      name: 'Quick CMA',
      searchCriteria: {
        city: firstProp?.city || '',
        subdivision: (firstProp as any)?.subdivisionName || '',
        statuses: Array.from(statuses).length > 0 ? Array.from(statuses) : ['active'],
        minBeds: '',
        maxPrice: '',
        minSqft: '',
        maxSqft: '',
        minLotAcres: '',
        maxLotAcres: '',
        minYearBuilt: '',
        maxYearBuilt: '',
        stories: '',
        soldDays: '',
      },
      comparables: preSelectedProperties,
      subjectProperty: null,
    };
  }, [fromProperties, preSelectedProperties]);
  
  // Use properties initial data if available, otherwise use CMA modify data
  const finalInitialData = propertiesInitialData || initialData;
  
  // Determine the title and description
  const pageTitle = fromProperties ? 'Quick CMA' : (fromCmaId ? 'Modify CMA' : 'Create New CMA');
  const pageDescription = fromProperties 
    ? `Create a CMA with ${preSelectedProperties.length} pre-selected properties`
    : (fromCmaId 
        ? 'Modify your search criteria and comparables to create an updated CMA'
        : 'Build a comprehensive comparative market analysis for your clients'
      );

  return (
    <div className="space-y-6">
      <div>
        <Link href={fromProperties ? "/properties" : "/cmas"}>
          <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back-to-cmas">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {fromProperties ? 'Back to Properties' : 'Back to CMAs'}
          </Button>
        </Link>
        <h1 className="text-3xl font-bold" data-testid="text-new-cma-title">
          {pageTitle}
        </h1>
        <p className="text-muted-foreground mt-2">
          {pageDescription}
        </p>
      </div>

      <CMABuilder onCreateCMA={handleCreate} initialData={finalInitialData} />
    </div>
  );
}


