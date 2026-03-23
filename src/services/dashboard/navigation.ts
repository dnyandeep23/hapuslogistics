import type { DashboardNavItem, DashboardRole } from "@/types/dashboard";

export const dashboardNavItems: DashboardNavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: "mdi:view-dashboard-outline",
    roles: ["operator", "admin"],
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
    roles: ["admin"],
    lockForAdminWithoutBus: true,
  },
  {
    label: "Trips",
    href: "/dashboard/trips",
    icon: "mdi:map-marker-path",
    roles: ["admin"],
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
    roles: ["admin"],
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
    roles: ["admin"],
  },
  {
    label: "Coupons",
    href: "/dashboard/coupons",
    icon: "mdi:ticket-percent-outline",
    roles: ["admin"],
  },
  {
    label: "Banners",
    href: "/dashboard/banners",
    icon: "mdi:image-multiple-outline",
    roles: ["admin"],
  },
  {
    label: "Platform Settings",
    href: "/dashboard/platform-settings",
    icon: "mdi:tune-vertical-variant",
    roles: ["admin"],
  },
];

const routePermissions: Record<string, DashboardRole[]> = {
  "/dashboard": ["operator", "admin"],
  "/dashboard/my-trips": ["operator"],
  "/dashboard/messages": ["operator"],
  "/dashboard/profile": ["operator"],
  "/dashboard/buses": ["admin"],
  "/dashboard/operators": ["admin"],
  "/dashboard/trips": ["admin"],
  "/dashboard/wallet": ["admin"],
  "/dashboard/reports": ["admin"],
  "/dashboard/settings": ["admin"],
  "/dashboard/companies": ["admin"],
  "/dashboard/coupons": ["admin"],
  "/dashboard/banners": ["admin"],
  "/dashboard/platform-settings": ["admin"],
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
