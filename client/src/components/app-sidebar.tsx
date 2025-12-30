import { Link, useLocation } from "wouter";
import { Home, Archive, Settings, Shield, Plus, Building2, Palette } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Transaction } from "@shared/schema";

interface AppSidebarProps {
  transactions: Transaction[];
  onCreateTransaction: () => void;
}

const baseNavItems = [
  { title: "Transactions", url: "/", icon: Home },
  { title: "Archive", url: "/archive", icon: Archive },
  { title: "Graphics", url: "/graphics", icon: Palette },
  { title: "Settings", url: "/settings", icon: Settings },
];

const adminNavItems = [
  { title: "Admin", url: "/admin", icon: Shield },
];

export function AppSidebar({ transactions, onCreateTransaction }: AppSidebarProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  const activeCount = transactions.filter(t => t.status !== "closed" && t.status !== "cancelled").length;
  
  // Combine nav items, adding Admin if user is admin
  const navItems = user?.isAdmin === "true"
    ? [...baseNavItems, ...adminNavItems]
    : baseNavItems;

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
            <Building2 className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Mission Control</h1>
            <p className="text-xs text-muted-foreground">Transaction Management</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <div className="px-4 pb-2">
            <Button
              onClick={onCreateTransaction}
              className="w-full justify-start gap-2"
              data-testid="button-create-transaction"
            >
              <Plus className="h-4 w-4" />
              New Transaction
            </Button>
          </div>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = location === item.url || 
                  (item.url === "/" && location === "") ||
                  (item.url !== "/" && location.startsWith(item.url));
                
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      data-testid={`nav-${item.title.toLowerCase()}`}
                    >
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                        {item.title === "Transactions" && activeCount > 0 && (
                          <Badge variant="secondary" className="ml-auto" data-testid="badge-active-count">
                            {activeCount}
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="flex items-center gap-3 rounded-md p-2 hover-elevate">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">AG</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">Agent User</p>
            <p className="text-xs text-muted-foreground truncate">agent@realty.com</p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
