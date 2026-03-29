import type { Metadata } from "next";
import Link from "next/link";
import PublicAppShell from "@/components/PublicAppShell";

export const metadata: Metadata = {
  title: "Terms & Conditions | Hapus Logistics",
  description: "Terms of use, service responsibilities, payments, and liability for Hapus Logistics.",
};

const sections = [
  {
    title: "1. Using Our Services",
    body: [
      "By using Hapus Logistics, you agree to provide accurate booking details, contact information, and shipment information.",
      "You must use the site and services only for lawful purposes and in accordance with applicable transport and commerce rules.",
      "We may refuse service, suspend accounts, or cancel bookings if information is false, incomplete, or unsafe.",
    ],
  },
  {
    title: "2. Bookings, Payments, and Service Scope",
    body: [
      "All booking confirmations are subject to route availability, vehicle capacity, schedule, and payment verification.",
      "Pricing can change based on route, package weight, timing, and service add-ons shown during checkout.",
      "You are responsible for payment of the quoted fare, taxes, and any clearly disclosed extra charges before dispatch.",
    ],
  },
  {
    title: "3. User Responsibilities",
    body: [
      "You must ensure that luggage and parcels are packed properly and do not contain prohibited, illegal, dangerous, or restricted items.",
      "You should provide a reachable phone number and respond quickly to pickup or delivery coordination requests.",
      "You are responsible for declaring fragile, valuable, or special-handling items before booking.",
    ],
  },
  {
    title: "4. Liability and Limitations",
    body: [
      "We take care to handle shipments safely, but our liability is limited to the extent permitted by law and by the service terms shown at booking.",
      "Hapus Logistics is not responsible for losses caused by inaccurate information, improper packing, force majeure, or delays outside our control.",
      "Any claim must be reported promptly so we can investigate with the booking and tracking records.",
    ],
  },
  {
    title: "5. Changes and Contact",
    body: [
      "We may update these terms from time to time to reflect service, legal, or operational changes.",
      "Continued use of the website after an update means you accept the revised terms.",
      "If you have questions, contact our support team before making a booking.",
    ],
  },
];

export default function TermsPage() {
  return (
    <PublicAppShell className="bg-[radial-gradient(circle_at_top,rgba(205,214,69,0.14),transparent_28%),linear-gradient(180deg,#11160f_0%,#1a2017_42%,#0e120c_100%)]">
      <section className="mx-auto max-w-6xl px-4 pb-10 pt-24 sm:px-6 sm:pb-14 lg:px-8 lg:pt-28">
        <div className="dashboard-surface rounded-[2rem] p-6 sm:p-8">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-full border border-[#CDD645]/30 bg-[#CDD645]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#F6FF6A]">
              Terms & Conditions
            </span>
            <h1 className="mt-4 text-3xl font-bold text-white sm:text-5xl">
              Rules for using Hapus Logistics
            </h1>
            <p className="mt-4 text-sm leading-7 text-white/72 sm:text-base">
              These terms explain how our website and logistics services work, what you can expect from us, and
              what we expect from every customer and business partner.
            </p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {sections.map((section) => (
              <article key={section.title} className="dashboard-surface-soft rounded-2xl p-5">
                <h2 className="text-lg font-semibold text-[#F6FF6A]">{section.title}</h2>
                <ul className="mt-4 space-y-3 text-sm leading-7 text-white/75">
                  {section.body.map((item) => (
                    <li key={item} className="rounded-xl border border-white/8 bg-black/15 p-3">
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-[#CDD645]/20 bg-[linear-gradient(180deg,rgba(205,214,69,0.12),rgba(255,255,255,0.03))] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#F6FF6A]">Need help with terms before booking?</p>
              <p className="mt-1 text-sm text-white/70">
                Contact us for clarifications about pricing, liability, or shipment restrictions.
              </p>
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
    </PublicAppShell>
  );
}
