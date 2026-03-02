export type MenuItem = {
    label: string
    href: string
    icon?: string
}

export const roleMenus: Record<string, MenuItem[]> = {
    user: [
        { href: '/dashboard', label: 'Home', icon: 'material-symbols:home-rounded' },
        { href: '/dashboard/orders', label: 'My Orders', icon: 'lets-icons:order' },
        { href: '/dashboard/support', label: 'Support', icon: 'fluent:person-support-16-filled' },
    ],
    operator: [
        { label: 'Dashboard', href: '/dashboard', icon: 'mdi:view-dashboard' },
        { label: 'Company', href: '/dashboard/users', icon: 'mdi:office-building-outline' },
        { label: 'Support', href: '/dashboard/support', icon: 'fluent:person-support-16-filled' },
    ],
    admin: [
        { href: '/dashboard', label: 'Dashboard', icon: 'mdi:view-dashboard' },
        { href: '/package', label: 'Book Package', icon: 'mdi:package-variant-closed-plus' },
        { href: '/dashboard/buses', label: 'My Buses', icon: 'mdi:bus-multiple' },
        { href: '/dashboard/locations', label: 'Pickup/Drop', icon: 'mdi:map-marker-path' },
        { href: '/dashboard/orders', label: 'All Orders', icon: 'lets-icons:order' },
        { href: '/dashboard/users', label: 'Operators', icon: 'mdi:account-multiple' },
        { href: '/dashboard/support', label: 'Support', icon: 'fluent:person-support-16-filled' },
    ],
    superadmin: [
        { href: '/dashboard', label: 'Dashboard', icon: 'mdi:view-dashboard' },
        { href: '/dashboard/coupons', label: 'Coupons', icon: 'mdi:ticket-percent-outline' },
        { href: '/dashboard/banners', label: 'Banners', icon: 'mdi:image-multiple-outline' },
        { href: '/package', label: 'Book Package', icon: 'mdi:package-variant-closed-plus' },
        { href: '/dashboard/buses', label: 'My Buses', icon: 'mdi:bus-multiple' },
        { href: '/dashboard/locations', label: 'Pickup/Drop', icon: 'mdi:map-marker-path' },
        { href: '/dashboard/orders', label: 'All Orders', icon: 'lets-icons:order' },
        { href: '/dashboard/users', label: 'Manage Operators', icon: 'mdi:account-multiple' },
    ],
}

export const defaultRole = 'user'
