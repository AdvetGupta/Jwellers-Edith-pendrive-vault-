const { productRepository, inventoryRepository } = require('../repositories');
const { getDb } = require('../database/connection');
const { AppError } = require('../errors/app-error');
const { validateString, validateId, validateWeight, validateAmount } = require('../validation');
const audit = require('../logging/audit');

class ProductService {
  search(query) {
    return productRepository.search(query);
  }

  getById(id) {
    const product = productRepository.findById(id);
    if (!product || product.is_deleted) {
      throw AppError.notFound('Product');
    }
    return product;
  }

  create(data, userId) {
    const productName = validateString(data.product_name, 'Product name');

    const product = productRepository.create({
      product_name: productName,
      category_id: data.category_id || null,
      product_type_id: data.product_type_id || null,
      metal: data.metal || null,
      purity: data.purity || null,
      gross_weight: validateWeight(data.gross_weight),
      net_weight: validateWeight(data.net_weight),
      stone_weight: validateWeight(data.stone_weight),
      stone_type: data.stone_type || null,
      making_charge: data.making_charge !== undefined && data.making_charge !== null && data.making_charge !== '' ? validateAmount(data.making_charge) : null,
      wastage_percentage: data.wastage_percentage !== undefined && data.wastage_percentage !== null && data.wastage_percentage !== '' ? parseFloat(data.wastage_percentage) : null,
      purchase_price: data.purchase_price !== undefined && data.purchase_price !== null && data.purchase_price !== '' ? validateAmount(data.purchase_price) : null,
      selling_price: data.selling_price !== undefined && data.selling_price !== null && data.selling_price !== '' ? validateAmount(data.selling_price) : null,
      supplier_id: data.supplier_id || null,
      quantity_in_stock: data.quantity_in_stock !== undefined ? parseFloat(data.quantity_in_stock) || 0 : 0,
      unit: data.unit || 'gms',
      description: data.description || null,
      hallmark_details: data.hallmark_details || null,
      hsn_code: data.hsn_code || null,
      is_active: data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1
    });

    audit.log(userId, 'PRODUCT_CREATED', 'product', product.id, `Created product ${productName}`);

    return productRepository.findById(product.id);
  }

  update(id, data, userId) {
    const existing = this.getById(id);

    const updates = {};
    if (data.product_name !== undefined) updates.product_name = validateString(data.product_name, 'Product name');
    if (data.category_id !== undefined) updates.category_id = data.category_id || null;
    if (data.product_type_id !== undefined) updates.product_type_id = data.product_type_id || null;
    if (data.metal !== undefined) updates.metal = data.metal || null;
    if (data.purity !== undefined) updates.purity = data.purity || null;
    if (data.gross_weight !== undefined) updates.gross_weight = validateWeight(data.gross_weight);
    if (data.net_weight !== undefined) updates.net_weight = validateWeight(data.net_weight);
    if (data.stone_weight !== undefined) updates.stone_weight = validateWeight(data.stone_weight);
    if (data.stone_type !== undefined) updates.stone_type = data.stone_type || null;
    if (data.making_charge !== undefined) updates.making_charge = data.making_charge !== '' ? validateAmount(data.making_charge) : null;
    if (data.wastage_percentage !== undefined) updates.wastage_percentage = data.wastage_percentage !== '' ? parseFloat(data.wastage_percentage) : null;
    if (data.purchase_price !== undefined) updates.purchase_price = data.purchase_price !== '' ? validateAmount(data.purchase_price) : null;
    if (data.selling_price !== undefined) updates.selling_price = data.selling_price !== '' ? validateAmount(data.selling_price) : null;
    if (data.supplier_id !== undefined) updates.supplier_id = data.supplier_id || null;
    if (data.unit !== undefined) updates.unit = data.unit || 'gms';
    if (data.description !== undefined) updates.description = data.description || null;
    if (data.hallmark_details !== undefined) updates.hallmark_details = data.hallmark_details || null;
    if (data.hsn_code !== undefined) updates.hsn_code = data.hsn_code || null;
    if (data.is_active !== undefined) updates.is_active = data.is_active ? 1 : 0;

    updates.updated_at = new Date().toISOString();
    productRepository.update(id, updates);

    audit.log(userId, 'PRODUCT_UPDATED', 'product', id, `Updated product ${updates.product_name || existing.product_name}`);

    return productRepository.findById(id);
  }

  softDelete(id, userId) {
    const existing = this.getById(id);
    productRepository.update(id, { is_deleted: 1, is_active: 0, updated_at: new Date().toISOString() });
    audit.log(userId, 'PRODUCT_DELETED', 'product', id, `Deleted product ${existing.product_name}`);
    return { deleted: true };
  }

  getLowStock(threshold = 5) {
    return productRepository.findLowStock(threshold);
  }
}

module.exports = new ProductService();