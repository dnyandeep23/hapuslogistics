import type { DashboardNavItem, DashboardRole } from "@/types/dashboard";

export const dashboardNavItems: DashboardNavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: "mdi:view-dashboard-outline",
    roles: ["operator", "admin", "superadmin"],
  },
  {
    label: "My Trips",
    href: "/dashboard/my-trips",
    icon: "mdi:bus-clock",
    roles: ["operator"],
  },
  {
    label: "Messages",
    href: "/dashboard/messages",
    icon: "mdi:message-outline",
    roles: ["operator"],
  },
  {
    label: "Profile",
    href: "/dashboard/profile",
    icon: "mdi:account-outline",
    roles: ["operator"],
  },
  {
    label: "Buses",
    href: "/dashboard/buses",
    icon: "mdi:bus-multiple",
    roles: ["admin"],
  },
  {
    label: "Operators",
    href: "/dashboard/operators",
    icon: "mdi:account-group-outline",
    roles: ["admin", "superadmin"],
    lockForAdminWithoutBus: true,
  },
  {
    label: "Trips",
    href: "/dashboard/trips",
    icon: "mdi:map-marker-path",
    roles: ["admin", "superadmin"],
    lockForAdminWithoutBus: true,
  },
  {
    label: "Wallet",
    href: "/dashboard/wallet",
    icon: "mdi:wallet-outline",
    roles: ["admin"],
    lockForAdminWithoutBus: true,
  },
  {
    label: "Reports",
    href: "/dashboard/reports",
    icon: "mdi:file-chart-outline",
    roles: ["admin", "superadmin"],
    lockForAdminWithoutBus: true,
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: "mdi:cog-outline",
    roles: ["admin"],
  },
  {
    label: "Companies",
    href: "/dashboard/companies",
    icon: "mdi:office-building-outline",
    roles: ["superadmin"],
  },
  {
    label: "Coupons",
    href: "/dashboard/coupons",
    icon: "mdi:ticket-percent-outline",
    roles: ["superadmin"],
  },
  {
    label: "Banners",
    href: "/dashboard/banners",
    icon: "mdi:image-multiple-outline",
    roles: ["superadmin"],
  },
  {
    label: "Platform Settings",
    href: "/dashboard/platform-settings",
    icon: "mdi:tune-vertical-variant",
    roles: ["superadmin"],
  },
];

const routePermissions: Record<string, DashboardRole[]> = {
  "/dashboard": ["operator", "admin", "superadmin"],
  "/dashboard/my-trips": ["operator"],
  "/dashboard/messages": ["operator"],
  "/dashboard/profile": ["operator"],
  "/dashboard/buses": ["admin"],
  "/dashboard/operators": ["admin", "superadmin"],
  "/dashboard/trips": ["admin", "superadmin"],
  "/dashboard/wallet": ["admin"],
  "/dashboard/reports": ["admin", "superadmin"],
  "/dashboard/settings": ["admin"],
  "/dashboard/companies": ["superadmin"],
  "/dashboard/coupons": ["superadmin"],
  "/dashboard/banners": ["superadmin"],
  "/dashboard/platform-settings": ["superadmin"],
};

export const getRoleNavItems = (role: DashboardRole) =>
  dashboardNavItems.filter((item) => item.roles.includes(role));

export const isRouteAllowedForRole = (pathname: string, role: DashboardRole) => {
  if (pathname.startsWith("/dashboard/orders") || pathname.startsWith("/dashboard/support") || pathname.startsWith("/dashboard/users")) {
    return false;
  }

  const matchedRoute =
    Object.keys(routePermissions)
      .sort((a, b) => b.length - a.length)
      .find((route) => pathname === route || pathname.startsWith(`${route}/`)) ??
    "/dashboard";

  return routePermissions[matchedRoute]?.includes(role) ?? false;
};
