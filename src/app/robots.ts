import { MetadataRoute } from 'next';

const BASE_URL = process.env.DOMAIN || 'https://hapuslogistics.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin/', '/dashboard/', '/operator/'],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
