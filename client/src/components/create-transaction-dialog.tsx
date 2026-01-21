import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, ChevronDown, ChevronUp, User, Check, X, Bed, Bath, Square, DollarSign, Home, Ruler } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { usePropertySearch, type PropertySearchResult, type PlacePrediction } from "@/hooks/usePropertySearch";
import { PropertyAutocomplete } from "@/components/ui/property-autocomplete";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PROPERTY_TYPES, PROPERTY_TYPE_CATEGORIES, getPropertyTypesByCategory } from "@/lib/propertyTypes";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import type { Coordinator } from "@shared/schema";

const formSchema = z.object({
  transactionType: z.enum(["buy", "sell"]).default("buy"),
  isCompanyLead: z.boolean().default(false),
  propertyAddress: z.string().min(5, "Please enter a valid property address"),
  mlsNumber: z.string().optional(),
  isOffMarket: z.boolean().default(false),
  isUnderContract: z.boolean().default(true),
  // Off Market property details
  propertyDescription: z.string().optional(),
  listPrice: z.string().optional(),
  propertyType: z.string().optional(),
  sqft: z.string().optional(),
  lotSizeAcres: z.string().optional(),
  bedrooms: z.string().optional(),
  bathrooms: z.string().optional(),
  halfBaths: z.string().optional(),
  // Dates and other fields
  contractDate: z.string().optional(),
  closingDate: z.string().optional(),
  coordinatorIds: z.array(z.string()).default([]),
  fubClientId: z.string().optional(),
  fubClientName: z.string().optional(),
  fubClientEmail: z.string().optional(),
  fubClientPhone: z.string().optional(),
  createSlackChannel: z.boolean().default(true),
  createGmailFilter: z.boolean().default(true),
  fetchMlsData: z.boolean().default(true),
  onBehalfOfEmail: z.string().optional(),
  onBehalfOfSlackId: z.string().optional(),
  onBehalfOfName: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface FUBContact {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
}

interface CreateTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTransactionDialog({ open, onOpenChange }: CreateTransactionDialogProps) {
  const { toast } = useToast();
  const [fubUrl, setFubUrl] = useState("");
  const [fubExpanded, setFubExpanded] = useState(false);
  const [fubContact, setFubContact] = useState<FUBContact | null>(null);
  
  // MLS Autocomplete state
  const [addressInput, setAddressInput] = useState("");
  const [mlsInput, setMlsInput] = useState("");
  const [selectedProperty, setSelectedProperty] = useState<PropertySearchResult | null>(null);
  
  const debouncedAddress = useDebounce(addressInput, 300);
  const debouncedMls = useDebounce(mlsInput, 300);
  
  const { 
    placePredictions,
    mlsResults, 
    isSearchingAddress, 
    isSearchingMls, 
    searchByAddress, 
    searchByMlsNumber,
    clearResults 
  } = usePropertySearch();
  
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  
  // Search by address when input changes
  useEffect(() => {
    if (debouncedAddress && debouncedAddress.length >= 3 && !selectedProperty) {
      searchByAddress(debouncedAddress);
    }
  }, [debouncedAddress, searchByAddress, selectedProperty]);
  
  // Search by MLS when input changes
  useEffect(() => {
    if (debouncedMls && debouncedMls.length >= 3 && !selectedProperty) {
      searchByMlsNumber(debouncedMls);
    }
  }, [debouncedMls, searchByMlsNumber, selectedProperty]);
  
  // Handle property selection - fills both address and MLS
  const handlePropertySelect = (property: PropertySearchResult) => {
    setSelectedProperty(property);
    setAddressInput(property.fullAddress);
    setMlsInput(property.mlsNumber);
    form.setValue("propertyAddress", property.fullAddress);
    form.setValue("mlsNumber", property.mlsNumber);
    clearResults();
    toast({
      title: "Property selected",
      description: `${property.fullAddress} (MLS# ${property.mlsNumber})`,
    });
  };
  
  // Clear selection
  const handleClearSelection = () => {
    setSelectedProperty(null);
    setAddressInput("");
    setMlsInput("");
    form.setValue("propertyAddress", "");
    form.setValue("mlsNumber", "");
    clearResults();
  };
  
  // Format price helper
  const formatPrice = (price?: number) => {
    if (!price) return '';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(price);
  };

  const { data: coordinators = [], isLoading: coordinatorsLoading, error: coordinatorsError, status } = useQuery<Coordinator[]>({
    queryKey: ["/api/coordinators"],
    queryFn: async () => {
      console.log("[DEBUG] Fetching coordinators...");
      const res = await fetch("/api/coordinators");
      console.log("[DEBUG] Coordinators response status:", res.status);
      if (!res.ok) {
        throw new Error(`Failed to fetch coordinators: ${res.status}`);
      }
      const data = await res.json();
      console.log("[DEBUG] Coordinators data:", data);
      return data;
    },
    enabled: open,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });
  
  console.log("[DEBUG] Coordinators query - open:", open, "status:", status, "loading:", coordinatorsLoading, "error:", coordinatorsError, "count:", coordinators.length);

  const [onBehalfExpanded, setOnBehalfExpanded] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      transactionType: "buy",
      isCompanyLead: false,
      propertyAddress: "",
      mlsNumber: "",
      isOffMarket: false,
      isUnderContract: true,
      propertyDescription: "",
      listPrice: "",
      propertyType: "Residential",
      sqft: "",
      lotSizeAcres: "",
      bedrooms: "",
      bathrooms: "",
      halfBaths: "",
      contractDate: "",
      closingDate: "",
      coordinatorIds: [],
      fubClientId: "",
      fubClientName: "",
      fubClientEmail: "",
      fubClientPhone: "",
      createSlackChannel: true,
      createGmailFilter: true,
      fetchMlsData: true,
      onBehalfOfEmail: "",
      onBehalfOfSlackId: "",
      onBehalfOfName: "",
    },
  });
  
  // Watch isOffMarket to auto-uncheck isUnderContract and clear MLS number
  const isOffMarket = form.watch("isOffMarket");
  
  useEffect(() => {
    if (isOffMarket) {
      form.setValue("isUnderContract", false);
      form.setValue("mlsNumber", "");
      setMlsInput("");
      setSelectedProperty(null);
      clearResults();
    }
  }, [isOffMarket, form, clearResults]);

  const pullFubMutation = useMutation({
    mutationFn: async (url: string) => {
      const res = await fetch(`/api/fub/contact-from-url?url=${encodeURIComponent(url)}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to fetch contact");
      }
      return res.json() as Promise<FUBContact>;
    },
    onSuccess: (contact) => {
      setFubContact(contact);
      const fullName = `${contact.firstName} ${contact.lastName}`.trim();
      form.setValue("fubClientId", String(contact.id));
      form.setValue("fubClientName", fullName);
      form.setValue("fubClientEmail", contact.email || "");
      form.setValue("fubClientPhone", contact.phone || "");
      toast({
        title: "Client details loaded",
        description: `Loaded information for ${fullName}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const res = await apiRequest("POST", "/api/transactions", data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Transaction created",
        description: "Your new transaction has been set up successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      form.reset();
      setFubUrl("");
      setFubContact(null);
      setFubExpanded(false);
      setAddressInput("");
      setMlsInput("");
      setSelectedProperty(null);
      clearResults();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create transaction",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormValues) => {
    createMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Transaction</DialogTitle>
          <DialogDescription>
            Enter the property details to start a new transaction. This will automatically set up integrations based on your preferences.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="create-transaction-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="transactionType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Our Agent Represents</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-transaction-type">
                        <SelectValue placeholder="Select buyer or seller" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="buy">Buyer</SelectItem>
                      <SelectItem value="sell">Seller</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Is Company Lead Checkbox */}
            <FormField
              control={form.control}
              name="isCompanyLead"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="checkbox-is-company-lead"
                    />
                  </FormControl>
                  <FormLabel className="text-sm font-normal cursor-pointer">
                    Is Company Lead
                  </FormLabel>
                </FormItem>
              )}
            />

            <div className="border-t my-2" />

            {/* MLS Number with Autocomplete - NOW FIRST */}
            <FormField
              control={form.control}
              name="mlsNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>MLS Number</FormLabel>
                  <FormControl>
                    <PropertyAutocomplete
                      value={mlsInput}
                      onChange={(value) => {
                        setMlsInput(value);
                        field.onChange(value);
                        // Clear selection when user edits the MLS number
                        if (selectedProperty && value !== selectedProperty.mlsNumber) {
                          setSelectedProperty(null);
                        }
                      }}
                      onSelect={handlePropertySelect}
                      options={selectedProperty ? [] : mlsResults}
                      isLoading={isSearchingMls}
                      placeholder="ACT2572987 or 2572987"
                      type="mls"
                      helperText="Enter with or without ACT prefix"
                      testId="input-mls-number"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Property Address with Google Places Autocomplete - NOW SECOND */}
            <FormField
              control={form.control}
              name="propertyAddress"
              render={({ field }) => (
                <FormItem className="relative">
                  <FormLabel>Property Address</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        value={addressInput}
                        onChange={(e) => {
                          const value = e.target.value;
                          setAddressInput(value);
                          field.onChange(value);
                          setShowAddressSuggestions(true);
                          if (selectedProperty && value !== selectedProperty.fullAddress) {
                            setSelectedProperty(null);
                          }
                        }}
                        onFocus={() => setShowAddressSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowAddressSuggestions(false), 200)}
                        placeholder="Start typing address..."
                        data-testid="input-property-address"
                      />
                      {isSearchingAddress && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        </div>
                      )}
                      {showAddressSuggestions && placePredictions.length > 0 && !selectedProperty && (
                        <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto">
                          {placePredictions.map((prediction) => (
                            <button
                              key={prediction.placeId}
                              type="button"
                              className="w-full px-3 py-2 text-left hover:bg-accent focus:bg-accent focus:outline-none text-sm"
                              onClick={() => {
                                setAddressInput(prediction.description);
                                field.onChange(prediction.description);
                                setShowAddressSuggestions(false);
                                clearResults();
                              }}
                            >
                              <div className="font-medium">{prediction.mainText}</div>
                              <div className="text-xs text-muted-foreground">{prediction.secondaryText}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Selected Property Confirmation Card */}
            {selectedProperty && !isOffMarket && (
              <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                <div className="p-3 flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/50 shrink-0">
                    <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm text-green-800 dark:text-green-200">
                          Property Found in MLS
                        </p>
                        <p className="text-sm text-green-700 dark:text-green-300 mt-0.5 truncate">
                          {selectedProperty.fullAddress}
                        </p>
                        <p className="text-xs text-green-600 dark:text-green-400 font-mono">
                          MLS# {selectedProperty.mlsNumber}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleClearSelection}
                        className="h-6 w-6 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-800"
                        data-testid="button-clear-property"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-green-600 dark:text-green-400">
                      {selectedProperty.listPrice && (
                        <span className="flex items-center gap-1 font-medium">
                          <DollarSign className="w-3 h-3" />
                          {formatPrice(selectedProperty.listPrice)}
                        </span>
                      )}
                      {selectedProperty.beds && (
                        <span className="flex items-center gap-1">
                          <Bed className="w-3 h-3" />
                          {selectedProperty.beds} bed
                        </span>
                      )}
                      {selectedProperty.baths && (
                        <span className="flex items-center gap-1">
                          <Bath className="w-3 h-3" />
                          {selectedProperty.baths} bath
                        </span>
                      )}
                      {selectedProperty.sqft && (
                        <span className="flex items-center gap-1">
                          <Square className="w-3 h-3" />
                          {selectedProperty.sqft.toLocaleString()} sqft
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Off Market Checkbox */}
            <FormField
              control={form.control}
              name="isOffMarket"
              render={({ field }) => (
                <FormItem className="flex items-start gap-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="checkbox-off-market"
                    />
                  </FormControl>
                  <div className="space-y-1">
                    <FormLabel className="text-sm font-normal cursor-pointer">
                      Off Market
                    </FormLabel>
                    <FormDescription className="text-xs">
                      Check if this property is not listed in MLS
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            {/* Off Market Property Details Section */}
            {isOffMarket && (
              <Card className="p-4 space-y-4 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
                  <Home className="w-4 h-4" />
                  <span className="font-medium text-sm">Off Market Property Details</span>
                </div>

                {/* Listing Description */}
                <FormField
                  control={form.control}
                  name="propertyDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Listing Description</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Describe the property..."
                          className="min-h-[80px] resize-none"
                          data-testid="input-property-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Price and Property Type */}
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="listPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Listing Price</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              {...field}
                              type="number"
                              placeholder="450000"
                              className="pl-9"
                              data-testid="input-list-price"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="propertyType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Property Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-property-type">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {PROPERTY_TYPE_CATEGORIES.map((category) => (
                              <SelectGroup key={category}>
                                <SelectLabel className="text-xs text-muted-foreground font-medium">{category}</SelectLabel>
                                {getPropertyTypesByCategory(category).map((type) => (
                                  <SelectItem key={type.value} value={type.value}>
                                    {type.label}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Sqft and Lot Size */}
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="sqft"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Square Feet</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Square className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              {...field}
                              type="number"
                              placeholder="2500"
                              className="pl-9"
                              data-testid="input-sqft"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lotSizeAcres"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Lot Size (Acres)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              {...field}
                              type="number"
                              step="0.01"
                              placeholder="0.25"
                              className="pl-9"
                              data-testid="input-lot-size"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Bedrooms, Full Baths, Half Baths */}
                <div className="grid grid-cols-3 gap-3">
                  <FormField
                    control={form.control}
                    name="bedrooms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Bedrooms</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Bed className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              {...field}
                              type="number"
                              placeholder="4"
                              className="pl-9"
                              data-testid="input-bedrooms"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="bathrooms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Full Baths</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Bath className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              {...field}
                              type="number"
                              placeholder="2"
                              className="pl-9"
                              data-testid="input-bathrooms"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="halfBaths"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Half Baths</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Bath className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              {...field}
                              type="number"
                              placeholder="1"
                              className="pl-9"
                              data-testid="input-half-baths"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </Card>
            )}

            <Collapsible open={fubExpanded} onOpenChange={setFubExpanded}>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full justify-between text-primary"
                  data-testid="button-toggle-fub"
                >
                  Pull lead details from Follow Up Boss
                  {fubExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-2">
                <div className="flex items-end gap-2 flex-wrap">
                  <div className="flex-1 min-w-[200px] space-y-2">
                    <Input
                      placeholder="Paste Follow Up Boss lead URL, e.g. https://yourteam.followupboss.com/2/people/view/123456"
                      value={fubUrl}
                      onChange={(e) => setFubUrl(e.target.value)}
                      data-testid="input-fub-url"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={() => pullFubMutation.mutate(fubUrl)}
                    disabled={pullFubMutation.isPending || !fubUrl}
                    data-testid="button-pull-fub"
                  >
                    {pullFubMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Pull Details"
                    )}
                  </Button>
                </div>

                {fubContact && (
                  <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50 border">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{form.watch("fubClientName")}</p>
                      <p className="text-sm text-muted-foreground">
                        {form.watch("fubClientEmail")} {form.watch("fubClientPhone") && `| ${form.watch("fubClientPhone")}`}
                      </p>
                    </div>
                    <Check className="h-5 w-5 text-green-600" />
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>

            {form.watch("transactionType") === "sell" && (
              <FormField
                control={form.control}
                name="isUnderContract"
                render={({ field }) => (
                  <FormItem className={`flex items-center gap-3 space-y-0 rounded-md border p-3 ${isOffMarket ? 'opacity-50' : ''}`}>
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isOffMarket}
                        data-testid="checkbox-under-contract"
                      />
                    </FormControl>
                    <div className="space-y-1">
                      <FormLabel className={`cursor-pointer ${isOffMarket ? 'text-muted-foreground' : ''}`}>Under contract?</FormLabel>
                      <FormDescription className="text-xs">
                        {isOffMarket 
                          ? 'Auto-unchecked for off-market listings'
                          : 'Uncheck if this is a new listing not yet under contract'
                        }
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            )}

            <div className={`grid gap-4 ${form.watch("transactionType") === "sell" && !form.watch("isUnderContract") ? "grid-cols-1" : "grid-cols-2"}`}>
              {(form.watch("transactionType") === "buy" || form.watch("isUnderContract")) && (
                <FormField
                  control={form.control}
                  name="contractDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contract Date</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          data-testid="input-contract-date"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="closingDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expected Closing</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        data-testid="input-closing-date"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-3 rounded-md border p-4 bg-muted/30">
              <p className="text-sm font-medium">Assign Transaction Coordinators</p>
              {coordinatorsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading coordinators...
                </div>
              ) : coordinatorsError ? (
                <p className="text-sm text-destructive">Failed to load coordinators: {String(coordinatorsError)}</p>
              ) : coordinators.length === 0 ? (
                <p className="text-sm text-muted-foreground">No coordinators configured</p>
              ) : (
                    <div className="space-y-2">
                      {coordinators.map((coordinator) => (
                        <FormField
                          key={coordinator.id}
                          control={form.control}
                          name="coordinatorIds"
                          render={({ field }) => (
                            <FormItem className="flex items-center gap-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(coordinator.id)}
                                  onCheckedChange={(checked) => {
                                    const updated = checked
                                      ? [...(field.value || []), coordinator.id]
                                      : (field.value || []).filter((id) => id !== coordinator.id);
                                    field.onChange(updated);
                                  }}
                                  data-testid={`checkbox-coordinator-${coordinator.id}`}
                                />
                              </FormControl>
                              <div className="flex-1">
                                <p className="text-sm font-medium">{coordinator.name}</p>
                                <p className="text-xs text-muted-foreground">{coordinator.email}</p>
                              </div>
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
              )}
            </div>

            <Collapsible open={onBehalfExpanded} onOpenChange={setOnBehalfExpanded}>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full justify-between text-muted-foreground"
                  data-testid="button-toggle-on-behalf"
                >
                  Creating on behalf of another agent?
                  {onBehalfExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-2">
                <p className="text-xs text-muted-foreground">
                  If you're creating this transaction for another agent, enter their details below. They'll be invited to the Slack channel and the Gmail filter will be set up for their inbox.
                </p>
                <FormField
                  control={form.control}
                  name="onBehalfOfName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agent Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Joey Wilkes"
                          data-testid="input-on-behalf-name"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Used for the Slack channel name
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="onBehalfOfEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agent Email</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="agent@spyglassrealty.com"
                          data-testid="input-on-behalf-email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="onBehalfOfSlackId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agent Slack User ID</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="U012ABC34DE"
                          className="font-mono"
                          data-testid="input-on-behalf-slack"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Find this by clicking on their profile in Slack, then "Copy member ID"
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CollapsibleContent>
            </Collapsible>

            <div className="space-y-3 rounded-md border p-4 bg-muted/30">
              <p className="text-sm font-medium">Automatic Setup</p>
              
              <FormField
                control={form.control}
                name="createSlackChannel"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-create-slack"
                      />
                    </FormControl>
                    <div>
                      <p className="text-sm">Create Slack channel</p>
                      <p className="text-xs text-muted-foreground">Invite coordinators automatically</p>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="createGmailFilter"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-create-gmail"
                      />
                    </FormControl>
                    <div>
                      <p className="text-sm">Create Gmail filter</p>
                      <p className="text-xs text-muted-foreground">Route emails with this address to Slack</p>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fetchMlsData"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-fetch-mls"
                      />
                    </FormControl>
                    <div>
                      <p className="text-sm">Fetch MLS data</p>
                      <p className="text-xs text-muted-foreground">Pull property info and CMA from Repliers</p>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                data-testid="button-submit-transaction"
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Transaction
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
