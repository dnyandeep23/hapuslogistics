import ICONS from '@/lib/icons';

export const HEADER_NAV_LINKS = [
  {
    label: 'Home',
    href: '/',
    icon: ICONS.home,
  },
  {
    label: 'About',
    href: '/about',
    icon: 'solar:buildings-2-outline',
  },
  {
    label: 'Contact',
    href: '/contact',
    icon: ICONS.contact,
  },
];

export const HEADER_ACTIONS = [
  {
    label: 'Login',
    route: '/login',
  },
  {
    label: 'Register',
    route: '/register',
    defaultActive: true,
  },
];

const NAV_DATA = { HEADER_NAV_LINKS, HEADER_ACTIONS };

export default NAV_DATA;
