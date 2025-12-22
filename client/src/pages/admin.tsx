import { useQuery } from "@tanstack/react-query";
import { Loader2, Shield, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { SiSlack } from "react-icons/si";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect } from "react";

interface IntegrationStatus {
  slack: boolean;
  repliers: boolean;
  fub: boolean;
}

export default function Admin() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect if not admin
  useEffect(() => {
    if (user && user.isAdmin !== "true") {
      setLocation("/");
    }
  }, [user, setLocation]);

  const { data: status, isLoading } = useQuery<IntegrationStatus>({
    queryKey: ["/api/admin/integration-status"],
    enabled: user?.isAdmin === "true",
  });

  if (user?.isAdmin !== "true") {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Admin Access Required</h2>
          <p className="text-muted-foreground">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const integrations = [
    {
      id: "slack",
      name: "Slack",
      description: "Create channels for transactions and invite team members",
      icon: <SiSlack className="h-5 w-5 text-[#4A154B]" />,
      iconBg: "bg-[#4A154B]/10",
      configured: status?.slack ?? false,
      secretName: "SLACK_BOT_TOKEN",
      docsUrl: "https://api.slack.com/apps",
    },
    {
      id: "repliers",
      name: "Repliers (MLS)",
      description: "Fetch MLS listings, property data, and CMA comparables",
      icon: <span className="text-blue-500 font-bold text-sm">MLS</span>,
      iconBg: "bg-blue-500/10",
      configured: status?.repliers ?? false,
      secretName: "REPLIERS_API_KEY",
      docsUrl: "https://repliers.io/docs",
    },
    {
      id: "fub",
      name: "Follow Up Boss",
      description: "Pull client information and link contacts to transactions",
      icon: <span className="text-orange-500 font-bold text-sm">FUB</span>,
      iconBg: "bg-orange-500/10",
      configured: status?.fub ?? false,
      secretName: "FUB_API_KEY",
      docsUrl: "https://www.followupboss.com/developers",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin Settings</h1>
        <p className="text-muted-foreground">
          View integration status. API keys are managed through Replit Secrets.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {integrations.map((integration) => (
          <Card key={integration.id} data-testid={`card-integration-${integration.id}`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-md ${integration.iconBg}`}>
                    {integration.icon}
                  </div>
                  <div>
                    <CardTitle className="text-base">{integration.name}</CardTitle>
                  </div>
                </div>
                <Badge variant={integration.configured ? "default" : "secondary"}>
                  {integration.configured ? (
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Connected
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <XCircle className="h-3 w-3" />
                      Not configured
                    </span>
                  )}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <CardDescription>{integration.description}</CardDescription>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-mono">
                  Secret: {integration.secretName}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-1 text-xs"
                  onClick={() => window.open(integration.docsUrl, "_blank")}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Docs
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How to Configure API Keys</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            API keys are stored securely as Replit Secrets. To add or update a key:
          </p>
          <ol className="list-decimal list-inside space-y-1 pl-2">
            <li>Open the Secrets panel in your Replit workspace (padlock icon)</li>
            <li>Add the secret key (e.g., SLACK_BOT_TOKEN) and paste your API key value</li>
            <li>The integration will automatically detect the new key</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
