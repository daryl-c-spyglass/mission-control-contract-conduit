import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Trash2, Loader2, UserPlus, Save, Mail, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Coordinator } from "@shared/schema";

export default function Settings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteCoordinator, setDeleteCoordinator] = useState<Coordinator | null>(null);
  const [mySlackUserId, setMySlackUserId] = useState("");
  const [newCoordinator, setNewCoordinator] = useState({
    name: "",
    email: "",
    phone: "",
    slackUserId: "",
  });

  useEffect(() => {
    if (user?.slackUserId) {
      setMySlackUserId(user.slackUserId);
    }
  }, [user]);

  const { data: coordinators = [], isLoading } = useQuery<Coordinator[]>({
    queryKey: ["/api/coordinators"],
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { slackUserId: string }) => {
      const res = await apiRequest("PATCH", "/api/auth/profile", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Profile updated", description: "Your Slack User ID has been saved." });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  const addMutation = useMutation({
    mutationFn: async (data: typeof newCoordinator) => {
      const res = await apiRequest("POST", "/api/coordinators", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Coordinator added" });
      queryClient.invalidateQueries({ queryKey: ["/api/coordinators"] });
      setAddDialogOpen(false);
      setNewCoordinator({ name: "", email: "", phone: "", slackUserId: "" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add coordinator",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/coordinators/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Coordinator removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/coordinators"] });
      setDeleteCoordinator(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove coordinator",
        variant: "destructive",
      });
    },
  });

  const handleAddCoordinator = () => {
    if (!newCoordinator.name || !newCoordinator.email) {
      toast({
        title: "Required fields",
        description: "Please enter a name and email address",
        variant: "destructive",
      });
      return;
    }
    addMutation.mutate(newCoordinator);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your team and preferences
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Slack Settings</CardTitle>
          <CardDescription>
            Connect your Slack account to be automatically invited to transaction channels
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px] space-y-2">
              <Label htmlFor="mySlackId">Your Slack User ID</Label>
              <Input
                id="mySlackId"
                placeholder="U01234567"
                value={mySlackUserId}
                onChange={(e) => setMySlackUserId(e.target.value)}
                data-testid="input-my-slack-id"
              />
              <p className="text-xs text-muted-foreground">
                Find your ID: In Slack, click your profile, then "..." menu, then "Copy member ID"
              </p>
            </div>
            <Button
              onClick={() => updateProfileMutation.mutate({ slackUserId: mySlackUserId })}
              disabled={updateProfileMutation.isPending}
              data-testid="button-save-slack-id"
            >
              {updateProfileMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-red-500/10">
              <Mail className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <CardTitle>Gmail Integration</CardTitle>
              <CardDescription>
                Connect your Gmail to automatically create labels for properties
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Gmail integration uses OAuth to securely access your email. When you create a transaction, 
              a label will be created for that property address.
            </p>
            <div className="flex items-center gap-4 flex-wrap">
              <Button
                onClick={() => window.open("/__replit/integrations/google-mail", "_blank")}
                className="gap-2"
                data-testid="button-connect-gmail"
              >
                <Mail className="h-4 w-4" />
                Connect Gmail
              </Button>
              <a 
                href="https://mail.google.com/mail/u/0/#settings/labels" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                Manage Gmail Labels
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Transaction Coordinators</CardTitle>
              <CardDescription>
                Add team members who help manage transactions
              </CardDescription>
            </div>
            <Button
              onClick={() => setAddDialogOpen(true)}
              className="gap-2"
              data-testid="button-add-coordinator"
            >
              <UserPlus className="h-4 w-4" />
              Add Coordinator
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-md bg-muted/30 animate-pulse">
                  <div className="h-10 w-10 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 bg-muted rounded" />
                    <div className="h-3 w-48 bg-muted rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : coordinators.length > 0 ? (
            <div className="space-y-3">
              {coordinators.map((coordinator) => (
                <div
                  key={coordinator.id}
                  className="flex items-center gap-4 p-3 rounded-md bg-muted/30"
                  data-testid={`row-coordinator-${coordinator.id}`}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>
                      {coordinator.name.split(" ").map((n) => n[0]).join("").toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">{coordinator.name}</p>
                      {coordinator.slackUserId && (
                        <Badge variant="outline" className="text-xs">Slack connected</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {coordinator.email}
                      {coordinator.phone && ` • ${coordinator.phone}`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteCoordinator(coordinator)}
                    data-testid={`button-delete-coordinator-${coordinator.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">No coordinators added yet</p>
              <Button
                variant="outline"
                onClick={() => setAddDialogOpen(true)}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Add your first coordinator
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Transaction Coordinator</DialogTitle>
            <DialogDescription>
              Add a team member to help manage transactions
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="Jane Smith"
                value={newCoordinator.name}
                onChange={(e) => setNewCoordinator((prev) => ({ ...prev, name: e.target.value }))}
                data-testid="input-coordinator-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="jane@realty.com"
                value={newCoordinator.email}
                onChange={(e) => setNewCoordinator((prev) => ({ ...prev, email: e.target.value }))}
                data-testid="input-coordinator-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={newCoordinator.phone}
                onChange={(e) => setNewCoordinator((prev) => ({ ...prev, phone: e.target.value }))}
                data-testid="input-coordinator-phone"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slackUserId">Slack User ID (optional)</Label>
              <Input
                id="slackUserId"
                placeholder="U01234567"
                value={newCoordinator.slackUserId}
                onChange={(e) => setNewCoordinator((prev) => ({ ...prev, slackUserId: e.target.value }))}
                data-testid="input-coordinator-slack"
              />
              <p className="text-xs text-muted-foreground">
                Used to automatically invite them to transaction channels
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setAddDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddCoordinator}
                disabled={addMutation.isPending}
                data-testid="button-submit-coordinator"
              >
                {addMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Add Coordinator
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteCoordinator} onOpenChange={() => setDeleteCoordinator(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Coordinator</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {deleteCoordinator?.name}? They will no longer be available to assign to new transactions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteCoordinator && deleteMutation.mutate(deleteCoordinator.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Remove"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
