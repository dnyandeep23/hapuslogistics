import React from "react";
import WHY_HAPUS_FEATURES from "@/data/features";
import { Icon } from "@iconify/react";

export default function FAQ() {
  return (
    <section className="px-6 md:px-20 w-full py-16">
      {/* Heading */}
      <div className="relative mb-10">
        <p className="text-[40px] font-bold text-white">
          Why should i choose Hapus Logistics?
        </p>
        <div className="absolute bottom-0 left-1 h-2 w-12 bg-orange-600/90" />
      </div>

      <div className="mx-auto grid  grid-cols-1 md:grid-cols-2 gap-8">
        {WHY_HAPUS_FEATURES.map(({ title, description, icon }) => (
          <div
            key={title}
            className="
              py-16
              rounded-2xl
              border border-dashed border-white/25
              bg-black/70
              transition-colors duration-300
              hover:border-white/40 hover:bg-black/40
              flex flex-col items-center justify-center text-center
              px-10
            "
          >
            <Icon icon={icon} className="text-white/80 mb-6" width={150} />

            <h3 className="mb-3 text-3xl font-semibold text-white">{title}</h3>

            <p className="text-lg text-white/90 max-w-[320px] leading-relaxed">
              {description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
