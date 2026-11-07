import { describe, it, expect } from "vitest";
import { translations, Language } from "../translations";

describe("i18n Bilingual Localization Engine", () => {
  it("defines complete translations for supported languages: en and hi", () => {
    const languages: Language[] = ["en", "hi"];
    languages.forEach((lang) => {
      expect(translations[lang]).toBeDefined();
      expect(translations[lang].common).toBeDefined();
      expect(translations[lang].upload).toBeDefined();
      expect(translations[lang].options).toBeDefined();
      expect(translations[lang].review).toBeDefined();
      expect(translations[lang].status).toBeDefined();
    });
  });

  it("verifies exact parity of all keys between English and Hindi dictionaries", () => {
    const enSections = Object.keys(translations.en) as Array<keyof typeof translations.en>;
    const hiSections = Object.keys(translations.hi) as Array<keyof typeof translations.hi>;

    expect(enSections.sort()).toEqual(hiSections.sort());

    enSections.forEach((section) => {
      const enKeys = Object.keys(translations.en[section]).sort();
      const hiKeys = Object.keys(translations.hi[section]).sort();
      expect(enKeys).toEqual(hiKeys);
    });
  });

  it("ensures no translation strings are empty or whitespace", () => {
    (["en", "hi"] as Language[]).forEach((lang) => {
      const dict = translations[lang];
      Object.entries(dict).forEach(([_section, keys]) => {
        Object.entries(keys as Record<string, string>).forEach(([_k, val]) => {
          expect(typeof val).toBe("string");
          expect(val.trim().length).toBeGreaterThan(0);
        });
      });
    });
  });

  it("verifies specific Hindi terminology matches print kiosk standards", () => {
    expect(translations.hi.common.rupees).toBe("₹");
    expect(translations.hi.common.hindi).toBe("हिन्दी");
    expect(translations.hi.upload.chooseFiles).toContain("फ़ाइलें चुनें");
    expect(translations.hi.review.payWithUpi).toContain("UPI से भुगतान करें");
    expect(translations.hi.status.orderToken).toBe("दैनिक टोकन");
  });
});

