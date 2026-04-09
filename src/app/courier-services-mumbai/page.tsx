import PublicAppShell from "@/components/PublicAppShell";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Courier Services Mumbai | Best Parcel Delivery Next-Day - Hapus Logistics",
  description: "Searching for quick and secure courier services in Mumbai? Hapus Logistics offers same-day/next-day shipping, package tracking, and local pickup in Mumbai.",
  keywords: ["courier services Mumbai", "courier service near me", "Mumbai parcel delivery", "best transport company in Mumbai", "Hapus Logistics"],
  alternates: { canonical: "/courier-services-mumbai" },
};

export default function CourierMumbaiPage() {
  return (
    <PublicAppShell className="bg-[linear-gradient(180deg,#151912_0%,#0c0f0a_100%)]">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Service",
          "serviceType": "Courier Services",
          "provider": {
            "@type": "LocalBusiness",
            "name": "Hapus Logistics Mumbai Region",
            "address": {
              "@type": "PostalAddress",
              "addressLocality": "Mumbai",
              "addressRegion": "Maharashtra"
            }
          },
          "areaServed": "Mumbai",
          "description": "Express local and inter-city courier services from Mumbai."
        }}
      />
      <main className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8">
        <article className="prose prose-invert prose-lg max-w-none">
          <header className="text-center mb-16">
            <h1 className="text-4xl sm:text-5xl font-extrabold text-[#D5E400] mb-4">
              Premium Courier Services in Mumbai
            </h1>
            <p className="text-xl text-white/70">
              The fastest way to send parcels into and out of Maharashtra's capital.
            </p>
          </header>

          <section className="mb-12">
            <h2>The Best Transport Company for Your Parcels</h2>
            <p>
              Navigating Mumbai's traffic and complex delivery zones requires local expertise. At <strong>Hapus Logistics</strong>, we provide localized courier services in Mumbai tailored for fast pick-ups and rapid integration into our bus-transit network. Whether you're sending documents to Pune, cargo to Gujarat, or daily business shipments locally within the MMR region, we are your premier partner.
            </p>
          </section>

          <div className="bg-white/5 rounded-2xl p-8 mb-12 border border-[#D5E400]/20">
            <h3 className="text-[#F6FF6A] mt-0">Our Mumbai Services Include:</h3>
            <ul className="text-sm sm:text-base space-y-2 mb-0">
              <li><strong>Local MMR Pickups:</strong> Connect locally and dispatch nationally.</li>
              <li><strong>Hyperlocal Transparency:</strong> Track accurately when the courier leaves our Mumbai facility to the bus operator.</li>
              <li><strong>Document & Medicine Couriers:</strong> Secure handling of your sensitive dispatches.</li>
              <li><strong>E-commerce Shipping:</strong> Reliable fulfillment partner for small online businesses based in Mumbai.</li>
            </ul>
          </div>

          <section className="mb-12">
            <h2>Why Choose Hapus Over Local Providers?</h2>
            <p>
              Unlike traditional single-rider setups, we inject your parcels straight into verified inter-city bus routes. This guarantees scheduled departures and arrivals, dramatically cutting down the unpredictable transit times experienced with standard "courier service near me" queries.
            </p>
          </section>

          <div className="flex gap-4 justify-center mt-12 text-center">
            <Link href="/package" className="inline-block rounded-full bg-[#D5E400] px-8 py-3 text-black font-bold no-underline hover:bg-white transition-colors">
              Book Delivery
            </Link>
          </div>
        </article>
      </main>
    </PublicAppShell>
  );
}
