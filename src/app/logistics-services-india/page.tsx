import PublicAppShell from "@/components/PublicAppShell";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Logistics Services India | Reliable Logistics Company - Hapus Logistics",
  description: "Looking for a reliable logistics company in India? Hapus Logistics offers top-tier express courier services, supply chain solutions, and robust B2B transport.",
  keywords: ["logistics services India", "logistics company in India", "express delivery India", "B2B transport", "Hapus Logistics"],
  alternates: { canonical: "/logistics-services-india" },
};

export default function LogisticsIndiaPage() {
  return (
    <PublicAppShell className="bg-[linear-gradient(180deg,#151912_0%,#0c0f0a_100%)]">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Service",
          "serviceType": "Logistics and Supply Chain Solutions",
          "provider": {
            "@type": "Organization",
            "name": "Hapus Logistics"
          },
          "areaServed": "India",
          "description": "Comprehensive logistics services across India, providing secure and timely delivery."
        }}
      />
      <main className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8">
        <article className="prose prose-invert prose-lg max-w-none">
          <header className="text-center mb-16">
            <h1 className="text-4xl sm:text-5xl font-extrabold text-[#D5E400] mb-4">
              Top-Tier Logistics Services in India
            </h1>
            <p className="text-xl text-white/70">
              Empowering businesses with fast, secure, and trackable nationwide delivery.
            </p>
          </header>

          <section className="mb-12">
            <h2>Why Choose Hapus as Your Logistics Company in India?</h2>
            <p>
              When evaluating a logistics company in India, reliability and speed are paramount. India's vast geography requires an interconnected transport network. 
              <strong>Hapus Logistics</strong> solves this by using established bus transit networks to perform cross-city and interstate express deliveries far faster than traditional hub-and-spoke models.
            </p>
          </section>

          <div className="grid sm:grid-cols-2 gap-8 mb-12">
            <div className="dashboard-surface p-6 rounded-2xl border border-white/10">
              <h3 className="text-[#F6FF6A] m-0 mb-2">B2B Freight Forwarding</h3>
              <p className="text-sm m-0">Daily inter-city cargo transit designed for vendors and wholesale suppliers requiring predictable schedules.</p>
            </div>
            <div className="dashboard-surface p-6 rounded-2xl border border-white/10">
              <h3 className="text-[#F6FF6A] m-0 mb-2">Express Parcel Delivery</h3>
              <p className="text-sm m-0">For time-sensitive materials, legal documents, and urgent retail shipments looking for same-day or next-day movement.</p>
            </div>
          </div>

          <section className="mb-12">
            <h2>Track Your Cargo Everywhere</h2>
            <p>
              We believe communication is the core of modern logistics services. Our technology provides real-time GPS tracking natively synced with your transport vehicle, keeping both sender and receiver informed.
            </p>
          </section>

          <div className="text-center mt-12">
            <Link href="/package" className="inline-block rounded-full bg-[#D5E400] px-8 py-3 text-black font-bold no-underline hover:bg-white transition-colors">
              Start Shipping in India
            </Link>
          </div>
        </article>
      </main>
    </PublicAppShell>
  );
}
