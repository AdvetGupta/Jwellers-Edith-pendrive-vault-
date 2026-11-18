// Jwellers Edith — Reports & New Setup Master Guide Screen
// An AD's Creation Product

const REPORTS_SCREEN = {
  render() {
    return `
      <div class="screen-container" style="padding: 24px; max-width: 1200px; margin: 0 auto;">
        
        <!-- Header Banner -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; border-bottom:1px solid var(--border); padding-bottom:16px; flex-wrap:wrap; gap:12px;">
          <div>
            <h1 style="font-size:24px; font-weight:800; color:var(--primary); margin:0; display:flex; align-items:center; gap:10px;">
              📊 Reports & New Setup Master Guide
            </h1>
            <p style="font-size:13px; color:var(--text-secondary); margin:4px 0 0 0;">
              Business analytics, ledger exports, and step-by-step operating guide for every new setup.
            </p>
          </div>
          <div style="display:flex; gap:10px;">
            <button class="btn btn-secondary" onclick="window.REPORTS_SCREEN && window.REPORTS_SCREEN.exportGirviCsv()">
              📥 Export Girvi (CSV)
            </button>
            <button class="btn btn-secondary" onclick="window.REPORTS_SCREEN && window.REPORTS_SCREEN.exportKhataCsv()">
              📥 Export Khata (CSV)
            </button>
          </div>
        </div>

        <!-- Metric Summary Cards -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:16px; margin-bottom:30px;">
          <div class="card" style="background:var(--bg-card); border:1px solid var(--border); padding:18px; border-radius:12px;">
            <div style="font-size:12px; color:var(--text-secondary); font-weight:700; text-transform:uppercase;">🪙 Girvi Active Portfolio</div>
            <div id="rep-girvi-amount" style="font-size:22px; font-weight:800; color:var(--primary); margin-top:6px;">₹0</div>
            <div id="rep-girvi-count" style="font-size:12px; color:var(--text-secondary); margin-top:4px;">Loading active pledges...</div>
          </div>

          <div class="card" style="background:var(--bg-card); border:1px solid var(--border); padding:18px; border-radius:12px;">
            <div style="font-size:12px; color:var(--text-secondary); font-weight:700; text-transform:uppercase;">📖 Khata Outstanding Dues</div>
            <div id="rep-khata-dues" style="font-size:22px; font-weight:800; color:var(--danger, #ef4444); margin-top:6px;">₹0</div>
            <div id="rep-customer-count" style="font-size:12px; color:var(--text-secondary); margin-top:4px;">Loading customers...</div>
          </div>

          <div class="card" style="background:var(--bg-card); border:1px solid var(--border); padding:18px; border-radius:12px;">
            <div style="font-size:12px; color:var(--text-secondary); font-weight:700; text-transform:uppercase;">💾 Storage Security</div>
            <div style="font-size:20px; font-weight:800; color:var(--success, #22c55e); margin-top:6px;">🟢 Connected & Active</div>
            <div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">100% Offline Zero-Footprint</div>
          </div>

          <div class="card" style="background:var(--bg-card); border:1px solid var(--border); padding:18px; border-radius:12px;">
            <div style="font-size:12px; color:var(--text-secondary); font-weight:700; text-transform:uppercase;">🖨️ Bill & Slip Printing</div>
            <div style="font-size:20px; font-weight:800; color:var(--primary); margin-top:6px;">Ready (Offline)</div>
            <div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">Thermal & Laser Tax Invoices</div>
          </div>
        </div>

        <!-- Step-by-Step New Setup Guide -->
        <div class="card" style="background:var(--bg-card); border:1px solid var(--border); padding:24px; border-radius:14px; margin-bottom:24px;">
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:18px; border-bottom:1px solid var(--border); padding-bottom:12px;">
            <span style="font-size:26px;">📘</span>
            <div>
              <h2 style="font-size:18px; font-weight:800; color:var(--text-primary); margin:0;">
                Step-Wise Operating & Setup Guide (नया सेटअप — चरण-दर-चरण गाइड)
              </h2>
              <p style="font-size:13px; color:var(--text-secondary); margin:2px 0 0 0;">
                Follow these 6 steps whenever setting up Jwellers Edith on a new PC or for daily shop operations.
              </p>
            </div>
          </div>

          <!-- Step 1 -->
          <div style="margin-bottom:20px; padding:16px; background:var(--bg-app, rgba(0,0,0,0.02)); border-radius:10px; border-left:4px solid var(--primary);">
            <div style="display:flex; align-items:center; gap:8px; font-weight:800; font-size:15px; color:var(--primary);">
              <span>1️⃣ Step 1:</span> Shop Profile & Daily Bullion Rates (दुकान प्रोफाइल व दैनिक भाव)
            </div>
            <div style="font-size:13px; color:var(--text-primary); line-height:1.6; margin-top:8px;">
              • <strong>English</strong>: Go to <strong>Settings &gt; Shop Profile</strong> to configure your Shop Name, Address, Contact Number, GSTIN, and BIS Hallmark. On <strong>Dashboard</strong>, update daily counter rates for <strong>Gold 22K (10g)</strong> and <strong>Silver (1kg)</strong>.<br>
              • <strong>हिंदी</strong>: <strong>सेटिंग्स &gt; दुकान प्रोफाइल</strong> में जाकर दुकान का नाम, पता, फोन नंबर, GSTIN और हॉलमार्क विवरण दर्ज करें। <strong>डैशबोर्ड</strong> पर दैनिक 22K सोना (10 ग्राम) और चांदी (1 किग्रा) भाव अपडेट करें।
            </div>
          </div>

          <!-- Step 2 -->
          <div style="margin-bottom:20px; padding:16px; background:var(--bg-app, rgba(0,0,0,0.02)); border-radius:10px; border-left:4px solid var(--primary);">
            <div style="display:flex; align-items:center; gap:8px; font-weight:800; font-size:15px; color:var(--primary);">
              <span>2️⃣ Step 2:</span> Customer Directory & Girvi Calculation Engine (ग्राहक सूची व गिरवी ब्याज गणना)
            </div>
            <div style="font-size:13px; color:var(--text-primary); line-height:1.6; margin-top:8px;">
              • <strong>Girvi Loans (गिरवी प्रविष्टियां)</strong>: Record customer name, caste (जाति), address (पता), ornament description, metal weights, and monthly interest rate (%).<br>
              • <strong>Month-Based Interest Calculation (माह-आधारित गणना)</strong>: Interest is calculated directly by elapsed months. If remainder is <strong>15 days or more</strong>, it automatically counts as <strong>1 full month</strong>. If under 15 days, completed whole months are counted.<br>
              • <strong>Automatic Yearly Compounding (वार्षिक चक्रवर्ती ब्याज)</strong>: Once a loan reaches <strong>1 year (12+ months) or more</strong>, interest automatically compounds annually into principal.<br>
              • <strong>Search & Views (खोज व दृश्य)</strong>: Search real-time by token number, customer name, phone, caste (जाति), or address (पता) in English or Hindi. Switch between <strong>[ 📋 Table ]</strong> and <strong>[ 🪪 Cards ]</strong> views.<br>
              • <strong>Excel / CSV Batch Import</strong>: Import old Girvi pledge records with 1-click <strong>Undo / Redo</strong> safety.
            </div>
          </div>

          <!-- Step 3 -->
          <div style="margin-bottom:20px; padding:16px; background:var(--bg-app, rgba(0,0,0,0.02)); border-radius:10px; border-left:4px solid var(--primary);">
            <div style="display:flex; align-items:center; gap:8px; font-weight:800; font-size:15px; color:var(--primary);">
              <span>3️⃣ Step 3:</span> GST / Non-GST Billing & Khata Passbooks (बिलिंग व ग्राहक खाता बही)
            </div>
            <div style="font-size:13px; color:var(--text-primary); line-height:1.6; margin-top:8px;">
              • <strong>English</strong>: In <strong>Billing</strong>, generate computerized tax invoices with automatic CGST/SGST splitting. Unpaid credit balances automatically link to customer <strong>Khata Passbook</strong> with 1-click WhatsApp reminders.<br>
              • <strong>हिंदी</strong>: <strong>बिलिंग</strong> में कंप्यूटर बिल बनाएं (CGST/SGST स्वतः गणना)। बकाया रकम स्वतः ग्राहक की <strong>खाता बही</strong> में जुड़ जाती है जिसे 1-क्लिक में WhatsApp पर भेजा जा सकता है।
            </div>
          </div>

          <!-- Step 4 -->
          <div style="margin-bottom:20px; padding:16px; background:var(--bg-app, rgba(0,0,0,0.02)); border-radius:10px; border-left:4px solid var(--primary);">
            <div style="display:flex; align-items:center; gap:8px; font-weight:800; font-size:15px; color:var(--primary);">
              <span>4️⃣ Step 4:</span> Storage Drive & 1-Click Mirror Backup (स्टोरेज ड्राइव व 1-क्लिक मिरर बैकअप)
            </div>
            <div style="font-size:13px; color:var(--text-primary); line-height:1.6; margin-top:8px;">
              • <strong>English</strong>: Your entire jewellery shop database lives on your physical storage drive. In <strong>Backup</strong>, use 1-click <strong>Mirror Copy</strong> to duplicate your records to a secondary USB drive for safe keeping in your locker.<br>
              • <strong>हिंदी</strong>: दुकान का संपूर्ण डेटा आपकी सुरक्षित स्टोरेज ड्राइव में रहता है। <strong>बैकअप</strong> में जाकर 1-क्लिक में दूसरी पेन ड्राइव में सुरक्षित मिरर कॉपी बनाएं और अपनी तिजोरी में रखें।
            </div>
          </div>

          <!-- Step 5 -->
          <div style="margin-bottom:20px; padding:16px; background:var(--bg-app, rgba(0,0,0,0.02)); border-radius:10px; border-left:4px solid var(--primary);">
            <div style="display:flex; align-items:center; gap:8px; font-weight:800; font-size:15px; color:var(--primary);">
              <span>5️⃣ Step 5:</span> Screen Lock & Anti-Theft Security (स्क्रीन लॉक व फिजिकल सुरक्षा)
            </div>
            <div style="font-size:13px; color:var(--text-primary); line-height:1.6; margin-top:8px;">
              • <strong>English</strong>: Whenever stepping away from the counter, press <strong>Ctrl+L</strong> or double-tap <strong>Escape</strong> to lock the screen instantly. Unplugging the storage drive immediately closes database access and wipes memory, ensuring zero trace remains on the PC.<br>
              • <strong>हिंदी</strong>: काउंटर से उठते समय <strong>Ctrl+L</strong> या डबल-एस्केप दबाकर तुरंत स्क्रीन लॉक करें। पेन ड्राइव निकालते ही सॉफ्टवेयर तुरंत लॉक हो जाता है और कंप्यूटर पर कोई डेटा शेष नहीं रहता।
            </div>
          </div>

          <!-- Step 6 -->
          <div style="padding:16px; background:var(--bg-app, rgba(0,0,0,0.02)); border-radius:10px; border-left:4px solid var(--primary);">
            <div style="display:flex; align-items:center; gap:8px; font-weight:800; font-size:15px; color:var(--primary);">
              <span>6️⃣ Step 6:</span> Security, Staff Roles & Safe Updates (सुरक्षा, स्टाफ अधिकार व अपडेट्स)
            </div>
            <div style="font-size:13px; color:var(--text-primary); line-height:1.6; margin-top:8px;">
              • <strong>English</strong>: Create Staff accounts in <strong>Staff Management</strong> with restricted permissions. Future software updates guarantee <strong>zero data loss</strong>.<br>
              • <strong>हिंदी</strong>: <strong>स्टाफ प्रबंधन</strong> में कर्मचारियों के खाते बनाएं। नया अपडेट इंस्टॉल करते समय <strong>डेटा पूरी तरह सुरक्षित</strong> (Zero Data Loss) रहता है।
            </div>
          </div>

        </div>

      </div>
    `;
  },

  async init() {
    try {
      const summary = await API.invoke('girvi:getSummary');
      if (summary) {
        const elAmount = document.getElementById('rep-girvi-amount');
        const elCount = document.getElementById('rep-girvi-count');
        if (elAmount) elAmount.textContent = `₹${(summary.totalPrincipal || 0).toLocaleString('en-IN')}`;
        if (elCount) elCount.textContent = `${summary.activeLoans || 0} Active Pledges`;
      }
    } catch (_) {}

    try {
      const khataOut = await API.invoke('khata:getOutstanding');
      if (khataOut) {
        const elDues = document.getElementById('rep-khata-dues');
        const elCust = document.getElementById('rep-customer-count');
        if (elDues) elDues.textContent = `₹${(khataOut.totalOutstanding || 0).toLocaleString('en-IN')}`;
        if (elCust) elCust.textContent = `${khataOut.customerCount || 0} Customers with Balance`;
      }
    } catch (_) {}
  },

  async exportGirviCsv() {
    try {
      const loans = await API.invoke('girvi:search', { page: 1, pageSize: 10000 });
      if (!loans || !loans.data || loans.data.length === 0) {
        alert('No Girvi records found to export.');
        return;
      }
      let csv = 'Token No,Customer Name,Caste,Phone,Metal,Gold Wt(g),Silver Wt(g),Principal,Rate %,Date,Status\n';
      loans.data.forEach(l => {
        csv += `"${l.loan_number}","${l.customer_name}","${l.caste || ''}","${l.phone1 || ''}","${l.metal_type}",${l.gold_weight || 0},${l.silver_weight || 0},${l.principal_amount || 0},${l.monthly_interest_percent || 2},"${l.loan_date}","${l.status}"\n`;
      });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Girvi_Report_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
    } catch (e) {
      alert(`Export error: ${e.message}`);
    }
  },

  async exportKhataCsv() {
    try {
      const khata = await API.invoke('khata:search', { page: 1, pageSize: 10000 });
      if (!khata || !khata.data || khata.data.length === 0) {
        alert('No Khata records found to export.');
        return;
      }
      let csv = 'Customer Name,Phone,City,Balance Dues\n';
      khata.data.forEach(c => {
        csv += `"${c.name}","${c.phone1 || ''}","${c.city || ''}",${c.balance || 0}\n`;
      });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Khata_Dues_Report_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
    } catch (e) {
      alert(`Export error: ${e.message}`);
    }
  }
};

window.REPORTS_SCREEN = REPORTS_SCREEN;
