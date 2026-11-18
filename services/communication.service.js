const { getDb } = require('../database/connection');
const { customerRepository, billRepository, paymentRepository } = require('../repositories');
const { AppError } = require('../errors/app-error');
const { validateId, validateEnum, validateString, validateOptionalString } = require('../validation');
const { VALID_COMM_TYPES, VALID_MESSAGE_TYPES } = require('../validation/schemas');
const logger = require('../logging/logger');
const audit = require('../logging/audit');

class CommunicationService {
  send(userId, data) {
    let customerId = data.customer_id ? parseInt(data.customer_id, 10) : null;
    let customer = (customerId && !isNaN(customerId) && customerId > 0) ? customerRepository.findById(customerId) : null;
    if (!customer && (data.recipient_number || data.phone || data.customer_name)) {
      customer = {
        id: customerId || null,
        name: data.customer_name || 'Customer',
        phone1: data.recipient_number || data.phone || '',
        phone2: null
      };
    }
    if (!customer) throw AppError.notFound('Customer');

    const commType = validateEnum(data.communication_type, VALID_COMM_TYPES, 'Communication type');
    const messageType = validateEnum(data.message_type, VALID_MESSAGE_TYPES, 'Message type');
    const billId = data.bill_id ? validateId(data.bill_id, 'Bill ID') : null;
    const paymentId = data.payment_id ? validateId(data.payment_id, 'Payment ID') : null;

    const recipientNumber = data.recipient_number || customer.phone1 || customer.phone2;
    if (!recipientNumber) {
      throw AppError.validation('No phone number available for this customer');
    }

    const message = this._buildMessage(messageType, { customer, billId, paymentId, data });
    const customMessage = data.custom_message ? validateString(data.custom_message, 'Custom message', 1000) : null;

    let status = 'sent';
    let errorMessage = null;
    let result = null;

    try {
      if (commType === 'whatsapp') {
        result = this._prepareWhatsApp(recipientNumber, customMessage || message);
      } else if (commType === 'sms') {
        result = this._prepareSMS(recipientNumber, customMessage || message);
      }

      this._log({
        customer_id: customerId,
        communication_type: commType,
        message_type: messageType,
        bill_id: billId,
        payment_id: paymentId,
        recipient_number: recipientNumber,
        message_content: customMessage || message,
        status,
        user_id: userId
      });

      audit.log(userId, 'COMMUNICATION_SENT', 'communication_logs', null,
        `${commType} ${messageType} sent to ${customer.name} (${recipientNumber})`);
    } catch (err) {
      status = 'failed';
      errorMessage = err.message;

      this._log({
        customer_id: customerId,
        communication_type: commType,
        message_type: messageType,
        bill_id: billId,
        payment_id: paymentId,
        recipient_number: recipientNumber,
        message_content: customMessage || message,
        status,
        error_message: errorMessage,
        user_id: userId
      });

      logger.error('Communication failed', { error: errorMessage, commType, customerId });
    }

    return {
      success: status === 'sent',
      type: commType,
      messageType,
      recipient: recipientNumber,
      status,
      error: errorMessage,
      ...result
    };
  }

  _prepareWhatsApp(phone, message) {
    let digits = String(phone || '').replace(/\D/g, '');
    let cleaned = digits;
    if (digits.length === 10) {
      cleaned = '91' + digits;
    } else if (digits.length === 11 && digits.startsWith('0')) {
      cleaned = '91' + digits.slice(1);
    } else if (digits.length === 12 && digits.startsWith('91')) {
      cleaned = digits;
    } else if (digits.length > 10) {
      cleaned = '91' + digits.slice(-10);
    }
    const encText = encodeURIComponent(message);
    const url = `https://api.whatsapp.com/send?phone=${cleaned}&text=${encText}`;
    const webUrl = `https://web.whatsapp.com/send?phone=${cleaned}&text=${encText}`;
    const appUrl = `whatsapp://send?phone=${cleaned}&text=${encText}`;
    return { whatsappUrl: url, webWhatsappUrl: webUrl, appWhatsappUrl: appUrl, message, cleanedPhone: cleaned };
  }

  _prepareSMS(phone, message) {
    let cleaned = String(phone || '').replace(/\D/g, '');
    if (cleaned.length === 10) {
      cleaned = '91' + cleaned;
    }
    return {
      smsTo: cleaned,
      smsBody: message,
      note: 'SMS provider not configured. Message logged for sending.'
    };
  }

  _buildMessage(messageType, { customer, billId, paymentId, data = {} }) {
    const shop = this._getShopDetails();
    const shopName = (shop && shop.shop_name && shop.shop_name.trim()) ? shop.shop_name.trim() : "ad jwellers";
    const customerName = (customer && customer.name && customer.name.trim()) ? customer.name.trim() : "Customer";
    const shopContact = shop.whatsapp_number || shop.phone || shop.phone1 || "";
    const contactLineH = shopContact ? ("\n📞 *संपर्क:* " + shopContact) : "";
    const contactLineE = shopContact ? ("\n📞 *Contact:* " + shopContact) : "";
    const upiId = shop.upi_id || shop.phone || shop.whatsapp_number || "";
    const upiLineH = upiId ? ("\n💳 *UPI भुगतान ID:* `" + upiId + "`") : "";
    const upiLineE = upiId ? ("\n💳 *UPI Payment ID:* `" + upiId + "`") : "";

    switch (messageType) {
      case "invoice": {
        const bill = billId ? billRepository.findById(billId) : null;
        const invNumber = bill ? bill.invoice_number : "";
        const amount = bill ? (bill.grand_total || 0).toLocaleString("en-IN") : "";

        const hindiMsg = `नमस्ते *${customerName} जी* 🙏\n\n*${shopName}* में खरीदारी करने के लिए आपका बहुत-बहुत धन्यवाद!\n\n📜 *बिल सं. (Invoice No):* #${invNumber}\n💰 *कुल राशि (Bill Amount):* ₹${amount}\n\nहम आपके विश्वास और संबंध की सराहना करते हैं।${contactLineH}\n\nसादर,\n*🏢 ${shopName}*`;

        const englishMsg = `Namaste *${customerName} ji* 🙏\n\nThank you for shopping at *${shopName}*!\n\n📜 *Invoice No:* #${invNumber}\n💰 *Total Amount:* ₹${amount}\n\nWe truly appreciate your trust and relationship with us!${contactLineE}\n\nRegards,\n*🏢 ${shopName}*`;

        return `${hindiMsg}\n\n──────────────────────\n\n${englishMsg}`;
      }

      case "payment_confirmation": {
        const payment = paymentId ? paymentRepository.findById(paymentId) : null;
        const payAmount = payment ? (payment.amount || 0).toLocaleString("en-IN") : (data.amount || "");

        const hindiMsg = `नमस्ते *${customerName} जी* 🙏\n\n*${shopName}* में आपकी बकाया भुगतान राशि सफलतापूर्वक प्राप्त हो गई है।\n\n💵 *प्राप्त राशि (Received Amount):* *₹${payAmount}*\n\nसमय पर भुगतान करने के लिए आपका धन्यवाद!${contactLineH}\n\nसादर,\n*🏢 ${shopName}*`;

        const englishMsg = `Namaste *${customerName} ji* 🙏\n\nYour payment has been successfully received at *${shopName}*.\n\n💵 *Amount Received:* *₹${payAmount}*\n\nThank you for your timely payment!${contactLineE}\n\nRegards,\n*🏢 ${shopName}*`;

        return `${hindiMsg}\n\n──────────────────────\n\n${englishMsg}`;
      }

      case "deposit_confirmation": {
        const depAmount = (data.amount || 0).toLocaleString ? (data.amount || 0).toLocaleString("en-IN") : (data.amount || "");
        const notesH = data.notes ? `\n📝 *विवरण:* ${data.notes}` : "";
        const notesE = data.notes ? `\n📝 *Purpose:* ${data.notes}` : "";

        const hindiMsg = `नमस्ते *${customerName} जी* 🙏\n\n*${shopName}* में आपकी अग्रिम अमानत (एडवांस जमा) राशि सफलतापूर्वक दर्ज कर ली गई है।\n\n💎 *जमा अग्रिम राशि (Advance Deposit):* *₹${depAmount}*${notesH}\n\nयह राशि आपके अगले आभूषण बिल में समायोजित (Adjust) कर दी जाएगी। हम पर विश्वास बनाए रखने के लिए धन्यवाद!${contactLineH}\n\nसादर,\n*🏢 ${shopName}*`;

        const englishMsg = `Namaste *${customerName} ji* 🙏\n\nYour advance deposit booking has been successfully recorded at *${shopName}*.\n\n💎 *Advance Deposit Amount:* *₹${depAmount}*${notesE}\n\nThis deposit will be credited against your upcoming jewellery purchase. Thank you for placing your trust with us!${contactLineE}\n\nRegards,\n*🏢 ${shopName}*`;

        return `${hindiMsg}\n\n──────────────────────\n\n${englishMsg}`;
      }

      case "khata_reminder": {
        const balance = (parseFloat(data.balance_amount) || 0).toLocaleString("en-IN");

        const hindiMsg = `नमस्ते *${customerName} जी* 🙏\n\nयह *${shopName}* से आपके खाता शेष (बकाया) के संबंध में एक विनम्र सूचना है।\n\n💰 *कुल बकाया राशि (Pending Balance):* *₹${balance}*${upiLineH}\n\nकृपया अपनी सुविधानुसार बकाया राशि का भुगतान करने का कष्ट करें। यदि आप पहले ही भुगतान कर चुके हैं, तो कृपया इस संदेश को अनदेखा करें।${contactLineH}\n\nधन्यवाद!\n*🏢 ${shopName}*`;

        const englishMsg = `Namaste *${customerName} ji* 🙏\n\nThis is a polite reminder from *${shopName}* regarding your pending Khata balance.\n\n💰 *Total Pending Balance:* *₹${balance}*${upiLineE}\n\nKindly clear your dues at your earliest convenience. If you have already paid, please ignore this message.${contactLineE}\n\nThank you!\n*🏢 ${shopName}*`;

        return `${hindiMsg}\n\n──────────────────────\n\n${englishMsg}`;
      }

      case "girvi_reminder": {
        const loanNo = data.loan_number || "";
        const itemName = data.item_name || "आभूषण / Ornament";
        const principal = (parseFloat(data.principal_amount) || 0).toLocaleString("en-IN");
        const dues = data.dues || {};
        const duesAmount = (parseFloat(dues.totalDues || data.total_dues) || 0).toLocaleString("en-IN");
        const duration = dues.durationFormatted || (data.duration ? data.duration : "");
        const durationLineH = duration ? ("\n⏳ *अवधि (Duration):* " + duration) : "";
        const durationLineE = duration ? ("\n⏳ *Duration:* " + duration) : "";

        const hindiMsg = `नमस्ते *${customerName} जी* 🙏\n\nयह *${shopName}* में आपकी गिरवी रसीद *#${loanNo}* के संबंध में सूचना है।\n\n💍 *आभूषण:* ${itemName}\n💵 *मूल रकम:* ₹${principal}${durationLineH}\n💰 *कुल देय राशि:* *₹${duesAmount}*${upiLineH}\n\nब्याज जमा करने अथवा गिरवी छुड़ाने हेतु कृपया दुकान पर पधारें या संपर्क करें।${contactLineH}\n\nधन्यवाद!\n*🏢 ${shopName}*`;

        const englishMsg = `Namaste *${customerName} ji* 🙏\n\nThis is a reminder regarding your Girvi Pledge ticket *#${loanNo}* at *${shopName}*.\n\n💍 *Ornament / Item:* ${itemName}\n💵 *Principal Amount:* ₹${principal}${durationLineE}\n💰 *Total Outstanding:* *₹${duesAmount}*${upiLineE}\n\nKindly visit our shop or contact us for interest payment or redemption.${contactLineE}\n\nThank you!\n*🏢 ${shopName}*`;

        return `${hindiMsg}\n\n──────────────────────\n\n${englishMsg}`;
      }

      case "girvi_receipt": {
        const loanNo = data.loan_number || "";
        const itemName = data.item_name || "आभूषण / Ornament";
        const principal = (parseFloat(data.principal_amount) || 0).toLocaleString("en-IN");
        const rate = data.monthly_interest_percent || 2;

        const hindiMsg = `नमस्ते *${customerName} जी* 🙏\n\n*${shopName}* में आपकी गिरवी रसीद *#${loanNo}* सफलतापूर्वक दर्ज कर ली गई है।\n\n💍 *आभूषण:* ${itemName}\n💵 *स्वीकृत ऋण रकम:* ₹${principal}\n📈 *मासिक ब्याज दर:* ${rate}% प्रतिमाह\n\nहम पर विश्वास करने के लिए धन्यवाद!${contactLineH}\n\nसादर,\n*🏢 ${shopName}*`;

        const englishMsg = `Namaste *${customerName} ji* 🙏\n\nYour Girvi Pledge *#${loanNo}* has been successfully registered at *${shopName}*.\n\n💍 *Item / Ornament:* ${itemName}\n💵 *Loan Disbursed:* ₹${principal}\n📈 *Monthly Interest Rate:* ${rate}% per month\n\nThank you for placing your trust with us!${contactLineE}\n\nRegards,\n*🏢 ${shopName}*`;

        return `${hindiMsg}\n\n──────────────────────\n\n${englishMsg}`;
      }

      case "custom": {
        return data.custom_message || ("नमस्ते " + customerName + " जी - *" + shopName + "*");
      }
      default:
        return "नमस्ते " + customerName + " जी - *" + shopName + "*";
    }
  }

  _getShopDetails() {
    try {
      const { ShopSettingsRepository } = require('../repositories');
      const settings = ShopSettingsRepository ? ShopSettingsRepository.get() : null;
      if (settings && settings.shop_name) return settings;
      const db = getDb();
      if (db) {
        const row = db.prepare("SELECT * FROM shop_settings WHERE id = 1").get();
        if (row && row.shop_name) return row;
      }
      return { shop_name: 'ad jwellers', phone: '9179783789', whatsapp_number: '9179783789' };
    } catch {
      return { shop_name: 'ad jwellers', phone: '9179783789', whatsapp_number: '9179783789' };
    }
  }

  _log(data) {
    const db = getDb();
    try {
      db.prepare(`
        INSERT INTO communication_logs (customer_id, communication_type, message_type, bill_id, payment_id, recipient_number, message_content, status, error_message, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        data.customer_id, data.communication_type, data.message_type,
        data.bill_id || null, data.payment_id || null,
        data.recipient_number, data.message_content || null,
        data.status, data.error_message || null, data.user_id || null
      );
      return db.lastInsertRowid;
    } catch (e) {
      if (e.message && e.message.includes('CHECK constraint failed')) {
        try {
          db.prepare(`
            INSERT INTO communication_logs (customer_id, communication_type, message_type, bill_id, payment_id, recipient_number, message_content, status, error_message, user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            data.customer_id, data.communication_type, 'custom',
            data.bill_id || null, data.payment_id || null,
            data.recipient_number, `[${data.message_type}] ${data.message_content || ''}`,
            data.status, data.error_message || null, data.user_id || null
          );
          return db.lastInsertRowid;
        } catch (_) {}
      }
      return null;
    }
  }

  getHistory(customerId, limit = 20) {
    const db = getDb();
    return db.prepare(`
      SELECT cl.*, u.display_name as user_name
      FROM communication_logs cl
      LEFT JOIN users u ON u.id = cl.user_id
      WHERE cl.customer_id = ?
      ORDER BY cl.created_at DESC
      LIMIT ?
    `).all(customerId, limit);
  }

  search(query = {}) {
    const { parsePagination, buildMeta } = require('../utils/pagination');
    const { page, pageSize } = parsePagination(query);
    const db = getDb();

    const conditions = [];
    const params = [];

    if (query.customer_id) {
      conditions.push("cl.customer_id = ?");
      params.push(parseInt(query.customer_id, 10));
    }
    if (query.communication_type) {
      conditions.push("cl.communication_type = ?");
      params.push(query.communication_type);
    }
    if (query.message_type) {
      conditions.push("cl.message_type = ?");
      params.push(query.message_type);
    }
    if (query.status) {
      conditions.push("cl.status = ?");
      params.push(query.status);
    }
    if (query.date_from) {
      conditions.push("cl.created_at >= ?");
      params.push(query.date_from);
    }
    if (query.date_to) {
      conditions.push("cl.created_at <= ?");
      params.push(query.date_to);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const total = db.prepare(`SELECT COUNT(*) as count FROM communication_logs cl ${whereClause}`).get(...params).count;

    const data = db.prepare(`
      SELECT cl.*, c.name as customer_name, u.display_name as user_name
      FROM communication_logs cl
      LEFT JOIN customers c ON c.id = cl.customer_id
      LEFT JOIN users u ON u.id = cl.user_id
      ${whereClause}
      ORDER BY cl.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, (page - 1) * pageSize);

    return { data, pagination: buildMeta(total, page, pageSize) };
  }
}

module.exports = new CommunicationService();
