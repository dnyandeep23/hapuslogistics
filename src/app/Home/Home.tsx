import Link from "next/link";
import Banner from "@/app/Home/Banner";
import FAQ from "@/app/Home/FAQ";
import TestimonialCarousel from "@/app/Home/Testimonials";
import PublicAppShell from "@/components/PublicAppShell";

export default function Home() {
  return (
    <PublicAppShell className="w-full bg-[#1A1F1B]" contentClassName="pt-0">
      <Banner />

      <TestimonialCarousel />

      <FAQ />

      {/* Trust & Ready to Move */}
      <section className="relative px-4 py-32 sm:px-6 lg:px-8 border-t border-white/5 bg-[#0A0D09]">
        <div className="absolute inset-x-0 bottom-0 h-full bg-[radial-gradient(ellipse_at_bottom,rgba(213,228,0,0.05),transparent_70%)] pointer-events-none" />
        
        <div className="relative mx-auto max-w-3xl text-center">
            <h2 className="text-5xl font-extrabold leading-tight text-white sm:text-7xl mb-6">
              Ready to move?
            </h2>
            <p className="text-xl text-white/50 mb-12">
              Book a parcel, review pricing, or ask for help without digging around.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                href="/package"
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-full bg-[#D5E400] px-10 py-5 text-sm font-bold text-black transition-transform hover:scale-105 active:scale-95 shadow-[0_0_40px_rgba(213,228,0,0.15)]"
              >
                Start Booking
              </Link>
              <Link
                href="/contact"
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-10 py-5 text-sm font-semibold text-white transition-colors hover:bg-white/10 active:scale-95"
              >
                Contact Hapus
              </Link>
            </div>
        </div>
      </section>
    </PublicAppShell>
  );
}
