import { Metadata } from 'next';
import JsonLd from '@/components/JsonLd';

export const metadata: Metadata = {
  title: 'About Hapus Logistics | Reliable Parcel & Courier Partners India',
  description: 'Learn about Hapus Logistics, built to make bus-linked logistics feel more modern. We prioritize practical parcel movement, tracking clarity, and dependable timing.',
  keywords: [
    'about Hapus Logistics',
    'reliable courier partners in India',
    'fast parcel delivery',
    'logistics solutions',
  ],
};

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "AboutPage",
          "name": "About Hapus Logistics",
          "description": "Information regarding Hapus Logistics operations, reliable network, and support logic."
        }}
      />
      {children}
    </>
  );
}
