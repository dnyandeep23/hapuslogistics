import ICONS from '@/lib/icons';

export const HEADER_NAV_LINKS = [
  {
    label: 'Home',
    href: '/',
    icon: ICONS.home,
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

export default { HEADER_NAV_LINKS, HEADER_ACTIONS };
