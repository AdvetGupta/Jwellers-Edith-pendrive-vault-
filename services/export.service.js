const path = require('path');
const fs = require('fs');
const { AppError } = require('../errors/app-error');
const logger = require('../logging/logger');

class ExportService {
  constructor() {
    this.exportDir = null;
  }

  setExportDir(dir) {
    this.exportDir = dir;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  getExportDir() {
    if (this.exportDir) return this.exportDir;
    const defaultDir = path.join(process.env.APPDATA || __dirname, '..', 'exports');
    if (!fs.existsSync(defaultDir)) {
      fs.mkdirSync(defaultDir, { recursive: true });
    }
    this.exportDir = defaultDir;
    return defaultDir;
  }

  generateFileName(prefix, extension) {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-');
    return `${prefix}_${dateStr}_${timeStr}.${extension}`;
  }

  exportToCSV(data, columns, fileName) {
    try {
      const exportDir = this.getExportDir();
      const filePath = path.join(exportDir, fileName);

      const header = columns.map(c => this.escapeCSV(c.label)).join(',');
      const rows = data.map(row => {
        return columns.map(col => {
          const value = col.accessor(row);
          return this.escapeCSV(value !== null && value !== undefined ? String(value) : '');
        }).join(',');
      });

      const csvContent = [header, ...rows].join('\n');
      fs.writeFileSync(filePath, '\uFEFF' + csvContent, 'utf-8');

      return { path: filePath, fileName, rows: data.length };
    } catch (err) {
      logger.error('CSV export failed', { error: err.message, fileName });
      throw AppError.file('Export to CSV failed: ' + err.message);
    }
  }

  escapeCSV(value) {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return '"' + value.replace(/"/g, '""') + '"';
    }
    return value;
  }
}

module.exports = new ExportService();
