"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import en from "./dictionaries/en.json";

type Language = "en";
type Dictionary = typeof en;

interface LanguageContextProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Dictionary;
}

const dictionaries = {
  en,
};

const LanguageContext = createContext<LanguageContextProps>({
  language: "en",
  setLanguage: () => {},
  t: en,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setLanguageState("en");
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("siteLang", lang);
    document.cookie = `NEXT_LOCALE=${lang}; path=/; max-age=31536000`; // 1 year
    
    // Optional: hard reset server-components by refreshing the router
    // window.location.reload(); 
  };

  const t = (dictionaries[language] || en) as Dictionary;

  // Prevent hydration mismatch by optionally not rendering children until mounted
  // However, simple context works fine without this if we are careful.
  
  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {mounted ? children : (
        // Hydration fallback with English
        <LanguageContext.Provider value={{ language: "en", setLanguage, t: en as Dictionary }}>
           {children}
        </LanguageContext.Provider>
      )}
    </LanguageContext.Provider>
  );
}

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useTranslation must be used within a LanguageProvider");
  }
  return context;
};
