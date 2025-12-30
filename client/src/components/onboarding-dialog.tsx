import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface OnboardingDialogProps {
  open: boolean;
  onComplete: () => void;
}

export function OnboardingDialog({ open, onComplete }: OnboardingDialogProps) {
  const [slackUserId, setSlackUserId] = useState("");
  const [emailConsent, setEmailConsent] = useState(false);
  const { toast } = useToast();

  const saveMutation = useMutation({
    mutationFn: async (data: { slackUserId: string; emailFilterConsent: boolean }) => {
      // Save onboarding preferences
      const response = await fetch("/api/user/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to save");
      
      // Process any pending Gmail filters if consent was given
      if (data.emailFilterConsent) {
        try {
          await fetch("/api/user/process-pending-filters", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          });
        } catch (e) {
          console.log("Failed to process pending filters:", e);
        }
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Setup Complete",
        description: "Your preferences have been saved. Email filtering is now active for your transactions.",
      });
      onComplete();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save your preferences. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!slackUserId.trim()) {
      toast({
        title: "Slack ID Required",
        description: "Please enter your Slack Member ID to continue.",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate({ slackUserId: slackUserId.trim(), emailFilterConsent: emailConsent });
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-lg" 
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle data-testid="text-onboarding-title">Welcome to Contract Conduit</DialogTitle>
          <DialogDescription>
            Complete this one-time setup to enable email filtering for your transactions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Label htmlFor="slackUserId" className="text-base font-medium">
              Your Slack Member ID
            </Label>
            <Input
              id="slackUserId"
              data-testid="input-slack-user-id"
              value={slackUserId}
              onChange={(e) => setSlackUserId(e.target.value)}
              placeholder="e.g., U091PN7Q490"
            />
            <div className="text-sm text-muted-foreground space-y-2">
              <p className="font-medium">How to find your Slack Member ID:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Open Slack and click on your profile photo in the bottom left</li>
                <li>Click "Profile" to open your profile screen</li>
                <li>Click the three dots (...) next to "Set Status" and "View As"</li>
                <li>Select "Copy Member ID" from the dropdown</li>
                <li>Paste it here</li>
              </ol>
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="emailConsent"
                data-testid="checkbox-email-consent"
                checked={emailConsent}
                onCheckedChange={(checked) => setEmailConsent(checked === true)}
                className="mt-1"
              />
              <div className="space-y-1">
                <Label htmlFor="emailConsent" className="text-base font-medium cursor-pointer">
                  Enable Email Filtering
                </Label>
                <p className="text-sm text-muted-foreground">
                  I consent to having emails with transaction property addresses automatically 
                  filtered and forwarded to the appropriate Slack channels. This helps keep all 
                  transaction communication in one place.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button
            data-testid="button-complete-onboarding"
            onClick={handleSubmit}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? "Saving..." : "Complete Setup"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
