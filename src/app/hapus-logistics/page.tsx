import PublicAppShell from "@/components/PublicAppShell";
import Link from "next/link";
import { STRINGS } from "@/lib/strings";
import JsonLd from "@/components/JsonLd";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hapus Logistics | Premium Bus-Linked Courier & Parcel Solutions",
  description: "Hapus Logistics specializes in fast, reliable bus-linked parcel delivery in India. Modern logistics solutions for individuals and businesses.",
  keywords: ["Hapus Logistics", "logistics partners", "reliable courier", "fast parcel delivery"],
  alternates: { canonical: "/hapus-logistics" },
};

export default function HapusLogisticsPage() {
  return (
    <PublicAppShell className="bg-[linear-gradient(180deg,#10150f_0%,#1b2218_100%)]">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Service",
          "serviceType": "Bus-Linked Parcel Delivery",
          "provider": {
            "@type": "Organization",
            "name": "Hapus Logistics"
          },
          "areaServed": "India",
          "description": "Premium express parcel movement via bus networks."
        }}
      />
      <main className="mx-auto max-w-5xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="dashboard-surface rounded-[2rem] p-8 sm:p-12 text-center border border-white/10 shadow-2xl">
          <span className="inline-flex rounded-full border border-[#CDD645]/30 bg-[#CDD645]/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-[#F6FF6A] mb-6">
            Official Services
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl mb-6">
            Welcome to <span className="text-[#D5E400]">Hapus Logistics</span>
          </h1>
          <p className="text-lg text-white/70 max-w-3xl mx-auto mb-10 leading-relaxed">
            Hapus Logistics is India's rapidly growing logistics partner solving the "middle mile" challenge. 
            By leveraging expansive daily bus routes, we ensure your parcels and cargo move at the fastest speeds possible 
            with full tracking transparency across the entire journey.
          </p>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-12 text-left">
            {[
              { title: "Direct Bus Connectivity", desc: "Your parcel moves as luggage on the next available bus, eliminating hub-delays." },
              { title: "Transparent Pricing", desc: "No hidden charges. Clear courier rates based on origin, destination, and weight." },
              { title: "Operator Trust", desc: "Trusted by independent operators and businesses requiring daily reliable transport." }
            ].map((feature, i) => (
              <div key={i} className="dashboard-surface-soft p-6 rounded-2xl border border-white/5 hover:border-white/20 transition-all">
                <h3 className="text-xl font-bold text-[#F6FF6A] mb-3">{feature.title}</h3>
                <p className="text-white/60 text-sm">{feature.desc}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-4">
               <Link href="/package" className="rounded-full bg-[#D5E400] px-8 py-4 text-black font-bold uppercase tracking-wider text-sm hover:scale-105 transition-transform">
                 Book a Parcel Now
               </Link>
               <Link href="/contact" className="rounded-full border border-white/20 bg-white/5 px-8 py-4 text-white font-bold uppercase tracking-wider text-sm hover:bg-white/10 transition">
                 Contact Team
               </Link>
          </div>
        </div>
      </main>
    </PublicAppShell>
  );
}
