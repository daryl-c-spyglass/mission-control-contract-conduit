import { useState, useEffect } from "react";
import { Switch, Route } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { OnboardingDialog } from "@/components/onboarding-dialog";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Building2, LogOut, Loader2 } from "lucide-react";
import Dashboard from "@/pages/dashboard";
import Archive from "@/pages/archive";
import GraphicsSettings from "@/pages/graphics-settings";
import Settings from "@/pages/settings";
import Admin from "@/pages/admin";
import SharedCMAPage from "@/pages/shared-cma";
import CMAs from "@/pages/CMAs";
import CMANew from "@/pages/CMANew";
import CMADetailPage from "@/pages/CMADetailPage";
import NotFound from "@/pages/not-found";
import type { Transaction } from "@shared/schema";

function LandingPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const error = urlParams.get("error");
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 rounded-lg bg-primary/10 w-fit">
            <Building2 className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl">Mission Control</CardTitle>
          <CardDescription>
            Real estate transaction management for your brokerage. Track deals from contract to close.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error === "unauthorized_domain" && (
            <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm text-center" data-testid="error-unauthorized">
              Only @spyglassrealty.com accounts can sign in. Please use your company email.
            </div>
          )}
          <Button
            className="w-full"
            size="lg"
            onClick={() => window.location.href = "/api/auth/google"}
            data-testid="button-login"
          >
            Sign in with Google
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            Use your @spyglassrealty.com email to sign in
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

function AuthenticatedApp() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { user, logout, isLoggingOut } = useAuth();

  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });

  // Check if user needs onboarding (first-time login without Slack ID or email consent)
  useEffect(() => {
    if (user && !user.hasCompletedOnboarding) {
      setShowOnboarding(true);
    }
  }, [user]);

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar
          transactions={transactions}
          onCreateTransaction={() => setCreateDialogOpen(true)}
        />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between gap-4 p-3 border-b bg-background sticky top-0 z-50">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-3">
              {user && (
                <div className="flex items-center gap-2">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={user.profileImageUrl || undefined} />
                    <AvatarFallback>
                      {user.firstName?.[0] || user.email?.[0]?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm hidden sm:inline">
                    {user.firstName || user.email}
                  </span>
                </div>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => logout()}
                disabled={isLoggingOut}
                data-testid="button-logout"
              >
                <LogOut className="h-4 w-4" />
              </Button>
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6">
            <div className="max-w-7xl mx-auto">
              <Switch>
                <Route path="/">
                  <Dashboard
                    createDialogOpen={createDialogOpen}
                    setCreateDialogOpen={setCreateDialogOpen}
                  />
                </Route>
                <Route path="/archive" component={Archive} />
                <Route path="/graphics" component={GraphicsSettings} />
                <Route path="/settings" component={Settings} />
                <Route path="/admin" component={Admin} />
                <Route path="/cmas" component={CMAs} />
                <Route path="/cmas/new" component={CMANew} />
                <Route path="/cmas/:id" component={CMADetailPage} />
                <Route component={NotFound} />
              </Switch>
            </div>
          </main>
        </div>
      </div>
      
      <OnboardingDialog
        open={showOnboarding}
        onComplete={() => setShowOnboarding(false)}
      />
    </SidebarProvider>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  
  // Check for public routes that don't require authentication
  if (window.location.pathname.startsWith('/shared/cma/')) {
    return (
      <Switch>
        <Route path="/shared/cma/:token" component={SharedCMAPage} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <LandingPage />;
  }

  return <AuthenticatedApp />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
