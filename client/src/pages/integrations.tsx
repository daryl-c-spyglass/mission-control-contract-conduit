import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  MessageSquare,
  Mail,
  Database,
  Users,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  ExternalLink,
} from "lucide-react";
import { SiSlack } from "react-icons/si";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { IntegrationSetting } from "@shared/schema";

interface IntegrationConfig {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  iconColor: string;
  fields: { key: string; label: string; placeholder: string; type: string }[];
  docsUrl?: string;
}

const integrations: IntegrationConfig[] = [
  {
    id: "slack",
    name: "Slack",
    description: "Create channels for transactions and invite coordinators automatically",
    icon: SiSlack,
    iconColor: "text-[#4A154B]",
    fields: [
      { key: "apiKey", label: "Bot Token", placeholder: "xoxb-...", type: "password" },
    ],
    docsUrl: "https://api.slack.com/apps",
  },
  {
    id: "gmail",
    name: "Gmail",
    description: "Create filters to route property emails to Slack channels",
    icon: Mail,
    iconColor: "text-red-500",
    fields: [],
    docsUrl: "https://console.cloud.google.com",
  },
  {
    id: "repliers",
    name: "Repliers (MLS)",
    description: "Fetch MLS listings, property data, and CMA comparables",
    icon: Database,
    iconColor: "text-blue-500",
    fields: [
      { key: "apiKey", label: "API Key", placeholder: "Your Repliers API key", type: "password" },
    ],
    docsUrl: "https://repliers.io/docs",
  },
  {
    id: "fub",
    name: "Follow Up Boss",
    description: "Pull client information and link contacts to transactions",
    icon: Users,
    iconColor: "text-[#EF4923]",
    fields: [
      { key: "apiKey", label: "API Key", placeholder: "Your FUB API key", type: "password" },
    ],
    docsUrl: "https://www.followupboss.com/developers",
  },
];

export default function Integrations() {
  const { toast } = useToast();
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState<Record<string, Record<string, string>>>({});

  const { data: settings = [], isLoading } = useQuery<IntegrationSetting[]>({
    queryKey: ["/api/integrations"],
  });

  const saveMutation = useMutation({
    mutationFn: async ({ type, data }: { type: string; data: Record<string, string> }) => {
      const res = await apiRequest("POST", `/api/integrations/${type}`, data);
      return res.json();
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Integration saved",
        description: `${variables.type} settings have been updated.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save integration",
        variant: "destructive",
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: async (type: string) => {
      const res = await apiRequest("POST", `/api/integrations/${type}/test`);
      return res.json();
    },
    onSuccess: (_, type) => {
      toast({
        title: "Connection successful",
        description: `${type} integration is working correctly.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
    },
    onError: (error: Error, type) => {
      toast({
        title: "Connection failed",
        description: error.message || `Could not connect to ${type}`,
        variant: "destructive",
      });
    },
  });

  const getIntegrationSetting = (type: string) => {
    return settings.find((s) => s.integrationType === type);
  };

  const handleInputChange = (type: string, field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [type]: {
        ...(prev[type] || {}),
        [field]: value,
      },
    }));
  };

  const handleSave = (type: string) => {
    const data = formData[type] || {};
    saveMutation.mutate({ type, data });
  };

  const handleTest = (type: string) => {
    testMutation.mutate(type);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Integrations</h1>
        <p className="text-muted-foreground">
          Connect your tools to automate transaction workflows
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {integrations.map((integration) => {
          const setting = getIntegrationSetting(integration.id);
          const isConnected = setting?.isConnected;
          const Icon = integration.icon;
          const currentFormData = formData[integration.id] || {};

          return (
            <Card key={integration.id} data-testid={`card-integration-${integration.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-md bg-muted ${integration.iconColor}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{integration.name}</CardTitle>
                      <CardDescription className="text-sm">
                        {integration.description}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant={isConnected ? "default" : "secondary"}>
                    {isConnected ? (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Connected
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <XCircle className="h-3 w-3" />
                        Not connected
                      </span>
                    )}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {integration.id === "gmail" ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Gmail integration uses OAuth. Click below to connect your Google account.
                    </p>
                    <Button
                      variant={isConnected ? "outline" : "default"}
                      className="gap-2"
                      data-testid={`button-connect-${integration.id}`}
                    >
                      <Mail className="h-4 w-4" />
                      {isConnected ? "Reconnect Gmail" : "Connect Gmail"}
                    </Button>
                  </div>
                ) : (
                  <>
                    {integration.fields.map((field) => (
                      <div key={field.key} className="space-y-2">
                        <Label htmlFor={`${integration.id}-${field.key}`}>
                          {field.label}
                        </Label>
                        <div className="relative">
                          <Input
                            id={`${integration.id}-${field.key}`}
                            type={showSecrets[integration.id] ? "text" : field.type}
                            placeholder={field.placeholder}
                            value={currentFormData[field.key] || setting?.apiKey || ""}
                            onChange={(e) => handleInputChange(integration.id, field.key, e.target.value)}
                            className="pr-10 font-mono text-sm"
                            data-testid={`input-${integration.id}-${field.key}`}
                          />
                          {field.type === "password" && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-full"
                              onClick={() => setShowSecrets((prev) => ({
                                ...prev,
                                [integration.id]: !prev[integration.id],
                              }))}
                            >
                              {showSecrets[integration.id] ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}

                    <div className="flex items-center gap-2 pt-2 flex-wrap">
                      <Button
                        onClick={() => handleSave(integration.id)}
                        disabled={saveMutation.isPending}
                        data-testid={`button-save-${integration.id}`}
                      >
                        {saveMutation.isPending && saveMutation.variables?.type === integration.id ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : null}
                        Save
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleTest(integration.id)}
                        disabled={testMutation.isPending || !setting?.apiKey}
                        data-testid={`button-test-${integration.id}`}
                      >
                        {testMutation.isPending && testMutation.variables === integration.id ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : null}
                        Test Connection
                      </Button>
                      {integration.docsUrl && (
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          className="ml-auto gap-1.5"
                        >
                          <a href={integration.docsUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" />
                            Docs
                          </a>
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
