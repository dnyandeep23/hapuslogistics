import type { Metadata } from "next";
import Link from "next/link";
import PublicAppShell from "@/components/PublicAppShell";

export const metadata: Metadata = {
  title: "Privacy Policy | Hapus Logistics",
  description: "Privacy policy covering personal data collection, usage, storage, and sharing.",
};

const sections = [
  {
    title: "What We Collect",
    items: [
      "Name, email address, phone number, pickup and delivery details, and booking notes.",
      "Payment-related information required to confirm an order, along with tracking and support records.",
      "Device and usage data such as browser type, pages visited, and session activity to keep the site secure.",
    ],
  },
  {
    title: "How We Use It",
    items: [
      "To process bookings, send confirmations, support shipment tracking, and provide customer service.",
      "To improve our routes, pricing flow, website performance, and operational safety.",
      "To send service updates, order notifications, and required legal or transactional messages.",
    ],
  },
  {
    title: "Storage and Sharing",
    items: [
      "We store data securely and keep it only as long as needed for business, legal, and operational purposes.",
      "We do not sell your personal data.",
      "We may share necessary details with payment providers, transport partners, or service vendors only to complete your booking or comply with law.",
    ],
  },
  {
    title: "Your Rights",
    items: [
      "You can ask us to update or correct your details if they are inaccurate.",
      "You can request deletion where applicable, subject to legal and transaction record retention rules.",
      "If you have privacy questions, you can contact us using the details on the Contact page.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <PublicAppShell className="bg-[radial-gradient(circle_at_top,rgba(205,214,69,0.12),transparent_30%),linear-gradient(180deg,#11160f_0%,#1b2218_45%,#0d110b_100%)]">
      <section className="mx-auto max-w-6xl px-4 pb-10 pt-24 sm:px-6 sm:pb-14 lg:px-8 lg:pt-28">
        <div className="dashboard-surface rounded-[2rem] p-6 sm:p-8">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-full border border-[#CDD645]/30 bg-[#CDD645]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#F6FF6A]">
              Privacy Policy
            </span>
            <h1 className="mt-4 text-3xl font-bold text-white sm:text-5xl">
              How we collect, use, and protect your data
            </h1>
            <p className="mt-4 text-sm leading-7 text-white/72 sm:text-base">
              We keep privacy straightforward. This policy explains what information we collect, why we need it,
              where it is stored, and when it may be shared.
            </p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {sections.map((section) => (
              <article key={section.title} className="dashboard-surface-soft rounded-2xl p-5">
                <h2 className="text-lg font-semibold text-[#F6FF6A]">{section.title}</h2>
                <ul className="mt-4 space-y-3 text-sm leading-7 text-white/75">
                  {section.items.map((item) => (
                    <li key={item} className="rounded-xl border border-white/8 bg-black/15 p-3">
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-[#CDD645]/20 bg-[linear-gradient(180deg,rgba(205,214,69,0.08),rgba(255,255,255,0.03))] p-5">
            <h2 className="text-lg font-semibold text-[#F6FF6A]">Security and retention</h2>
            <p className="mt-3 text-sm leading-7 text-white/75">
              We use reasonable technical and organizational safeguards to protect customer records. Booking,
              payment, and service history may be retained for compliance, dispute resolution, and accounting
              requirements even after an account is closed.
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Questions about your data?</p>
              <p className="mt-1 text-sm text-white/68">Reach out and we’ll help with account or privacy concerns.</p>
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
    </PublicAppShell>
  );
}
