import { MetadataRoute } from 'next';
import { dbConnect } from '@/app/api/lib/db';
import Location from '@/app/api/models/locationModel';

const BASE_URL = process.env.DOMAIN || 'https://hapuslogistics.vercel.app';

export const revalidate = 0;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}`, changeFrequency: 'daily', priority: 1.0 },
    { url: `${BASE_URL}/about`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE_URL}/contact`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE_URL}/pricing`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE_URL}/hapus-logistics`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE_URL}/courier-services-mumbai`, changeFrequency: 'weekly', priority: 0.9 },
  ];

  try {
    await dbConnect();
    const dbLocations = await Location.distinct("city");
    
    const baseLocations = [
      "devgad", "mumbai", "borivali", "kunkeshwar", "achara",
      "pune", "ratnagiri", "sindhudurg", "thane", "panvel"
    ];
    
    const allLocationsRaw = [...baseLocations, ...dbLocations];
    const slugs = Array.from(new Set(allLocationsRaw.map((loc: string) => 
      loc.toLowerCase().trim().replace(/\s+/g, '-')
    )));

    const dynamicRoutes: MetadataRoute.Sitemap = slugs.map((slug) => ({
      url: `${BASE_URL}/locations/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    }));

    return [...routes, ...dynamicRoutes];
  } catch (error) {
    console.error("sitemap.ts: Failed to generate dynamic locations.", error);
    return routes;
  }
}