import React from "react";
import homebg from "@/assets/images/homebg.png";
import Image from "next/image";
import { Icon } from "@iconify/react";
import ICONS from "@/lib/icons";
import OrderTrackingWidget from "@/components/OrderTrackingWidget";
export default function Banner() {
  return (
    <section
      id="banner"
      className="relative max-w-full overflow-x-hidden h-screen "
    >
      {/* Background Image */}
      <div className="absolute inset-0">
        <Image
          src={homebg}
          alt="Hapus logistics background"
          fill
          priority
          className="object-cover"
        />

        {/* Dark overlay */}
        <div className="absolute inset-0 bg-linear-to-br  from-black from-20% to-black/50 " />
      </div>

      {/* Content (optional) */}
      <div className="relative z-10 px-6 md:px-20 w-full flex flex-col justify-end items-end h-full">
        <div className="w-full h-full flex flex-col lg:flex-row justify-between lg:items-end gap-10">
          <div className="text-white/80 text-3xl font-bold flex flex-col gap-6 justify-center h-full">
            <span>Welcome to,</span>
            <span className="text-[#D5E400]/90 text-8xl">Hapus</span>
            <span className="text-[#D5E400]/80 text-8xl"> Logistics</span>
            <div
              className="relative mt-8 w-fit cursor-pointer rounded-full px-8 py-2.5
             text-base font-normal text-white overflow-hidden shadow-2xl shadow-green-600/50
             flex items-center gap-2.5 group"
            >
              {/* Base gradient */}
              <span
                className="pointer-events-none absolute inset-0
               bg-linear-120 from-green-600 to-75% to-green-900
               transition-opacity duration-700 ease-in-out"
              />

              {/* Hover gradient */}
              <span
                className="pointer-events-none absolute inset-0
               bg-linear-30 from-green-600 to-75% to-green-900
               opacity-0 group-hover:opacity-100
               transition-opacity duration-700 ease-in-out"
              />

              {/* Content */}
              <span className="relative z-10 flex items-center gap-2.5">
                <Icon icon={ICONS.box} className="text-white text-lg" />
                <span>Book a pickup</span>
              </span>
            </div>
          </div>

          <div className="w-full max-w-xl lg:max-w-md pb-8 lg:pb-12">
            <OrderTrackingWidget mode="homepage" />
          </div>
        </div>
        <p
          className="font-bold italic text-white/80 pb-16  text-end
        "
        >
          “We treat your luggage as our priority at every step.“
        </p>
      </div>
    </section>
  );
}
