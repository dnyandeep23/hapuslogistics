import { MetadataRoute } from 'next';

const BASE_URL = 'https://hapuslogistics.vercel.app';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
      },
      {
        userAgent: '*',
        disallow: [
          '/api/',
          '/admin/',
          '/dashboard/',
          '/operator/',
          '/login',
          '/register',
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}