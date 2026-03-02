"use client";

import React, { useState } from "react";
import { STRINGS } from "../../lib/strings";
import Header from "@/components/Header";
import contactVector from "@/assets/images/contactVector.png";
import Image from "next/image";
import COLORS from "@/lib/colors";

export default function ContactPage() {
  COLORS.darkBackground

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`Message sent from `);
  };

  return (
    <section>
      <div>
        <Header />
        <div className="relative mb-44 ">
          <Image src={contactVector} alt="contact page vector image" className="object-cover"></Image>
          <div className={`absolute bg-linear-to-b from-[#2A3125]/0.5 to-90% to-[#2A3125] inset-0 flex flex-col items-center justify-start  `}>
            <p className="font-bold text-4xl pb-2 mt-[10%] text-white/65">Contact us</p>
            <p className="text-white/60">Connecting journeys and deliveries with care.</p>
          </div>
        </div>
        <div className=""></div>
      </div>

    </section>
  );
}
