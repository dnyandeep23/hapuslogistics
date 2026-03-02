import React from "react";
import Image from "next/image";
import Link from "next/link";
import applogo from '@/assets/images/applogo.png';
import { STRINGS } from "../lib/strings";

export default function Footer() {
  return (
    <footer className="bg-linear-to-r from-gray-900 via-green-900 to-black text-white p-8">
      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center">
          {/* Logo and App Name */}
          <div className="flex items-center mb-6 md:mb-0">
            <Image src={applogo} alt="Hapus Logistics Logo" width={100} height={50} className="mr-3" />
            <span className="text-2xl font-bold">{STRINGS.appName}</span>
          </div>

          {/* Navigation Links */}
          <div className="flex space-x-8 mb-6 md:mb-0">
            <Link href="/" className="hover:text-lime-400 transition-colors">Home</Link>
            <Link href="/about" className="hover:text-lime-400 transition-colors">About</Link>
            <Link href="/contact" className="hover:text-lime-400 transition-colors">Contact</Link>
          </div>
        </div>

        <div className="border-t border-gray-700 mt-8 pt-6 flex flex-col md:flex-row justify-between items-center text-sm text-gray-400">
          <p>© {new Date().getFullYear()} {STRINGS.appName}. All rights reserved.</p>
          <p className="mt-4 md:mt-0">
            Developed with <span className="text-red-500">&hearts;</span> by Dnyandeep and Atharva
          </p>
        </div>
      </div>
    </footer>
  );
}
