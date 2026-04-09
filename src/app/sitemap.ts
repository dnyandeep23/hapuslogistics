import { MetadataRoute } from 'next';
import { STRINGS } from '@/lib/strings';

// Assuming production URL, adjust if needed by env
const BASE_URL = process.env.DOMAIN || 'https://hapuslogistics.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    '',
    '/about',
    '/contact',
    '/pricing',
    '/refunds',
    '/privacy',
    '/terms',
    '/login',
    '/register',
    // New SEO target landing pages
    '/hapus-logistics',
    '/logistics-services-india',
    '/courier-services-mumbai',
  ];

  return routes.map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: route === '' ? 1 : 0.8,
  }));
}
