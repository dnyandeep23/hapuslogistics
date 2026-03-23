"use client";

import React, { useState } from "react";
import Header from "@/components/Header";
import contactVector from "@/assets/images/contactVector.png";
import Image from "next/image";
import ConfirmationModal from "@/components/dashboard/ConfirmationModal";

export default function ContactPage() {
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  return (
    <section>
      <div>
        <Header />
        <div className="relative mb-44">
          <Image src={contactVector} alt="contact page vector image" className="object-cover" />
          <div className="absolute inset-0 flex flex-col items-center justify-start bg-linear-to-b from-[#2A3125]/50 to-[#2A3125]">
            <p className="mt-[10%] pb-2 text-4xl font-bold text-white/65">Contact us</p>
            <p className="text-white/60">Connecting journeys and deliveries with care.</p>
            <button
              type="button"
              onClick={() => setShowSuccessModal(true)}
              className="mt-6 rounded-full border border-[#D5E400]/50 bg-[#D5E400]/10 px-5 py-2 text-sm font-semibold text-[#E4E67A] transition hover:bg-[#D5E400]/20"
            >
              Send Message
            </button>
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={showSuccessModal}
        title="Message Sent"
        description="Thanks for reaching out. Your message was sent successfully."
        confirmLabel="Close"
        hideCancel
        confirmVariant="success"
        onClose={() => setShowSuccessModal(false)}
        onConfirm={() => setShowSuccessModal(false)}
      />
    </section>
  );
}
