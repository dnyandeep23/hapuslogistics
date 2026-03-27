import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "Pricing | Hapus Logistics",
  description: "Public pricing details for Hapus Logistics services, taxes, and extra charges.",
};

const serviceRows = [
  {
    service: "Local luggage transfer",
    detail: "For short-distance station, depot, and city transfers",
    price: "Quoted by route",
  },
  {
    service: "Intercity parcel movement",
    detail: "For bus-linked or scheduled long-distance deliveries",
    price: "Quoted by distance and weight",
  },
  {
    service: "Handling and coordination",
    detail: "Pickup coordination, handoff support, and shipment tracking",
    price: "Included where shown",
  },
  {
    service: "Special handling",
    detail: "Fragile, urgent, or oversize requests requiring extra care",
    price: "May attract extra charges",
  },
];

const factors = [
  "Route distance and travel timing",
  "Weight, volume, and package count",
  "Pickup or drop location complexity",
  "Optional insurance or special handling",
  "Any taxes or extra fees shown before payment",
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(205,214,69,0.12),transparent_30%),linear-gradient(180deg,#11160f_0%,#1a2017_45%,#0d110b_100%)] text-white">
      <Header />

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-28 sm:px-6 lg:px-8">
        <div className="dashboard-surface rounded-[2rem] p-6 sm:p-8">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-full border border-[#CDD645]/30 bg-[#CDD645]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#F6FF6A]">
              Pricing
            </span>
            <h1 className="mt-4 text-3xl font-bold text-white sm:text-5xl">
              Simple, transparent pricing for every route
            </h1>
            <p className="mt-4 text-sm leading-7 text-white/72 sm:text-base">
              Hapus Logistics pricing is route-based and shown before payment. The final fare depends on the
              shipment details, service type, and any add-ons you choose during booking.
            </p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="dashboard-surface-soft rounded-2xl p-5">
              <h2 className="text-lg font-semibold text-[#F6FF6A]">Service pricing</h2>
              <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
                <div className="grid grid-cols-3 bg-black/20 px-4 py-3 text-xs uppercase tracking-[0.18em] text-white/50">
                  <span>Service</span>
                  <span>What it covers</span>
                  <span>Price</span>
                </div>
                {serviceRows.map((row) => (
                  <div key={row.service} className="grid grid-cols-3 gap-3 border-t border-white/8 px-4 py-4 text-sm">
                    <span className="font-medium text-white">{row.service}</span>
                    <span className="text-white/70">{row.detail}</span>
                    <span className="text-[#F6FF6A]">{row.price}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-white/45">Pricing factors</p>
                <ul className="mt-4 space-y-3 text-sm leading-7 text-white/75">
                  {factors.map((factor) => (
                    <li key={factor} className="rounded-xl border border-white/8 bg-black/15 p-3">
                      {factor}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-[#CDD645]/20 bg-[linear-gradient(180deg,rgba(205,214,69,0.1),rgba(255,255,255,0.03))] p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-white/45">Taxes and charges</p>
                <p className="mt-3 text-sm leading-7 text-white/75">
                  Applicable taxes, convenience fees, or extra service charges are shown clearly before checkout.
                  There are no hidden charges added after you confirm the booking unless you request a new service
                  or change the shipment scope.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-white/10 bg-black/15 p-5">
            <h2 className="text-lg font-semibold text-[#F6FF6A]">Need an exact quote?</h2>
            <p className="mt-3 text-sm leading-7 text-white/75">
              Enter your pickup, drop, package details, and travel date on the booking flow to see the exact
              fare before payment. If you are a business customer, contact us for recurring route pricing.
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Questions about the quote?</p>
              <p className="mt-1 text-sm text-white/68">We can explain pricing, taxes, and any extra charges before you book.</p>
            </div>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-full border border-[#CDD645]/35 bg-[#CDD645]/10 px-4 py-2 text-sm font-semibold text-[#F6FF6A] transition hover:bg-[#CDD645]/20"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
