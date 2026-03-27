import WHY_HAPUS_FEATURES from "@/data/features";
import { Icon } from "@iconify/react";

export default function FAQ() {
  return (
    <section className="relative px-4 py-20 sm:px-6 lg:px-8">
      <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent)]" />
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="max-w-xl">
            <span className="inline-flex rounded-full bg-[#D5E400]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#F6FF6A]">
              Why Hapus
            </span>
            <h2 className="mt-5 text-3xl font-bold text-white sm:text-4xl">
              Less noise, more clarity for real deliveries
            </h2>
            <p className="mt-5 text-sm leading-8 text-white/68 sm:text-base">
              The homepage now leans into spacious storytelling instead of stacking heavy cards, so users can
              understand the service faster and move toward booking with less friction.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2">
            {WHY_HAPUS_FEATURES.map(({ title, description, icon }) => (
              <article key={title} className="group">
                <div className="flex items-start gap-4">
                  <span className="mt-1 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[#F6FF6A] transition group-hover:bg-[#D5E400]/12">
                    <Icon icon={icon} className="text-2xl" />
                  </span>
                  <div>
                    <h3 className="text-xl font-semibold text-white">{title}</h3>
                    <p className="mt-3 text-sm leading-7 text-white/66">{description}</p>
                  </div>
                </div>
                <div className="mt-6 h-px bg-[linear-gradient(90deg,rgba(255,255,255,0.14),transparent)]" />
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
