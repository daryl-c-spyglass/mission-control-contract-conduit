import { useLocation } from "wouter";
import { Home, Archive, Settings, Shield, Plus, Building2 } from "lucide-react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Transaction } from "@shared/schema";

interface AppSidebarProps {
  transactions: Transaction[];
  onCreateTransaction: () => void;
}

const baseNavItems = [
  { title: "Transactions", url: "/", icon: Home },
  { title: "Archive", url: "/archive", icon: Archive },
  { title: "Settings", url: "/settings", icon: Settings },
];

const adminNavItems = [
  { title: "Admin", url: "/admin", icon: Shield },
];

export function AppSidebar({ transactions, onCreateTransaction }: AppSidebarProps) {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const activeCount = transactions.filter(t => t.status !== "closed" && t.status !== "cancelled" && t.isArchived !== true).length;
  
  // Combine nav items, adding Admin if user is admin
  const navItems = user?.isAdmin === "true"
    ? [...baseNavItems, ...adminNavItems]
    : baseNavItems;

  // User display info with fallback chain
  // Name: Marketing Profile → Google OAuth (first+last) → email username
  const googleName = user?.firstName && user?.lastName 
    ? `${user.firstName} ${user.lastName}`.trim() 
    : user?.firstName || user?.lastName || null;
  const emailUsername = user?.email?.split('@')[0] || '';
  const displayName = user?.marketingDisplayName || googleName || emailUsername || 'Agent';
  
  // Email: logged-in user's email
  const displayEmail = user?.email || '';
  
  // Photo: Marketing Profile → Google OAuth → null (shows initials)
  const displayPhoto = user?.marketingHeadshotUrl || user?.profileImageUrl || null;
  
  // Get initials for avatar fallback
  const getInitials = (name: string) => {
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
            <Building2 className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Contract Conduit</h1>
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
                      isActive={isActive}
                      onClick={() => navigate(item.url)}
                      data-testid={`nav-${item.title.toLowerCase()}`}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                      {item.title === "Transactions" && activeCount > 0 && (
                        <Badge variant="secondary" className="ml-auto" data-testid="badge-active-count">
                          {activeCount}
                        </Badge>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="flex items-center gap-3 rounded-md p-2 hover-elevate" data-testid="sidebar-user-profile">
          <Avatar className="h-9 w-9 flex-shrink-0">
            {displayPhoto ? (
              <AvatarImage src={displayPhoto} alt={displayName} className="object-cover" />
            ) : null}
            <AvatarFallback className="text-xs bg-primary text-primary-foreground font-semibold">
              {getInitials(displayName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" data-testid="text-user-name">{displayName}</p>
            <p className="text-xs text-muted-foreground truncate" data-testid="text-user-email">{displayEmail}</p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
