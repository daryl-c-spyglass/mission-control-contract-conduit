import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Coordinator } from "@shared/schema";

const formSchema = z.object({
  propertyAddress: z.string().min(5, "Please enter a valid property address"),
  mlsNumber: z.string().optional(),
  contractDate: z.string().optional(),
  closingDate: z.string().optional(),
  coordinatorIds: z.array(z.string()).default([]),
  createSlackChannel: z.boolean().default(true),
  createGmailFilter: z.boolean().default(true),
  fetchMlsData: z.boolean().default(true),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTransactionDialog({ open, onOpenChange }: CreateTransactionDialogProps) {
  const { toast } = useToast();

  const { data: coordinators = [] } = useQuery<Coordinator[]>({
    queryKey: ["/api/coordinators"],
    enabled: open,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      propertyAddress: "",
      mlsNumber: "",
      contractDate: "",
      closingDate: "",
      coordinatorIds: [],
      createSlackChannel: true,
      createGmailFilter: true,
      fetchMlsData: true,
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Transaction</DialogTitle>
          <DialogDescription>
            Enter the property details to start a new transaction. This will automatically set up integrations based on your preferences.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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

            <div className="flex justify-end gap-3">
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
