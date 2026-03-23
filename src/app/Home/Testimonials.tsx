"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import TESTIMONIALS from "@/data/testimonials";
import { Icon } from "@iconify/react";
import ICONS from "@/lib/icons";

export default function TestimonialCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const next = () =>
    setCurrentIndex((prev) => (prev + 1) % TESTIMONIALS.length);

  const prev = () =>
    setCurrentIndex(
      (prev) => (prev - 1 + TESTIMONIALS.length) % TESTIMONIALS.length
    );

  /* Auto slide */
  useEffect(() => {
    if (paused) return;
    const timer = setInterval(next, 4000);
    return () => clearInterval(timer);
  }, [paused]);

  return (
    <section className="py-24 px-6 md:px-20 overflow-hidden">
      <h2 className="mb-12 text-start text-4xl font-bold text-white">
        What our customers say
        <div className=" w-12 h-2 bg-orange-600/90" />
      </h2>

      {/* Carousel Wrapper */}
      {/* OUTER WRAPPER */}
      <div className="relative w-full max-w-[90%] mx-auto">
        {/* CAROUSEL VIEWPORT */}
        <div
          className="relative flex items-center justify-center overflow-x-hidden h-110"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {TESTIMONIALS.map((t, index) => {
            const offset = index - currentIndex;
            const isFocused = offset === 0;

            return (
              <div
                key={t.name}
                className="absolute transition-all duration-700 ease-in-out"
                style={{
                  transform: `
              translateX(${offset * 650}px)
              scale(${isFocused ? 1.15 : 0.92})
            `,
                  opacity: Math.abs(offset) > 1 ? 0 : isFocused ? 1 : 0.6,
                  zIndex: isFocused ? 20 : 10,
                  pointerEvents: isFocused ? "auto" : "none",
                }}
              >
                <div
                  className={`
              h-90
              w-85
              md:w-130
              lg:w-150
              rounded-2xl
              ${isFocused ? "bg-black/50" : "bg-black/30"}
              p-6 md:p-8
              border border-white/20
              backdrop-blur-md
            `}
                >
                  {/* Profile */}
                  <div className="mb-4 flex items-center gap-4">
                    {t.image ? (
                      <Image
                        src={t.image}
                        alt={t.name}
                        width={48}
                        height={48}
                        className="rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-700 text-white text-lg font-bold">
                        {t.name.charAt(0)}
                      </div>
                    )}

                    <div>
                      <p className="font-semibold text-white">{t.name}</p>
                      <p className="text-sm text-white/60">{t.role}</p>
                    </div>
                  </div>

                  {/* Rating */}
                  <div className="mb-3 flex gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Icon
                        key={i}
                        icon={ICONS.star}
                        className={
                          i < t.rating ? "text-yellow-400" : "text-white/20"
                        }
                      />
                    ))}
                  </div>

                  {/* Description */}
                  <p className="mt-6 text-center text-sm md:text-base leading-relaxed text-white/75 text-ellipsis">
                    <span
                      className="text-xl text-white font-bold mr-1"
                      style={{
                        fontFamily:
                          'Playfair Display, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                      }}
                    >
                      ❝
                    </span>
                    {t.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* CONTROLS (ARROWS) */}
        <button
          onClick={prev}
          className="absolute -left-16 top-1/2 -translate-y-1/2 z-50
               rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
        >
          <Icon icon={ICONS.arrow_left} />
        </button>

        <button
          onClick={next}
          className="absolute -right-16 top-1/2 -translate-y-1/2 z-50
               rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
        >
          <Icon icon={ICONS.arrow_right} />
        </button>
      </div>

      {/* Dots */}
      <div className="mt-8 flex justify-center gap-2">
        {TESTIMONIALS.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentIndex(i)}
            className={`h-2 rounded-full transition-all ${
              i === currentIndex
                ? "w-8 bg-white"
                : "w-2 bg-white/40 hover:bg-white/60"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
