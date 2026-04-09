import PublicAppShell from "@/components/PublicAppShell";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { Metadata } from "next";
import { dbConnect } from "@/app/api/lib/db";
import Location from "@/app/api/models/locationModel";
import { STRINGS } from "@/lib/strings";

// Generate paths for standard locations and anything active in the DB
export async function generateStaticParams() {
  await dbConnect();
  const dbLocations = await Location.distinct("city");
  
  const baseLocations = [
    "devgad",
    "mumbai",
    "borivali",
    "kunkeshwar",
    "achara",
    "pune",
    "ratnagiri",
    "sindhudurg",
    "thane",
    "panvel"
  ];
  
  const allLocationsRaw = [...baseLocations, ...dbLocations];
  
  // Format for URL slug: lowercase and hyphenated
  const slugs = Array.from(new Set(allLocationsRaw.map((loc: string) => 
    loc.toLowerCase().trim().replace(/\s+/g, '-')
  )));

  return slugs.map((city) => ({
    city: city,
  }));
}

// Convert slug back to Display Case
function formatCityName(slug: string) {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const cityName = formatCityName(resolvedParams.city);
  
  return {
    title: `Courier & Transport Services in ${cityName} | ${STRINGS.brand.appName}`,
    description: `Searching for reliable express transport and courier services in ${cityName}? ${STRINGS.brand.appName} provides same-day and next-day scheduled deliveries, package tracking, and local pickup in ${cityName}.`,
    keywords: [`courier services ${cityName}`, `transport company in ${cityName}`, `parcel delivery ${cityName}`, `logistics ${cityName}`, `${cityName} bus transport`, "local pickup", "Hapus Logistics"],
    alternates: { canonical: `/locations/${resolvedParams.city}` },
  };
}

export default async function LocationLandingPage({ params }: { params: Promise<{ city: string }> }) {
  const resolvedParams = await params;
  const cityName = formatCityName(resolvedParams.city);

  return (
    <PublicAppShell className="bg-[linear-gradient(180deg,#151912_0%,#0c0f0a_100%)]">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Service",
              "serviceType": "Courier & Transport Services",
              "provider": {
                "@type": "LocalBusiness",
                "name": `${STRINGS.brand.appName} ${cityName} Region`,
                "address": {
                  "@type": "PostalAddress",
                  "addressLocality": cityName,
                  "addressRegion": "Maharashtra"
                }
              },
              "areaServed": cityName,
              "description": `Fast, scheduled express local and inter-city courier services for ${cityName}.`
            },
            {
              "@type": "FAQPage",
              "mainEntity": [
                {
                  "@type": "Question",
                  "name": `How fast is the parcel delivery in ${cityName}?`,
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": `We offer same-day and next-day scheduled dispatches via our bus operators for most locations connected with ${cityName}.`
                  }
                },
                {
                  "@type": "Question",
                  "name": `Can I track my package sent to/from ${cityName}?`,
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Yes, our robust mobile tracking system allows you to monitor your package journey in real time."
                  }
                }
              ]
            }
          ]
        }}
      />
      <main className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8">
        <article className="prose prose-invert prose-lg max-w-none">
          <header className="text-center mb-16">
            <h1 className="text-4xl sm:text-5xl font-extrabold text-[#D5E400] mb-4">
              Premium Courier & Transport Services in {cityName}
            </h1>
            <p className="text-xl text-white/70">
              The fastest way to send parcels into and out of {cityName}.
            </p>
          </header>

          <section className="mb-12">
            <h2>The Best Transport Company for Your Parcels</h2>
            <p>
              Navigating local transport landscapes requires localized expertise. At <strong>{STRINGS.brand.appName}</strong>, we provide dedicated courier services for <strong>{cityName}</strong> designed for lightning-fast pick-ups and seamless integration with our bus-transit network. Whether you're sending documents, farm produce like fresh mangoes, or daily commercial business shipments locally or inter-city, we are your premier partner.
            </p>
          </section>

          <div className="bg-white/5 rounded-2xl p-8 mb-12 border border-[#D5E400]/20">
            <h3 className="text-[#F6FF6A] mt-0">Our {cityName} Services Include:</h3>
            <ul className="text-sm sm:text-base space-y-2 mb-0">
              <li><strong>Local Pickups & Drop-offs:</strong> Connect locally in {cityName} and dispatch across Maharashtra.</li>
              <li><strong>Hyperlocal Transparency:</strong> Track accurately when your shipment boards and arrives with total transparency.</li>
              <li><strong>Document & Medicine Couriers:</strong> Secure handling of your most sensitive and critical dispatches.</li>
              <li><strong>Commercial Logistics:</strong> Reliable freight fulfillment partner for small/medium businesses.</li>
            </ul>
          </div>

          <section className="mb-12">
            <h2>Why Choose {STRINGS.brand.shortName} in {cityName}?</h2>
            <p>
              Unlike traditional sporadic delivery setups, we strictly schedule your parcels straight into verified inter-city bus operators leaving from or arriving to {cityName}. This guarantees rigid scheduled departures and arrivals, dramatically cutting down the unpredictable transit times experienced with standard "courier services near me" queries.
            </p>
          </section>

          <div className="flex gap-4 justify-center mt-12 text-center">
            <Link href="/package" className="inline-block rounded-full bg-[#D5E400] px-8 py-3 text-black font-bold no-underline hover:bg-white transition-colors border border-transparent shadow-[0_0_15px_rgba(213,228,0,0.3)]">
              Book Delivery Now
            </Link>
          </div>
        </article>
      </main>
    </PublicAppShell>
  );
}
