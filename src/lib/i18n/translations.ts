export type Language = "en" | "hi";

export interface Translations {
  common: {
    kiosk: string;
    privacyNotice: string;
    loading: string;
    back: string;
    paise: string;
    rupees: string;
    english: string;
    hindi: string;
    retry: string;
    cancel: string;
    shopUnavailable: string;
  };
  upload: {
    printerUnavailable: string;
    printerUnavailableDesc: string;
    chooseFiles: string;
    supportedFormats: string;
    uploadedDocuments: string;
    configureOptions: string;
    waitUploads: string;
  };
  options: {
    headerTitle: string;
    headerSubtitle: string;
    colorMode: string;
    bw: string;
    color: string;
    sides: string;
    singleSided: string;
    doubleSided: string;
    copies: string;
    pageRange: string;
    allPages: string;
    customRange: string;
    reviewAndPay: string;
    saving: string;
  };
  review: {
    orderSummary: string;
    reviewNotice: string;
    pages: string;
    copiesLabel: string;
    totalToPay: string;
    payWithUpi: string;
    securedByRazorpay: string;
    initiatingPayment: string;
    paymentFailed: string;
  };
  status: {
    orderToken: string;
    queuedTitle: string;
    queuedDesc: string;
    printingTitle: string;
    printingDesc: string;
    completedTitle: string;
    completedDesc: string;
    failedTitle: string;
    failedDesc: string;
    queuePosition: string;
    aheadOfYou: string;
    privacyTitle: string;
    filesPurged: string;
    filesPurgedShort: string;
    printAnother: string;
  };
}

export const translations: Record<Language, Translations> = {
  en: {
    common: {
      kiosk: "Print Kiosk",
      privacyNotice: "Your files are deleted right after printing.",
      loading: "Connecting to print kiosk...",
      back: "Back",
      paise: "paise",
      rupees: "₹",
      english: "English",
      hindi: "हिन्दी",
      retry: "Retry",
      cancel: "Cancel",
      shopUnavailable: "Shop not available",
    },
    upload: {
      printerUnavailable: "Printer is currently unavailable",
      printerUnavailableDesc: "This printer is not accepting jobs right now. Please tell the shop staff.",
      chooseFiles: "Choose Files to Print",
      supportedFormats: "PDF, JPG, PNG (Max 5 files, up to 25 MB each)",
      uploadedDocuments: "Uploaded Documents",
      configureOptions: "Configure Options",
      waitUploads: "Please wait for uploads to complete",
    },
    options: {
      headerTitle: "Print Options",
      headerSubtitle: "Customize copies, color, and pages",
      colorMode: "Color Mode",
      bw: "Black & White",
      color: "Color",
      sides: "Sides",
      singleSided: "Single-sided",
      doubleSided: "Double-sided",
      copies: "Copies",
      pageRange: "Page Range",
      allPages: "All pages",
      customRange: "Custom range",
      reviewAndPay: "Review & Pay",
      saving: "Updating...",
    },
    review: {
      orderSummary: "Order Summary",
      reviewNotice: "Review your print job before paying",
      pages: "pages",
      copiesLabel: "copies",
      totalToPay: "Total to Pay",
      payWithUpi: "Pay with UPI",
      securedByRazorpay: "Secured by Razorpay • Instant Auto-Print",
      initiatingPayment: "Initiating payment...",
      paymentFailed: "Payment failed. Please try again.",
    },
    status: {
      orderToken: "Daily Token",
      queuedTitle: "Order Queued",
      queuedDesc: "Waiting for printer to pick up your job",
      printingTitle: "Printing in Progress...",
      printingDesc: "Your document is actively printing at the counter",
      completedTitle: "Printing Completed!",
      completedDesc: "Please collect your fresh prints from the tray.",
      failedTitle: "Print Failed",
      failedDesc: "Printer encountered an issue. Staff will assist or refund.",
      queuePosition: "Queue Position",
      aheadOfYou: "ahead of you",
      privacyTitle: "Privacy Guaranteed",
      filesPurged: "Files permanently deleted from server at",
      filesPurgedShort: "Files purged immediately after printing",
      printAnother: "Print Another Document",
    },
  },
  hi: {
    common: {
      kiosk: "प्रिंट कियोस्क",
      privacyNotice: "प्रिंट होते ही आपकी फाइलें हमेशा के लिए हटा दी जाती हैं।",
      loading: "प्रिंट कियोस्क से कनेक्ट हो रहा है...",
      back: "पीछे जाएँ",
      paise: "पैसे",
      rupees: "₹",
      english: "English",
      hindi: "हिन्दी",
      retry: "पुनः प्रयास करें",
      cancel: "रद्द करें",
      shopUnavailable: "दुकान उपलब्ध नहीं है",
    },
    upload: {
      printerUnavailable: "प्रिंटर वर्तमान में अनुपलब्ध है",
      printerUnavailableDesc: "यह प्रिंटर अभी काम नहीं कर रहा है। कृपया काउंटर स्टाफ को बताएं।",
      chooseFiles: "प्रिंट करने के लिए फ़ाइलें चुनें",
      supportedFormats: "PDF, JPG, PNG (अधिकतम 5 फाइलें, 25 MB तक)",
      uploadedDocuments: "अपलोड किए गए दस्तावेज़",
      configureOptions: "प्रिंट विकल्प चुनें",
      waitUploads: "कृपया फाइलें अपलोड होने तक प्रतीक्षा करें",
    },
    options: {
      headerTitle: "प्रिंट सेटिंग्स",
      headerSubtitle: "प्रतियाँ, रंग और पेज चुनें",
      colorMode: "रंग विकल्प",
      bw: "ब्लैक एंड व्हाइट",
      color: "रंगीन",
      sides: "साइड्स",
      singleSided: "एकतरफा (Single-sided)",
      doubleSided: "दोनों तरफ (Double-sided)",
      copies: "प्रतियाँ (Copies)",
      pageRange: "पेज रेंज",
      allPages: "सभी पेज",
      customRange: "कस्टम रेंज",
      reviewAndPay: "समीक्षा और भुगतान करें",
      saving: "अपडेट हो रहा है...",
    },
    review: {
      orderSummary: "ऑर्डर सारांश",
      reviewNotice: "भुगतान से पहले अपने प्रिंट विवरण की जाँच करें",
      pages: "पेज",
      copiesLabel: "प्रतियाँ",
      totalToPay: "कुल देय राशि",
      payWithUpi: "UPI से भुगतान करें",
      securedByRazorpay: "Razorpay द्वारा सुरक्षित • तुरंत ऑटो-प्रिंट",
      initiatingPayment: "भुगतान शुरू हो रहा है...",
      paymentFailed: "भुगतान विफल रहा। कृपया पुनः प्रयास करें।",
    },
    status: {
      orderToken: "दैनिक टोकन",
      queuedTitle: "ऑर्डर कतार में है",
      queuedDesc: "प्रिंटर द्वारा काम शुरू करने की प्रतीक्षा की जा रही है",
      printingTitle: "प्रिंट हो रहा है...",
      printingDesc: "आपका दस्तावेज़ काउंटर पर प्रिंट हो रहा है",
      completedTitle: "प्रिंट पूरा हो गया!",
      completedDesc: "कृपया ट्रे से अपने प्रिंट प्राप्त करें।",
      failedTitle: "प्रिंट विफल रहा",
      failedDesc: "प्रिंटर में समस्या आई। स्टाफ आपकी सहायता करेगा या रिफंड देगा।",
      queuePosition: "कतार स्थिति",
      aheadOfYou: "आपके आगे",
      privacyTitle: "गोपनीयता की पूर्ण गारंटी",
      filesPurged: "फ़ाइलें सर्वर से स्थायी रूप से हटा दी गईं समय:",
      filesPurgedShort: "प्रिंट होते ही फाइलें तुरंत हटा दी जाती हैं",
      printAnother: "दूसरा दस्तावेज़ प्रिंट करें",
    },
  },
};

