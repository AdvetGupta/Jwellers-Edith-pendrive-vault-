const I18N = {
  _currentLang: localStorage.getItem('app_language') || 'en',

  translations: {
    en: {
      dashboard: "Dashboard",
      billing: "Billing & POS",
      customers: "Customers",
      khata: "Khata Ledger",
      girvi: "Girvi (Pledges)",
      inventory: "Inventory",
      settings: "Settings",
      reports: "Reports",
      staff: "Staff Management",
      backup: "Backup & Sync",
      activity: "Activity Log",
      newEntry: "+ New Girvi Entry",
      importExcel: "📥 Import Excel / CSV",
      refresh: "🔄 Refresh",
      searchPlaceholder: "🔍 Search Girvi No., Customer Name, Caste, Phone, Address...",
      girviNo: "Girvi No. (गिरवी क्र.)",
      girviDate: "Pledge Date (दिनांक)",
      customerName: "Customer Name (ग्राहक नाम)",
      caste: "Caste (जाति)",
      address: "Address (पता)",
      relationName: "Father / Husband Name (पिता / पति का नाम)",
      mobilePhone: "Mobile No. (मोबाइल)",
      ornamentItem: "Ornament (आभूषण)",
      metalType: "Metal & Wt (धातु व वजन)",
      goldWeight: "Gold Weight (सोना ग्राम)",
      silverWeight: "Silver Weight (चांदी ग्राम)",
      principalAmount: "Principal (रकम ₹)",
      monthlyRate: "Monthly Rate (व्याज दर %)",
      duration: "Duration (अवधि)",
      compoundInterest: "Compound Interest (चक्रवर्ती ब्याज ₹)",
      interest: "Interest (ब्याज ₹)",
      duesAmount: "Total Dues (कुल बाकी ₹)",
      status: "Status (स्थिति)",
      actions: "Actions (कार्य)",
      lockerLocation: "Locker No. (लॉकर क्र.)",
      referencePerson: "Reference Person (हवाला व्यक्ति)",
      notes: "Remarks / Notes (टिप्पणी)",
      save: "Save Entry",
      cancel: "Cancel",
      edit: "Edit",
      delete: "Delete",
      print: "Print Receipt",
      export: "Export CSV",
      activePledges: "Active Pledges (सक्रिय गिरवी)",
      totalDisbursed: "Total Disbursed (कुल दी गई रकम)",
      totalGold: "Total Gold Weight (कुल सोना)",
      totalSilver: "Total Silver Weight (कुल चांदी)",
      language: "Language (भाषा)",
      english: "English",
      hindi: "हिंदी"
    },
    hi: {
      dashboard: "डैशबोर्ड",
      billing: "बिलिंग काउंटर",
      customers: "ग्राहक सूची",
      khata: "खाता बही",
      girvi: "गिरवी बही",
      inventory: "स्टॉक इन्वेंटरी",
      settings: "सेटिंग्स",
      reports: "रिपोर्ट्स",
      staff: "स्टाफ प्रबंधन",
      backup: "बैकअप व सिंक",
      activity: "गतिविधि लॉग",
      newEntry: "+ नया गिरवी जमा करें",
      importExcel: "📥 एक्सेल / सीएसवी इम्पोर्ट",
      refresh: "🔄 ताज़ा करें",
      searchPlaceholder: "🔍 गिरवी क्र., नाम, जाति, फोन, पता से खोजें...",
      girviNo: "गिरवी क्र.",
      girviDate: "दिनांक",
      customerName: "ग्राहक का नाम",
      caste: "जाति",
      address: "पता",
      relationName: "पिता / पति का नाम",
      mobilePhone: "मोबाइल नंबर",
      ornamentItem: "आभूषण विवरण",
      metalType: "धातु व वजन",
      goldWeight: "सोना वजन (ग्राम)",
      silverWeight: "चांदी वजन (ग्राम)",
      principalAmount: "रकम (₹)",
      monthlyRate: "मासिक ब्याज दर (%)",
      duration: "अवधि",
      compoundInterest: "चक्रवर्ती ब्याज (₹)",
      interest: "ब्याज (₹)",
      duesAmount: "कुल बकाया रकम (₹)",
      status: "स्थिति",
      actions: "कार्य",
      lockerLocation: "लॉकर क्र.",
      referencePerson: "हवाला / संदर्भ व्यक्ति",
      notes: "टिप्पणी",
      save: "सहेजें",
      cancel: "रद्द करें",
      edit: "संपादित करें",
      delete: "हटाएं",
      print: "रसीद प्रिंट करें",
      export: "एक्सपोर्ट",
      activePledges: "कुल सक्रिय गिरवी",
      totalDisbursed: "कुल दी गई रकम",
      totalGold: "कुल सोना (ग्राम)",
      totalSilver: "कुल चांदी (ग्राम)",
      language: "भाषा",
      english: "English",
      hindi: "हिंदी"
    }
  },

  getLang() {
    return this._currentLang;
  },

  setLang(lang) {
    this._currentLang = lang;
    localStorage.setItem('app_language', lang);
    document.documentElement.setAttribute('data-lang', lang);
    window.dispatchEvent(new CustomEvent('language-changed', { detail: { lang } }));
  },

  t(key, fallback = '') {
    const dict = this.translations[this._currentLang] || this.translations.en;
    return dict[key] || fallback || key;
  }
};

window.I18N = I18N;
document.documentElement.setAttribute('data-lang', I18N.getLang());
