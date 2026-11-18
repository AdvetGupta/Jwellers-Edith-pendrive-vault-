const girviService = require('../../services/girvi.service');
const { parseCSVContent } = require('../../utils/girvi_importer');
const { requirePermission } = require('../../security/permission');
const { getUserIdFromEvent } = require('./index');
const fs = require('fs');

const handlers = [
  {
    channel: 'girvi:search',
    handler: async (event, query) => {
      const userId = getUserIdFromEvent(event);
      if (userId) requirePermission(userId, 'customer.view');
      return girviService.searchLoans(query || {});
    }
  },
  {
    channel: 'girvi:getById',
    handler: async (event, args) => {
      const id = typeof args === 'object' && args !== null ? args.id : args;
      const userId = getUserIdFromEvent(event);
      if (userId) requirePermission(userId, 'customer.view');
      return girviService.getLoanById(id);
    }
  },
  {
    channel: 'girvi:create',
    handler: async (event, loanData) => {
      const userId = getUserIdFromEvent(event);
      if (userId) requirePermission(userId, 'customer.create');
      return girviService.createLoan(loanData, userId);
    }
  },
  {
    channel: 'girvi:update',
    handler: async (event, args = {}) => {
      const id = args.id;
      const data = args.data || args;
      const userId = getUserIdFromEvent(event);
      if (userId) requirePermission(userId, 'customer.edit');
      return girviService.updateLoan(id, data, userId);
    }
  },
  {
    channel: 'girvi:delete',
    handler: async (event, args) => {
      const id = typeof args === 'object' && args !== null ? args.id : args;
      const userId = getUserIdFromEvent(event);
      if (userId) requirePermission(userId, 'customer.delete');
      return girviService.softDeleteLoan(id, userId);
    }
  },
  {
    channel: 'girvi:permanentDelete',
    handler: async (event, args) => {
      const id = typeof args === 'object' && args !== null ? args.id : args;
      const userId = getUserIdFromEvent(event);
      if (userId) requirePermission(userId, 'customer.delete');
      return girviService.permanentDeleteLoan(id, userId);
    }
  },

  {
    channel: 'girvi:recordPayment',
    handler: async (event, paymentData) => {
      const userId = getUserIdFromEvent(event);
      if (userId) requirePermission(userId, 'payment.create');
      return girviService.recordPayment(paymentData, userId);
    }
  },
  {
    channel: 'girvi:deletePayment',
    handler: async (event, args = {}) => {
      const { transactionId, loanId } = args;
      const userId = getUserIdFromEvent(event);
      if (userId) requirePermission(userId, 'payment.create');
      return girviService.deletePayment(transactionId, loanId, userId);
    }
  },
  {
    channel: 'girvi:getSummary',
    handler: async (event) => {
      const userId = getUserIdFromEvent(event);
      if (userId) requirePermission(userId, 'customer.view');
      return girviService.getSummary();
    }
  },
  {
    channel: 'girvi:importExcel',
    handler: async (event, { filePath, content } = {}) => {
      const userId = getUserIdFromEvent(event);
      if (userId) requirePermission(userId, 'customer.create');

      let fileContent = content;
      if (!fileContent && filePath && fs.existsSync(filePath)) {
        fileContent = fs.readFileSync(filePath, 'utf8');
      }
      if (!fileContent) throw new Error('File content is empty');

      const parsed = parseCSVContent(fileContent);
      const imported = [];
      const errors = [];
      const batchId = `batch_${Date.now()}`;

      for (const row of parsed.parsedRows) {
        try {
          if (row.principal_amount > 0) {
            const newLoan = girviService.createLoan(row, userId);
            imported.push(newLoan);
          }
        } catch (err) {
          errors.push(`Row ${row.rawLineNumber} (${row.customer_name}): ${err.message}`);
        }
      }

      if (imported.length > 0) {
        girviService.recordImportBatch({
          batchId,
          timestamp: new Date().toISOString(),
          totalRows: parsed.parsedRows.length,
          successCount: imported.length,
          loanIds: imported.map(l => l.id)
        });
      }

      return {
        totalRows: parsed.parsedRows.length,
        successCount: imported.length,
        errorCount: errors.length,
        errors,
        imported,
        batchId
      };
    }
  },
  {
    channel: 'girvi:getImportStatus',
    handler: async () => {
      return girviService.getImportStatus();
    }
  },
  {
    channel: 'girvi:undoLastImport',
    handler: async (event) => {
      const userId = getUserIdFromEvent(event);
      if (userId) requirePermission(userId, 'customer.delete');
      return girviService.undoLastImport(userId);
    }
  },
  {
    channel: 'girvi:redoLastImport',
    handler: async (event) => {
      const userId = getUserIdFromEvent(event);
      if (userId) requirePermission(userId, 'customer.create');
      return girviService.redoLastImport(userId);
    }
  }
];

module.exports = handlers;
