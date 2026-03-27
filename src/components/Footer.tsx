import Image from "next/image";
import Link from "next/link";
import applogo from "@/assets/images/applogo.png";
import { STRINGS } from "@/lib/strings";

const primaryLinks = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

const policyLinks = [
  { label: "Pricing Details", href: "/pricing" },
  { label: "Terms & Conditions", href: "/terms" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Refunds / Cancellations", href: "/refunds" },
];

export default function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-white/5 bg-[#0A0D09] text-white pt-10 pb-8 sm:pb-32 lg:pb-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(213,228,0,0.06),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(115,161,67,0.08),transparent_30%)]" />

      <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr_0.8fr_1fr]">
          <div className="group rounded-[2rem] border border-white/5 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent)] p-6 transition-all hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent)] hover:border-white/10 backdrop-blur-3xl">
            <div className="flex items-center gap-3">
              <Image src={applogo} alt="Hapus Logistics Logo" width={112} height={58} className="h-11 w-auto object-contain" />
              <div>
                <p className="text-lg font-semibold text-white">{STRINGS.appName}</p>
                <p className="text-sm text-white/62">Bus-linked luggage and parcel delivery</p>
              </div>
            </div>
            <p className="mt-4 max-w-md text-sm leading-7 text-white/68">
              Modern parcel coordination for operators, travellers, and businesses with booking, tracking,
              delivery support, and refund transparency.
            </p>
          </div>

          <div className="group rounded-[2rem] border border-white/5 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent)] p-6 transition-all hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent)] hover:border-white/10 backdrop-blur-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#F6FF6A]">Explore</p>
            <div className="mt-4 space-y-3">
              {primaryLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block text-sm text-white/72 transition hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="group rounded-[2rem] border border-white/5 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent)] p-6 transition-all hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent)] hover:border-white/10 backdrop-blur-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#F6FF6A]">Policies</p>
            <div className="mt-4 space-y-3">
              {policyLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block text-sm text-white/72 transition hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="group rounded-[2rem] border border-[#D5E400]/15 bg-[linear-gradient(180deg,rgba(213,228,0,0.03),transparent)] p-6 transition-all hover:bg-[linear-gradient(180deg,rgba(213,228,0,0.06),transparent)] hover:border-[#D5E400]/30 backdrop-blur-3xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#D5E400]">Contact</p>
            <div className="mt-5 space-y-4 text-sm leading-relaxed text-white/60">
              <p className="transition-colors hover:text-white">support@hapuslogistics.com</p>
              <p className="transition-colors hover:text-white">+91 98765 43210</p>
              <p className="transition-colors hover:text-white">138/D, Kinny House Room No. 1, 2nd Floor, near Parcel ST Depot, Pune, Maharashtra 411001</p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-white/10 pt-6 text-sm text-white/48 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {STRINGS.appName}. All rights reserved.</p>
          <p>Transparent pricing, clear policies, and dependable logistics support.</p>
        </div>
      </div>
    </footer>
  );
}
