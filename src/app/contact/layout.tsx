import { Metadata } from 'next';
import { STRINGS } from '@/lib/strings';
import JsonLd from '@/components/JsonLd';

export const metadata: Metadata = {
  title: 'Contact Hapus Logistics | Logistics Company in Mumbai',
  description: 'Get in touch with Hapus Logistics. Fast and reliable courier services in Mumbai, with a dedicated head office in Khar (East), Mumbai.',
  keywords: [
    'contact Hapus Logistics',
    'logistics company in Mumbai',
    'courier services in Mumbai',
    'transport company Mumbai',
    'parcel delivery support',
  ],
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // LocalBusiness schema for Mumbai presence
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          "name": "Hapus Logistics Head Office",
          "image": "https://hapuslogistics.com/icon.png",
          "telephone": STRINGS.contact.phone,
          "email": STRINGS.contact.email,
          "address": {
            "@type": "PostalAddress",
            "streetAddress": "Shop No.1, Ramu Niwas, Near W.E. Highway",
            "addressLocality": "Khar (East), Mumbai",
            "addressRegion": "Maharashtra",
            "postalCode": "400051",
            "addressCountry": "IN"
          },
          "geo": {
            "@type": "GeoCoordinates",
            "latitude": "19.0694",
            "longitude": "72.8427"
          },
          "priceRange": "$$"
        }}
      />
      {children}
    </>
  );
}
