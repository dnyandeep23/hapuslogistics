"use client";

import { useEffect, useState } from "react";
import TESTIMONIALS from "@/data/testimonials";
import { Icon } from "@iconify/react";

export default function TestimonialCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % TESTIMONIALS.length);
    }, 5000);

    return () => window.clearInterval(timer);
  }, []);

  const current = TESTIMONIALS[currentIndex];

  return (
    <section className="relative px-4 py-20 sm:px-6 lg:px-8">
      <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent)]" />
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 lg:grid-cols-[0.82fr_1.18fr]">
          <div className="max-w-lg">
            <span className="inline-flex rounded-full bg-[#D5E400]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#F6FF6A]">
              Testimonials
            </span>
            <h2 className="mt-5 text-3xl font-bold text-white sm:text-4xl">
              People trust Hapus when timing and handoffs matter
            </h2>
            <p className="mt-5 text-sm leading-8 text-white/68 sm:text-base">
              Instead of another card grid, this section keeps focus on one voice at a time so the page breathes
              and the proof feels stronger.
            </p>

            <div className="mt-8 flex gap-2">
              {TESTIMONIALS.map((item, index) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => setCurrentIndex(index)}
                  className={`h-2 rounded-full transition-all ${
                    index === currentIndex ? "w-12 bg-[#D5E400]" : "w-3 bg-white/20"
                  }`}
                  aria-label={`Show testimonial ${index + 1}`}
                />
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -left-6 top-2 text-7xl font-bold text-white/8 sm:text-8xl">“</div>
            <div className="pl-8 sm:pl-12">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-2xl font-semibold text-white">{current.name}</p>
                  <p className="mt-1 text-sm text-white/52">{current.role}</p>
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Icon
                      key={`star-${index}`}
                      icon="solar:star-bold"
                      className={index < current.rating ? "text-yellow-400" : "text-white/16"}
                    />
                  ))}
                </div>
              </div>

              <p className="mt-8 max-w-3xl text-2xl leading-[1.7] text-white/82 sm:text-[2rem]">
                {current.description}
              </p>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                {TESTIMONIALS.map((item, index) => (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => setCurrentIndex(index)}
                    className={`border-b px-1 pb-3 text-left transition ${
                      index === currentIndex
                        ? "border-[#D5E400]/40 text-white"
                        : "border-white/10 text-white/52 hover:text-white/74"
                    }`}
                  >
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] opacity-75">{item.role}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
