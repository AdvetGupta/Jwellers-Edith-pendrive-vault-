const { productRepository, inventoryRepository } = require('../repositories');
const { AppError } = require('../errors/app-error');
const { validateEnum } = require('../validation');
const { VALID_MOVEMENT_TYPES } = require('../validation/schemas');
const TransactionManager = require('../database/transaction_manager');
const audit = require('../logging/audit');

class InventoryService {
  getMovements(productId) {
    return inventoryRepository.findByProduct(productId);
  }

  getStockHistory(productId) {
    return inventoryRepository.getProductStockHistory(productId);
  }

  adjustStock(productId, data, userId) {
    const product = productRepository.findById(productId);
    if (!product || product.is_deleted) {
      throw AppError.notFound('Product');
    }

    const movementType = validateEnum(data.movement_type, VALID_MOVEMENT_TYPES, 'Movement type');
    const qtyChange = data.quantity_change !== undefined ? parseFloat(data.quantity_change) : 0;
    if (isNaN(qtyChange) || qtyChange === 0) {
      throw AppError.validation('Quantity change must be a non-zero number');
    }

    const notes = data.notes || null;

    return TransactionManager.execute((txDb) => {
      const currentQty = txDb.prepare('SELECT quantity_in_stock FROM products WHERE id = ?').get(productId).quantity_in_stock;
      const newQty = currentQty + qtyChange;

      if (newQty < 0) {
        throw AppError.validation('Insufficient stock. Available: ' + currentQty);
      }

      inventoryRepository.recordMovement(productId, movementType, currentQty, qtyChange, newQty, userId, null, notes);

      productRepository.updateStock(productId, newQty);

      audit.log(userId, 'STOCK_ADJUSTED', 'product', productId, `Stock ${movementType}: ${currentQty} → ${newQty} (change: ${qtyChange})`);

      return {
        product_id: productId,
        movement_type: movementType,
        quantity_before: currentQty,
        quantity_change: qtyChange,
        quantity_after: newQty,
        product_name: product.product_name
      };
    });
  }
}

module.exports = new InventoryService();