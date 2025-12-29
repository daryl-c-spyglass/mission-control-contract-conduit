import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, ChevronDown, ChevronUp, User, Check } from "lucide-react";
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Coordinator } from "@shared/schema";

const formSchema = z.object({
  transactionType: z.enum(["buy", "sell"]).default("buy"),
  propertyAddress: z.string().min(5, "Please enter a valid property address"),
  mlsNumber: z.string().optional(),
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

  const { data: coordinators = [] } = useQuery<Coordinator[]>({
    queryKey: ["/api/coordinators"],
    enabled: open,
  });

  const [onBehalfExpanded, setOnBehalfExpanded] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      transactionType: "buy",
      propertyAddress: "",
      mlsNumber: "",
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
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Create New Transaction</DialogTitle>
          <DialogDescription>
            Enter the property details to start a new transaction. This will automatically set up integrations based on your preferences.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 overflow-y-auto flex-1 pr-2">
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

            <FormField
              control={form.control}
              name="propertyAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Property Address</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="123 Main St, City, State 12345"
                      data-testid="input-property-address"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="mlsNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>MLS Number</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="MLS123456"
                      className="font-mono"
                      data-testid="input-mls-number"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Used to fetch property data from MLS
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

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

            <div className="grid grid-cols-2 gap-4">
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

            {coordinators.length > 0 && (
              <FormField
                control={form.control}
                name="coordinatorIds"
                render={() => (
                  <FormItem>
                    <FormLabel>Transaction Coordinators</FormLabel>
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
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

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

            <div className="flex justify-end gap-3 pt-4 pb-2 sticky bottom-0 bg-background border-t mt-4">
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
