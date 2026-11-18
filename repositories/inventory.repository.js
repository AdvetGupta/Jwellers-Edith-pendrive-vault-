const BaseRepository = require('./base_repository');

class InventoryMovementRepository extends BaseRepository {
  constructor() {
    super('inventory_movements');
  }

  findByProduct(productId) {
    return this.findAll({
      where: { product_id: productId },
      orderBy: 'created_at DESC'
    });
  }

  findByBill(billId) {
    return this.findAll({
      where: { bill_id: billId },
      orderBy: 'created_at ASC'
    });
  }

  getProductStockHistory(productId) {
    return this.findAll({
      where: { product_id: productId },
      orderBy: 'created_at ASC'
    });
  }

  recordMovement(productId, movementType, qtyBefore, qtyChange, qtyAfter, userId, billId = null, notes = null) {
    return this.create({
      product_id: productId,
      movement_type: movementType,
      quantity_before: qtyBefore,
      quantity_change: qtyChange,
      quantity_after: qtyAfter,
      bill_id: billId,
      user_id: userId,
      notes: notes
    });
  }
}

module.exports = new InventoryMovementRepository();
