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
    '/hapus-logistics',
    '/courier-services-mumbai',
  ];


  return routes.map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: route === '' ? 'daily' : 'weekly',
    priority:
      route === ''
        ? 1.0
        : route === '/hapus-logistics'
          ? 0.9
          : route === '/courier-services-mumbai'
            ? 0.9
            : 0.7,
  }));
}
