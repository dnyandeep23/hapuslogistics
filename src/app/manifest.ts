import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Hapus Logistics',
    short_name: 'Hapus',
    description: 'Modern logistics tracking, booking, and operator operations.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0A0D09',
    theme_color: '#D5E400',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  };
}
