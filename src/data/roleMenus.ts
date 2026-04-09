export type MenuItem = {
    label: string
    href: string
    icon?: string
    i18nKey?: string
}

export const roleMenus: Record<string, MenuItem[]> = {
    user: [
        { href: '/dashboard', label: 'Home', icon: 'material-symbols:home-rounded', i18nKey: 'home' },
        { href: '/dashboard/orders', label: 'My Orders', icon: 'lets-icons:order', i18nKey: 'myOrders' }, 
        { href: '/package', label: 'Add Package', icon: 'mdi:package-variant-closed-plus', i18nKey: 'addPackage' },
        { href: '/dashboard/support', label: 'Support', icon: 'fluent:person-support-16-filled', i18nKey: 'support' },
    ],
    operator: [
        { label: 'Home', href: '/dashboard', icon: 'mdi:view-dashboard', i18nKey: 'home' },
        { label: 'Orders', href: '/dashboard/orders?tab=active', icon: 'lets-icons:order', i18nKey: 'myOrders' },
        { label: 'Company', href: '/dashboard/users', icon: 'mdi:office-building-outline', i18nKey: 'company' },
        { label: 'Support', href: '/dashboard/support', icon: 'fluent:person-support-16-filled', i18nKey: 'support' },
    ],
    admin: [
        { href: '/dashboard', label: 'Home', icon: 'mdi:view-dashboard', i18nKey: 'home' },
        { href: '/dashboard/coupons', label: 'Coupons', icon: 'mdi:ticket-percent-outline', i18nKey: 'coupons' },
        { href: '/dashboard/banners', label: 'Banners', icon: 'mdi:image-multiple-outline', i18nKey: 'banners' },
        { href: '/dashboard/package-catalog', label: 'Package Master', icon: 'mdi:shape-plus-outline', i18nKey: 'packageMaster' },
        { href: '/package', label: 'Book Package', icon: 'mdi:package-variant-closed-plus', i18nKey: 'bookPackage' },
        { href: '/dashboard/buses', label: 'My Buses', icon: 'solar:bus-line-duotone', i18nKey: 'myBuses' },
        { href: '/dashboard/locations', label: 'Pickup / Drop \n Locations', icon: 'mdi:map-marker-path', i18nKey: 'locations' },
        { href: '/dashboard/orders', label: 'All Orders', icon: 'lets-icons:order', i18nKey: 'allOrders' },
        { href: '/dashboard/pricing', label: 'Pricing', icon: 'mdi:cash-multiple', i18nKey: 'pricing' },
        { href: '/dashboard/operator', label: 'Operators', icon: 'mdi:account-multiple', i18nKey: 'operators' },
        { href: '/dashboard/support', label: 'Support', icon: 'fluent:person-support-16-filled', i18nKey: 'support' },
    ],
}

export const defaultRole = 'user'
