import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "Refunds & Cancellations | Hapus Logistics",
  description: "Refund, cancellation, timeline, and payment method policy for Hapus Logistics.",
};

const policies = [
  {
    title: "When refunds are allowed",
    text: "Refunds may be issued when a booking is cancelled within the eligible window, a service issue is confirmed, or an order qualifies under a documented operational exception.",
  },
  {
    title: "Cancellation rules",
    text: "Cancellation eligibility depends on order status, dispatch progress, and route timing. Once an order is marked delivered, refund eligibility is generally closed unless law or a specific service guarantee says otherwise.",
  },
  {
    title: "Refund timeline",
    text: "Approved refunds are typically processed within 5 to 7 working days after confirmation. Bank processing time may vary slightly depending on the payment provider and the customer’s bank.",
  },
  {
    title: "Refund method",
    text: "Whenever possible, refunds are sent back to the original payment method. If the original payment route is unavailable, the refund may be routed to a verified bank account after review.",
  },
];

export default function RefundPolicyPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(205,214,69,0.12),transparent_30%),linear-gradient(180deg,#11160f_0%,#1a2017_48%,#0d110b_100%)] text-white">
      <Header />

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-28 sm:px-6 lg:px-8">
        <div className="dashboard-surface rounded-[2rem] p-6 sm:p-8">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-full border border-[#CDD645]/30 bg-[#CDD645]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#F6FF6A]">
              Refunds / Cancellations Policy
            </span>
            <h1 className="mt-4 text-3xl font-bold text-white sm:text-5xl">
              Clear refund rules for customers and partners
            </h1>
            <p className="mt-4 text-sm leading-7 text-white/72 sm:text-base">
              This policy explains when a refund may be approved, how cancellations are handled, how long refunds
              take, and where the money is returned.
            </p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {policies.map((policy) => (
              <article key={policy.title} className="dashboard-surface-soft rounded-2xl p-5">
                <h2 className="text-lg font-semibold text-[#F6FF6A]">{policy.title}</h2>
                <p className="mt-3 text-sm leading-7 text-white/75">{policy.text}</p>
              </article>
            ))}
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-white/45">Typical review</p>
              <p className="mt-3 text-2xl font-bold text-[#F6FF6A]">24-48 hrs</p>
              <p className="mt-2 text-sm text-white/70">We review eligible cancellation and refund requests as quickly as possible.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-white/45">Working days</p>
              <p className="mt-3 text-2xl font-bold text-[#F6FF6A]">5-7 days</p>
              <p className="mt-2 text-sm text-white/70">Approved refunds are usually completed within five to seven working days.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-white/45">Destination</p>
              <p className="mt-3 text-2xl font-bold text-[#F6FF6A]">Original method</p>
              <p className="mt-2 text-sm text-white/70">Refunds go back to the original payment method or verified bank account.</p>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-[#CDD645]/20 bg-[linear-gradient(180deg,rgba(205,214,69,0.1),rgba(255,255,255,0.03))] p-5">
            <h2 className="text-lg font-semibold text-[#F6FF6A]">Important note</h2>
            <p className="mt-3 text-sm leading-7 text-white/75">
              Refund timing can change slightly if the payment gateway or bank needs extra verification. If a refund
              cannot be sent to the original payment route, our team may request bank details for a manual transfer
              after internal approval.
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/15 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Need a cancellation checked?</p>
              <p className="mt-1 text-sm text-white/68">Use the contact page and share your tracking ID for support.</p>
            </div>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-full border border-[#CDD645]/35 bg-[#CDD645]/10 px-4 py-2 text-sm font-semibold text-[#F6FF6A] transition hover:bg-[#CDD645]/20"
            >
              Contact Support
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
