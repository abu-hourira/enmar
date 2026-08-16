// db-service.js - High-performance MySQL Data Access Layer for ENMAR
const pool = require('../config/db.js');
const crypto = require('crypto');

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function safeJsonParse(str, fallback = null) {
  if (!str) return fallback;
  if (typeof str === 'object') return str;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function formatUser(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    name: row.name || '',
    email: row.email || '',
    phone: row.phone || '',
    avatar: row.avatar || '',
    designation: row.designation || '',
    bio: row.bio || '',
    address: row.address || '',
    city: row.city || '',
    zip: row.zip || '',
    notes: row.notes || '',
    role: row.role || 'customer',
    active: Boolean(row.active),
    passwordHash: row.password_hash || '',
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
  };
}

function formatProduct(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    name: row.name || '',
    farm: row.farm || '',
    price: Number(row.price || 0),
    unit: row.unit || 'kg',
    cat: row.category || 'General',
    category: row.category || 'General',
    icon: row.icon || 'leaf',
    tag: row.tag || '',
    lot: row.lot || '',
    discount: Number(row.discount || 0),
    description: row.description || '',
    images: safeJsonParse(row.images, []),
    active: Boolean(row.active),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
  };
}

function formatOrder(row, items = []) {
  if (!row) return null;
  const conv = safeJsonParse(row.conversation, {});
  const conversation = Array.isArray(conv) ? conv : (conv.conversation || []);
  const history = Array.isArray(conv.history) ? conv.history : (Array.isArray(conv) ? conv.filter(c => c.action) : []);
  const messages = Array.isArray(conv.messages) ? conv.messages : (Array.isArray(conv) ? conv.filter(c => c.text) : []);

  return {
    id: Number(row.id),
    number: row.order_number,
    userId: row.user_id ? Number(row.user_id) : null,
    customerName: row.customer_name || '',
    customerPhone: row.customer_phone || '',
    deliveryAddress: row.delivery_address || '',
    deliveryCity: row.delivery_city || '',
    deliveryZip: row.delivery_zip || '',
    deliveryNotes: row.delivery_notes || '',
    customer: {
      name: row.customer_name || '',
      phone: row.customer_phone || '',
      address: row.delivery_address || '',
      city: row.delivery_city || '',
      zip: row.delivery_zip || '',
      notes: row.delivery_notes || ''
    },
    delivery: {
      name: row.customer_name || '',
      phone: row.customer_phone || '',
      address: row.delivery_address || '',
      city: row.delivery_city || '',
      zip: row.delivery_zip || '',
      notes: row.delivery_notes || ''
    },
    paymentMethod: row.payment_method || 'Cash on Delivery',
    subtotal: Number(row.subtotal || 0),
    deliveryFee: Number(row.shipping || 0),
    shipping: Number(row.shipping || 0),
    total: Number(row.total || 0),
    status: row.status || 'Pending',
    estimatedDelivery: row.estimated_delivery || '24–48 hours',
    orderMessage: row.order_message || '',
    conversation: Array.isArray(conversation) ? conversation : [],
    history: Array.isArray(history) && history.length ? history : [
      { id: 1, action: 'Order Placed', detail: `Order placed via ${row.payment_method || 'Cash on Delivery'}`, actor: 'customer', actorName: row.customer_name || 'Customer', timestamp: row.created_at }
    ],
    messages: Array.isArray(messages) ? messages : [],
    cancelledBy: conv.cancelledBy || (row.status === 'Cancelled' ? 'customer' : null),
    cancelledAt: conv.cancelledAt || null,
    cancelReason: conv.cancelReason || '',
    confirmedAt: conv.confirmedAt || null,
    confirmedBy: conv.confirmedBy || null,
    customerHidden: Boolean(row.customer_hidden),
    items: items.map(it => ({
      id: it.product_id ? Number(it.product_id) : null,
      name: it.product_name || 'Product',
      price: Number(it.unit_price || 0),
      qty: Number(it.quantity || 1),
      unit: it.unit || 'kg',
      total: Number(it.total_price || 0)
    })),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
  };
}

const dbService = {
  // ─── 1. USERS ───
  async findUserByEmail(email) {
    if (!email) return null;
    const [rows] = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1', [String(email).trim()]);
    return formatUser(rows[0]);
  },

  async findUserById(id) {
    if (!id) return null;
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [Number(id)]);
    return formatUser(rows[0]);
  },

  async findUserByEmail(email) {
    if (!email) return null;
    const norm = String(email).toLowerCase().trim();
    const [rows] = await pool.query('SELECT * FROM users WHERE LOWER(email) = ? LIMIT 1', [norm]);
    return formatUser(rows[0]);
  },

  async getUserByEmail(email) {
    return this.findUserByEmail(email);
  },

  async findUserByPhone(phone) {
    if (!phone) return null;
    const clean = String(phone).replace(/\s+/g, '').replace(/^(?:\+88|88)/, '');
    const [rows] = await pool.query('SELECT * FROM users WHERE phone = ? OR phone = ? LIMIT 1', [phone, clean]);
    return formatUser(rows[0]);
  },

  async getAllUsers() {
    const [rows] = await pool.query('SELECT * FROM users ORDER BY id ASC');
    return rows.map(formatUser);
  },

  async createUser(u) {
    const [res] = await pool.query(
      `INSERT INTO users (name, email, phone, password_hash, role, active, avatar, designation, bio, address, city, zip, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        u.name || 'Customer',
        String(u.email).toLowerCase().trim(),
        u.phone || '',
        u.passwordHash || '',
        u.role || 'customer',
        u.active !== false,
        u.avatar || '',
        u.designation || '',
        u.bio || '',
        u.address || '',
        u.city || '',
        u.zip || '',
        u.notes || ''
      ]
    );
    return await dbService.findUserById(res.insertId);
  },

  async updateUser(id, fields) {
    const allowed = ['name', 'email', 'phone', 'avatar', 'designation', 'bio', 'address', 'city', 'zip', 'notes', 'role', 'active'];
    const updates = [];
    const values = [];

    for (const key of allowed) {
      if (fields[key] !== undefined) {
        updates.push(`\`${key}\` = ?`);
        values.push(fields[key]);
      }
    }
    if (fields.passwordHash !== undefined) {
      updates.push('`password_hash` = ?');
      values.push(fields.passwordHash);
    }

    if (updates.length === 0) return await dbService.findUserById(id);

    values.push(Number(id));
    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
    return await dbService.findUserById(id);
  },

  async updatePassword(id, passwordHash) {
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, Number(id)]);
    return true;
  },

  async deleteUser(id) {
    await pool.query('DELETE FROM users WHERE id = ?', [Number(id)]);
    return true;
  },

  // ─── 2. SESSIONS (Stored in user_sessions) ───
  async createSession(userId, token, ttlMs = 7 * 86400000) {
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + ttlMs);
    await pool.query(
      `INSERT INTO user_sessions (user_id, token_hash, expires_at)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE expires_at = VALUES(expires_at)`,
      [Number(userId), tokenHash, expiresAt]
    );
    return true;
  },

  async getSessionUser(token) {
    if (!token) return null;
    const tokenHash = hashToken(token);
    const [rows] = await pool.query(
      `SELECT u.* FROM user_sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token_hash = ? AND s.expires_at > NOW() AND u.active = 1
       LIMIT 1`,
      [tokenHash]
    );
    return formatUser(rows[0]);
  },

  async deleteSession(token) {
    if (!token) return;
    const tokenHash = hashToken(token);
    await pool.query('DELETE FROM user_sessions WHERE token_hash = ?', [tokenHash]);
  },

  async cleanExpiredSessions() {
    await pool.query('DELETE FROM user_sessions WHERE expires_at <= NOW()');
  },

  // ─── 3. PRODUCTS ───
  async getActiveProducts() {
    const [rows] = await pool.query('SELECT * FROM products WHERE active = 1 ORDER BY id ASC');
    return rows.map(formatProduct);
  },

  async getAllProductsAdmin() {
    const [rows] = await pool.query('SELECT * FROM products ORDER BY id DESC');
    return rows.map(formatProduct);
  },

  async getProductById(id) {
    const [rows] = await pool.query('SELECT * FROM products WHERE id = ? LIMIT 1', [Number(id)]);
    return formatProduct(rows[0]);
  },

  async createProduct(p) {
    if (p && p.id) {
      await pool.query(
        `INSERT INTO products (id, name, farm, price, unit, category, icon, tag, lot, discount, description, images, active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          Number(p.id),
          p.name || 'Organic Product',
          p.farm || '',
          Number(p.price || 0),
          p.unit || 'kg',
          p.cat || p.category || 'General',
          p.icon || 'leaf',
          p.tag || '',
          p.lot || '',
          Number(p.discount || 0),
          p.description || '',
          JSON.stringify(p.images || []),
          p.active !== false
        ]
      );
      return await dbService.getProductById(p.id);
    }
    const [res] = await pool.query(
      `INSERT INTO products (name, farm, price, unit, category, icon, tag, lot, discount, description, images, active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        p.name || 'Organic Product',
        p.farm || '',
        Number(p.price || 0),
        p.unit || 'kg',
        p.cat || p.category || 'General',
        p.icon || 'leaf',
        p.tag || '',
        p.lot || '',
        Number(p.discount || 0),
        p.description || '',
        JSON.stringify(p.images || []),
        p.active !== false
      ]
    );
    return await dbService.getProductById(res.insertId);
  },

  async updateProduct(id, p) {
    const allowed = ['name', 'farm', 'price', 'unit', 'category', 'icon', 'tag', 'lot', 'discount', 'description', 'active'];
    const updates = [];
    const values = [];

    for (const key of allowed) {
      if (p[key] !== undefined) {
        updates.push(`\`${key}\` = ?`);
        values.push(p[key]);
      }
    }
    if (p.cat !== undefined && p.category === undefined) {
      updates.push('`category` = ?');
      values.push(p.cat);
    }
    if (p.images !== undefined) {
      updates.push('`images` = ?');
      values.push(JSON.stringify(p.images || []));
    }

    if (updates.length > 0) {
      values.push(Number(id));
      await pool.query(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`, values);
    }
    return await dbService.getProductById(id);
  },

  async deleteProduct(id) {
    await pool.query('DELETE FROM products WHERE id = ?', [Number(id)]);
    return true;
  },

  // ─── 4. CATEGORIES ───
  async getCategories() {
    const [rows] = await pool.query('SELECT * FROM categories ORDER BY id ASC');
    return rows.map(r => ({
      id: Number(r.id),
      name: r.name,
      icon: r.icon || 'leaf',
      image: r.image || ''
    }));
  },

  async createCategory(c) {
    const name = typeof c === 'string' ? c : c.name;
    const icon = typeof c === 'object' && c.icon ? c.icon : 'leaf';
    const image = typeof c === 'object' && c.image ? c.image : '';
    const [res] = await pool.query(
      `INSERT INTO categories (name, icon, image)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE icon = VALUES(icon), image = VALUES(image)`,
      [name, icon, image]
    );
    return { id: res.insertId, name, icon, image };
  },

  async deleteCategory(id) {
    await pool.query('DELETE FROM categories WHERE id = ?', [Number(id)]);
    return true;
  },

  // ─── 5. ORDERS & ORDER ITEMS ───
  async createOrder(orderData) {
    const del = orderData.delivery || {};
    const orderNumber = orderData.number || orderData.orderNumber || `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const [res] = await pool.query(
      `INSERT INTO orders (order_number, user_id, customer_name, customer_phone, delivery_address, delivery_city, delivery_zip, delivery_notes, payment_method, subtotal, shipping, total, status, estimated_delivery, order_message, conversation, customer_hidden, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW())`,
      [
        orderNumber,
        orderData.userId || null,
        del.name || orderData.customerName || 'Customer',
        del.phone || orderData.customerPhone || '',
        del.address || orderData.deliveryAddress || '',
        del.city || orderData.deliveryCity || '',
        del.zip || orderData.deliveryZip || '',
        del.notes || orderData.deliveryNotes || '',
        orderData.paymentMethod || 'Cash on Delivery',
        Number(orderData.subtotal || 0),
        Number(orderData.deliveryFee || orderData.shipping || 0),
        Number(orderData.total || 0),
        orderData.status || 'Pending',
        orderData.estimatedDelivery || '24–48 hours',
        orderData.orderMessage || '',
        JSON.stringify(orderData.conversation || [])
      ]
    );

    const orderId = res.insertId;

    if (Array.isArray(orderData.items)) {
      for (const it of orderData.items) {
        await pool.query(
          `INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, unit, total_price)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            orderId,
            it.id || null,
            it.name || 'Product',
            Number(it.price || 0),
            Number(it.qty || 1),
            it.unit || 'kg',
            Number(it.price || 0) * Number(it.qty || 1)
          ]
        );
      }
    }

    return this.getOrderById(orderId);
  },

  async getOrderById(id) {
    const [orderRows] = await pool.query('SELECT * FROM orders WHERE id = ? LIMIT 1', [Number(id)]);
    if (orderRows.length === 0) return null;
    const [itemRows] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [Number(id)]);
    return formatOrder(orderRows[0], itemRows);
  },

  async getOrderByNumber(orderNumber) {
    const [orderRows] = await pool.query('SELECT * FROM orders WHERE order_number = ? LIMIT 1', [orderNumber]);
    if (orderRows.length === 0) return null;
    const [itemRows] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [orderRows[0].id]);
    return formatOrder(orderRows[0], itemRows);
  },

  async getUserOrders(userId) {
    const [orderRows] = await pool.query(
      'SELECT * FROM orders WHERE user_id = ? AND customer_hidden = 0 ORDER BY id DESC',
      [Number(userId)]
    );
    if (orderRows.length === 0) return [];
    const orderIds = orderRows.map(o => o.id);
    const [itemRows] = await pool.query('SELECT * FROM order_items WHERE order_id IN (?)', [orderIds]);

    const itemMap = new Map();
    for (const it of itemRows) {
      if (!itemMap.has(it.order_id)) itemMap.set(it.order_id, []);
      itemMap.get(it.order_id).push(it);
    }

    return orderRows.map(o => formatOrder(o, itemMap.get(o.id) || []));
  },

  async getAllOrdersAdmin() {
    const [orderRows] = await pool.query('SELECT * FROM orders ORDER BY id DESC');
    if (orderRows.length === 0) return [];
    const orderIds = orderRows.map(o => o.id);
    const [itemRows] = await pool.query('SELECT * FROM order_items WHERE order_id IN (?)', [orderIds]);

    const itemMap = new Map();
    for (const it of itemRows) {
      if (!itemMap.has(it.order_id)) itemMap.set(it.order_id, []);
      itemMap.get(it.order_id).push(it);
    }

    return orderRows.map(o => formatOrder(o, itemMap.get(o.id) || []));
  },

  async updateOrderStatus(id, status) {
    await pool.query('UPDATE orders SET status = ? WHERE id = ?', [status, Number(id)]);
    return await this.getOrderById(id);
  },

  async updateOrderConversation(id, conversation) {
    await pool.query('UPDATE orders SET conversation = ? WHERE id = ?', [JSON.stringify(conversation), Number(id)]);
    return await this.getOrderById(id);
  },

  async updateOrder(id, orderData) {
    const del = orderData.delivery || {};
    const convObj = {
      conversation: orderData.conversation || [],
      history: orderData.history || [],
      messages: orderData.messages || [],
      cancelledBy: orderData.cancelledBy || null,
      cancelledAt: orderData.cancelledAt || null,
      cancelReason: orderData.cancelReason || '',
      confirmedAt: orderData.confirmedAt || null,
      confirmedBy: orderData.confirmedBy || null
    };
    await pool.query(
      `UPDATE orders SET
        customer_name = ?,
        customer_phone = ?,
        delivery_address = ?,
        delivery_city = ?,
        status = ?,
        estimated_delivery = ?,
        customer_hidden = ?,
        conversation = ?
       WHERE id = ?`,
      [
        del.name || orderData.customerName || (orderData.customer && orderData.customer.name) || 'Customer',
        del.phone || orderData.customerPhone || (orderData.customer && orderData.customer.phone) || '',
        del.address || orderData.deliveryAddress || (orderData.customer && orderData.customer.address) || '',
        del.city || orderData.deliveryCity || (orderData.customer && orderData.customer.city) || '',
        orderData.status || 'Pending',
        orderData.estimatedDelivery || '24–48 hours',
        orderData.customerHidden ? 1 : 0,
        JSON.stringify(convObj),
        Number(id)
      ]
    );
    return this.getOrderById(id);
  },

  async hideCustomerOrder(id) {
    await pool.query('UPDATE orders SET customer_hidden = 1 WHERE id = ?', [Number(id)]);
    return true;
  },

  async deleteOrder(id) {
    await pool.query('DELETE FROM orders WHERE id = ?', [Number(id)]);
    return true;
  },

  // ─── 6. REVIEWS ───
  async getProductReviews(productId) {
    const [rows] = await pool.query(
      'SELECT * FROM reviews WHERE product_id = ? AND hidden = 0 ORDER BY id DESC',
      [Number(productId)]
    );
    return rows.map(r => ({
      id: Number(r.id),
      productId: Number(r.product_id),
      userId: r.user_id ? Number(r.user_id) : null,
      authorName: r.author_name,
      authorEmail: r.author_email || '',
      rating: Number(r.rating),
      comment: r.comment,
      images: safeJsonParse(r.images, []),
      hidden: Boolean(r.hidden),
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
    }));
  },

  async getAllReviewsAdmin() {
    const [rows] = await pool.query(
      `SELECT r.*, p.name as product_name FROM reviews r
       LEFT JOIN products p ON r.product_id = p.id
       ORDER BY r.id DESC`
    );
    return rows.map(r => ({
      id: Number(r.id),
      productId: Number(r.product_id),
      productName: r.product_name || 'Product',
      userId: r.user_id ? Number(r.user_id) : null,
      authorName: r.author_name,
      authorEmail: r.author_email || '',
      rating: Number(r.rating),
      comment: r.comment,
      images: safeJsonParse(r.images, []),
      hidden: Boolean(r.hidden),
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
    }));
  },

  async createReview(r) {
    const [res] = await pool.query(
      `INSERT INTO reviews (product_id, user_id, author_name, author_email, rating, comment, images, hidden, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, NOW())`,
      [
        Number(r.productId),
        r.userId || null,
        r.authorName || 'Verified Customer',
        r.authorEmail || '',
        Number(r.rating || 5),
        r.comment || '',
        JSON.stringify(r.images || [])
      ]
    );
    return { id: res.insertId, ...r, hidden: false, createdAt: new Date().toISOString() };
  },

  async toggleReviewVisibility(id, hidden) {
    await pool.query('UPDATE reviews SET hidden = ? WHERE id = ?', [hidden ? 1 : 0, Number(id)]);
    return true;
  },

  async getReviewById(id) {
    const [rows] = await pool.query(
      `SELECT r.*, p.name as product_name FROM reviews r
       LEFT JOIN products p ON r.product_id = p.id
       WHERE r.id = ?`,
      [Number(id)]
    );
    if (!rows.length) return null;
    const r = rows[0];
    return {
      id: Number(r.id),
      productId: Number(r.product_id),
      productName: r.product_name || 'Product',
      userId: r.user_id ? Number(r.user_id) : null,
      authorName: r.author_name,
      authorEmail: r.author_email || '',
      rating: Number(r.rating),
      comment: r.comment,
      images: safeJsonParse(r.images, []),
      hidden: Boolean(r.hidden),
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
    };
  },

  async getReviewById(id) {
    const [rows] = await pool.query('SELECT * FROM reviews WHERE id = ?', [Number(id)]);
    if (!rows.length) return null;
    const r = rows[0];
    return {
      id: Number(r.id), productId: Number(r.product_id),
      userId: Number(r.user_id), authorName: r.author_name,
      authorEmail: r.author_email || '', rating: Number(r.rating),
      comment: r.comment, images: safeJsonParse(r.images, []),
      hidden: Boolean(r.hidden),
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
    };
  },

  async deleteReview(id) {
    await pool.query('DELETE FROM reviews WHERE id = ?', [Number(id)]);
    return true;
  },

  async updateReview(id, fields) {
    const sets = [];
    const vals = [];
    if (fields.rating !== undefined) { sets.push('rating = ?'); vals.push(Number(fields.rating)); }
    if (fields.comment !== undefined) { sets.push('comment = ?'); vals.push(String(fields.comment)); }
    if (fields.hidden !== undefined) { sets.push('hidden = ?'); vals.push(fields.hidden ? 1 : 0); }
    if (fields.images !== undefined) { sets.push('images = ?'); vals.push(JSON.stringify(fields.images)); }
    if (!sets.length) return true;
    vals.push(Number(id));
    await pool.query(`UPDATE reviews SET ${sets.join(', ')} WHERE id = ?`, vals);
    return true;
  },

  async getReviewByUserAndProduct(userId, productId) {
    const [rows] = await pool.query(
      'SELECT * FROM reviews WHERE user_id = ? AND product_id = ? LIMIT 1',
      [Number(userId), Number(productId)]
    );
    if (!rows.length) return null;
    const r = rows[0];
    return {
      id: Number(r.id), productId: Number(r.product_id),
      userId: Number(r.user_id), authorName: r.author_name,
      authorEmail: r.author_email || '', rating: Number(r.rating),
      comment: r.comment, images: safeJsonParse(r.images, []),
      hidden: Boolean(r.hidden),
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
    };
  },

  async getUserReviews(userId) {
    const [rows] = await pool.query(
      `SELECT r.*, p.name as product_name FROM reviews r
       LEFT JOIN products p ON r.product_id = p.id
       WHERE r.user_id = ?
       ORDER BY r.id DESC`,
      [Number(userId)]
    );
    return rows.map(r => ({
      id: Number(r.id),
      productId: Number(r.product_id),
      productName: r.product_name || 'Product',
      userId: r.user_id ? Number(r.user_id) : null,
      authorName: r.author_name,
      authorEmail: r.author_email || '',
      rating: Number(r.rating),
      comment: r.comment,
      images: safeJsonParse(r.images, []),
      hidden: Boolean(r.hidden),
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
    }));
  },

  // ─── 7. COMMUNITY COMMENTS ───
  async getPublicComments() {
    const [rows] = await pool.query(
      'SELECT * FROM community_comments WHERE hidden = 0 ORDER BY pinned DESC, id DESC'
    );
    return rows.map(r => ({
      id: Number(r.id),
      userId: r.user_id ? Number(r.user_id) : null,
      authorName: r.author_name,
      authorEmail: r.author_email || '',
      authorRole: r.author_role || 'customer',
      text: r.text,
      reply: safeJsonParse(r.reply, null),
      pinned: Boolean(r.pinned),
      hidden: Boolean(r.hidden),
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
    }));
  },

  async getAllCommentsAdmin() {
    const [rows] = await pool.query(
      'SELECT * FROM community_comments ORDER BY pinned DESC, id DESC'
    );
    return rows.map(r => ({
      id: Number(r.id),
      userId: r.user_id ? Number(r.user_id) : null,
      authorName: r.author_name,
      authorEmail: r.author_email || '',
      authorRole: r.author_role || 'customer',
      text: r.text,
      reply: safeJsonParse(r.reply, null),
      pinned: Boolean(r.pinned),
      hidden: Boolean(r.hidden),
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
    }));
  },

  async createComment(c) {
    const [res] = await pool.query(
      `INSERT INTO community_comments (user_id, author_name, author_email, author_role, text, reply, pinned, hidden, created_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?, 0, NOW())`,
      [
        c.userId || null,
        c.authorName || 'Guest',
        c.authorEmail || '',
        c.authorRole || 'customer',
        c.text || '',
        c.pinned ? 1 : 0
      ]
    );
    return { id: res.insertId, ...c, reply: null, hidden: false, createdAt: new Date().toISOString() };
  },

  async replyComment(id, replyData) {
    await pool.query('UPDATE community_comments SET reply = ? WHERE id = ?', [JSON.stringify(replyData), Number(id)]);
    return true;
  },

  async toggleCommentPin(id, pinned) {
    await pool.query('UPDATE community_comments SET pinned = ? WHERE id = ?', [pinned ? 1 : 0, Number(id)]);
    return true;
  },

  async toggleCommentHide(id, hidden) {
    await pool.query('UPDATE community_comments SET hidden = ? WHERE id = ?', [hidden ? 1 : 0, Number(id)]);
    return true;
  },

  async getCommentById(id) {
    const [rows] = await pool.query('SELECT * FROM community_comments WHERE id = ?', [Number(id)]);
    if (!rows.length) return null;
    const r = rows[0];
    return {
      id: Number(r.id),
      userId: r.user_id ? Number(r.user_id) : null,
      authorName: r.author_name,
      authorEmail: r.author_email || '',
      authorRole: r.author_role || 'customer',
      text: r.text,
      reply: safeJsonParse(r.reply, null),
      pinned: Boolean(r.pinned),
      hidden: Boolean(r.hidden),
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
    };
  },

  async deleteComment(id) {
    await pool.query('DELETE FROM community_comments WHERE id = ?', [Number(id)]);
    return true;
  },

  async updateComment(id, text, userId) {
    const params = [String(text), Number(id)];
    let sql = 'UPDATE community_comments SET text = ? WHERE id = ?';
    if (userId) {
      sql += ' AND user_id = ?';
      params.push(Number(userId));
    }
    await pool.query(sql, params);
    return true;
  },

  // ─── 8. CUSTOM ADS & MEDIA ───
  async getActiveAds() {
    const [rows] = await pool.query('SELECT * FROM ads WHERE active = 1 ORDER BY created_at DESC');
    return rows.map(r => ({
      id: r.id,
      tag: r.tag || '',
      title: r.title || '',
      sub: r.sub || '',
      badge: r.badge || '',
      bg: r.bg || '#135412',
      categoryTarget: r.category_target || '',
      active: Boolean(r.active),
      createdAt: r.created_at
    }));
  },

  async getAllAdsAdmin() {
    const [rows] = await pool.query('SELECT * FROM ads ORDER BY created_at DESC');
    return rows.map(r => ({
      id: r.id,
      name: r.name || r.title || 'Ad',
      tag: r.tag || '',
      headline: r.title || '', // Map title -> headline
      body: r.sub || '', // Map sub -> body
      buttonText: r.badge || 'Shop Now', // Map badge -> buttonText
      buttonCat: r.category_target || '', // Map category_target -> buttonCat
      image: r.image || '',
      imageSize: r.image_size || 130,
      bg: r.bg || 'linear-gradient(135deg,#f5a623,#f76b1c)',
      textColor: r.text_color || '#ffffff',
      active: Boolean(r.active),
      createdAt: r.created_at
    }));
  },

  async createAd(ad) {
    const id = ad.id || `ad_${Date.now()}`;
    await pool.query(
      `INSERT INTO ads (id, name, tag, title, sub, badge, bg, category_target, active, image, image_size, text_color, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        id,
        ad.name || 'Ad',
        ad.tag || '',
        ad.headline || ad.title || '',
        ad.body || ad.sub || '',
        ad.buttonText || ad.badge || 'Shop Now',
        ad.bg || 'linear-gradient(135deg,#f5a623,#f76b1c)',
        ad.buttonCat || ad.categoryTarget || '',
        ad.active !== false,
        ad.image || null,
        ad.imageSize || 130,
        ad.textColor || '#ffffff'
      ]
    );
    return { id, ...ad };
  },

  async updateAd(id, ad) {
    const updates = [];
    const values = [];
    // Map form field names to DB column names
    const map = {
      name: 'name',
      tag: 'tag',
      headline: 'title',
      title: 'title',
      body: 'sub',
      sub: 'sub',
      buttonText: 'badge',
      badge: 'badge',
      bg: 'bg',
      buttonCat: 'category_target',
      categoryTarget: 'category_target',
      active: 'active',
      image: 'image',
      imageSize: 'image_size',
      textColor: 'text_color'
    };

    for (const [prop, col] of Object.entries(map)) {
      if (ad[prop] !== undefined) {
        updates.push(`\`${col}\` = ?`);
        values.push(ad[prop]);
      }
    }

    if (updates.length > 0) {
      values.push(id);
      await pool.query(`UPDATE ads SET ${updates.join(', ')} WHERE id = ?`, values);
    }
    return { id, ...ad };
  },

  async deleteAd(id) {
    await pool.query('DELETE FROM ads WHERE id = ?', [id]);
    return true;
  },

  async getAdMedia() {
    const [rows] = await pool.query('SELECT * FROM ad_media ORDER BY created_at DESC');
    return rows.map(r => ({ id: r.id, url: r.url, type: r.type, createdAt: r.created_at }));
  },

  async createAdMedia(m) {
    await pool.query(
      'INSERT INTO ad_media (id, url, type, created_at) VALUES (?, ?, ?, NOW())',
      [m.id, m.url, m.type || 'image']
    );
    return m;
  },

  async deleteAdMedia(id) {
    await pool.query('DELETE FROM ad_media WHERE id = ?', [id]);
    return true;
  },

  // ─── 9. STORE SETTINGS ───
  getDefaultStoreSettings() {
    return {
      // 1. Identity & Branding
      brandName: 'ENMAR',
      tagline: 'Farm-fresh 100% Organic Grocery & Produce',
      brandLogo: '',
      adminBrandName: 'ENMAR Admin',
      adminLogo: '',
      favicon: '',

      // 2. Theme & Styling
      themeName: 'Default Forest',
      themePrimary: '#14421a',
      themeAccent: '#7e8019',

      // 3. Contact & Communication
      contactPhone: '+880 1614 113082',
      contactWhatsapp: 'https://wa.me/8801614113082',
      contactEmail: 'info@enmar.bd',
      contactFacebook: 'https://facebook.com/enmar.bd',
      messengerUrl: 'https://m.me/enmar.bd',
      contactAddress: 'House 12, Road 4, Dhanmondi, Dhaka - 1205, Bangladesh',
      openHours: '8:00 AM - 10:00 PM',

      // 4. Shipping & Delivery Rules
      shippingFlat: 70,
      defaultShippingFee: 70,
      shippingFreeThreshold: 1500,
      freeDeliveryThreshold: 1500,
      deliveryCountdownHours: 4,
      defaultDeliveryEstimate: '4 hours',
      defaultOrderMessage: 'Thank you for shopping with ENMAR. Fresh organic harvest on the way!',
      orderSuccessHeading: 'Order Placed Successfully!',
      orderSuccessMessage: 'Your order has been received. Our team will verify and deliver fresh organic produce to your doorstep.',

      // 5. Newsletter
      newsletterHeading: 'Stay Updated with Fresh Harvest',
      newsletterBody: 'Subscribe to get weekly seasonal crop updates, exclusive member discounts, and farm stories directly to your inbox.',

      // 6. Footer Info Panels
      footerTagline: 'Pure, organic, farm-fresh harvest delivered directly to your home.',
      footerShippingInfo: 'We deliver within 4 to 24 hours of fresh morning harvest.\nFree shipping on orders over ৳1500.\nDelivery available across all areas of Dhaka and major cities in Bangladesh.',
      footerFarmInfo: 'We partner with over 40+ certified organic farmers across Savar, Gazipur, Rajshahi, and Bogura to deliver pesticide-free, chemically untampered vegetables, fruits, and dairy.',
      footerContactInfo: 'Customer Support: Sat–Thu, 9:00 AM – 10:00 PM\nHelpline: +880 1614 113082\nEmail: hello@enmar.bd',

      // 7. Information Pages
      pageAboutUs: 'Welcome to ENMAR — Bangladesh\'s trusted farm-to-table organic grocery platform. Founded with a vision to connect health-conscious families with ethical organic farmers, we eliminate intermediaries to guarantee maximum freshness, fair farmer compensation, and pure nutritional value.',
      pageContactUs: 'Have questions or need assistance? Contact our team at:\n• Office: House 12, Road 4, Dhanmondi, Dhaka\n• Phone: +880 1614 113082\n• Email: info@enmar.bd\n• Hours: 8:00 AM - 10:00 PM daily',
      pageCompanyInfo: 'ENMAR Agro-Commerce Bangladesh Ltd.\nTrade License: TRAD/DSCC/019283/2024\nBSTI & Organic Certification Partner\nDedicated to ecological agriculture and sustainable food security in Bangladesh.',
      pageTerms: '1. Orders placed on ENMAR are subject to product availability and harvest quality.\n2. Prices are displayed in Bangladeshi Taka (BDT) including applicable taxes.\n3. Cash on Delivery is available for all eligible delivery zones.\n4. Customers can cancel pending orders before warehouse dispatch.',
      pagePrivacyPolicy: 'Your privacy is paramount to us. ENMAR collects customer contact details solely for order fulfillment, delivery logistics, and essential account security notifications. We never sell or share customer data with third parties.',

      // 8. Support & Help Pages
      pageSupportCenter: 'Need help with your account, order tracking, or returns? Our customer support agents are ready to assist you via WhatsApp, live order chat, or phone helpline.',
      pageHowToOrder: '1. Browse fresh categories or search your desired organic items.\n2. Add produce to your harvest basket.\n3. Proceed to checkout and enter your delivery address.\n4. Select Cash on Delivery and confirm your order.\n5. Track live delivery countdown from your order history.',
      pageOrderTracking: 'Track your package in real-time from the "My Orders" dashboard. Once confirmed by our team, a live countdown timer displays the exact remaining delivery time.',
      pagePaymentInfo: 'We currently accept Cash on Delivery (COD) across Dhaka. Digital payment options (bKash & Nagad) are being integrated and will launch soon.',
      pageSupportShipping: 'Express delivery within 4 hours inside Dhaka city. Standard delivery within 24 hours for suburban areas. All items are packed in eco-friendly protective crates.',
      pageFaq: 'Q: How do you ensure products are 100% organic?\nA: We inspect partner farms regularly and test soil/produce for zero synthetic chemicals.\n\nQ: What if an item arrives damaged?\nA: Our Happy Return policy guarantees instant replacement or full credit.',

      // 9. Consumer Policies
      pageHappyReturn: 'If you are unsatisfied with the quality or freshness of any item upon delivery, return it to the delivery agent instantly with zero return fees.',
      pageRefundPolicy: 'Approved refunds are processed within 24–48 hours to the customer\'s preferred payment method or store credit.',
      pageCancellation: 'You can cancel any pending order directly from your "My Orders" dashboard before the order is marked Confirmed or Out for Delivery.',
      pagePreOrder: 'Seasonal items such as Rajshahi Mangoes, Sundarban Raw Honey, and Winter Specialty Vegetables can be pre-ordered ahead of harvest season.',

      // 10. Catalog & Search Headings
      categorySectionTitle: 'Featured Harvest Categories',
      productsSectionTitle: 'Farm Fresh Products',
      searchPlaceholder: 'Search fresh harvest by name, farm variety, category…',
      cartEmptyMessage: 'Your harvest basket is empty. Explore our farm-fresh catalog!',

      // 11. Recently Added Products Section
      recentSectionEnabled: 'true',
      recentSectionBadge: 'Fresh In',
      recentSectionTitle: 'Recently Added Harvest',
      recentSectionSubtitle: 'Direct from this morning\'s harvest from our partner farms',
      recentSectionExploreText: 'View All Harvest',
      recentSectionExploreLink: '#products',
      recentSectionMaxProducts: 8,
      recentSectionScrollSpeed: 3.8,
      recentSectionDaysLimit: 7,
      recentSectionCardBadge: 'New',
      recentSectionRatingText: 'Verified Organic',

      // 12. Community Voices Section
      communitySectionPill: 'Community Voices',
      communitySectionTitle: 'What Our Customers Say',
      communitySectionSubtitle: 'Real feedback from healthy families enjoying ENMAR produce',
      communityPromptGuest: 'Sign in to join the conversation and share your feedback.',
      communityPlaceholder: 'Share your experience with our organic harvest…',
      communityEmptyMessage: 'No community comments yet. Be the first to share your thoughts!',
      defaultCommentReply: 'Thank you for your valuable feedback! We are committed to delivering the best organic harvest.',

      // 13. Customer Portal Texts
      myOrdersPageTitle: 'My Orders & Deliveries',
      myOrdersEmptyMessage: 'You haven\'t placed any orders yet.',
      shopHarvestButtonText: 'Shop This Week\'s Harvest',

      // 14. Registration Guide
      regGuideEnabled: 'true',
      regGuideTitle: 'How to Register / Create Account',
      regGuideSubtitle: 'New to our shop? Follow these simple steps to create your customer account:',
      regGuideSteps: '1. Click "Sign in / Register" in the top bar.\n2. Enter your email and click "Send OTP".\n3. Enter the 6-digit OTP code received in your inbox.\n4. Set your secure password and click "Create Account".'
    };
  },

  async getStoreSettings() {
    const settings = this.getDefaultStoreSettings();
    let apiConfigs = {
      sms: { provider: 'alpha', baseUrl: 'https://api.sms.net.bd/sendsms', apiKey: '', senderId: '', enabled: true },
      email: { provider: 'gmail', host: 'smtp.gmail.com', port: 465, secure: true, user: '', pass: '', fromName: 'ENMAR Official', fromEmail: '' }
    };

    const [rows] = await pool.query('SELECT setting_key, setting_val FROM store_settings');
    for (const r of rows) {
      if (r.setting_key === 'allSettings' || r.setting_key === 'settings') {
        const parsed = safeJsonParse(r.setting_val, {});
        if (parsed && typeof parsed === 'object') {
          const flat = parsed.settings || parsed;
          for (const [k, v] of Object.entries(flat)) {
            if (k !== 'settings' && k !== 'allSettings' && k !== 'apiConfigs') {
              settings[k] = v;
            }
          }
        }
      } else if (r.setting_key === 'apiConfigs') {
        apiConfigs = safeJsonParse(r.setting_val, apiConfigs);
      } else {
        const parsed = safeJsonParse(r.setting_val, r.setting_val);
        settings[r.setting_key] = parsed;
      }
    }

    return { settings, apiConfigs };
  },

  async saveStoreSetting(key, val) {
    if (key === 'settings' || key === 'allSettings') return true;
    const valStr = typeof val === 'object' ? JSON.stringify(val) : String(val);
    await pool.query(
      `INSERT INTO store_settings (setting_key, setting_val)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_val = VALUES(setting_val)`,
      [key, valStr]
    );
    return true;
  },

  async saveAllSettings(settingsObj, apiConfigsObj) {
    if (settingsObj && typeof settingsObj === 'object') {
      const flat = settingsObj.settings || settingsObj;
      for (const [k, v] of Object.entries(flat)) {
        if (k !== 'settings' && k !== 'allSettings' && k !== 'apiConfigs') {
          await this.saveStoreSetting(k, v);
        }
      }
    }
    if (apiConfigsObj) {
      const valStr = typeof apiConfigsObj === 'object' ? JSON.stringify(apiConfigsObj) : String(apiConfigsObj);
      await pool.query(
        `INSERT INTO store_settings (setting_key, setting_val)
         VALUES ('apiConfigs', ?)
         ON DUPLICATE KEY UPDATE setting_val = VALUES(setting_val)`,
        [valStr]
      );
    }
    return true;
  },

  async updateSettings(settingsObj) {
    return await this.saveAllSettings(settingsObj);
  },

  async getSettings() {
    const data = await this.getStoreSettings();
    return data.settings;
  },

  async ensureStoreSettings() {
    const defaults = this.getDefaultStoreSettings();
    const [rows] = await pool.query('SELECT setting_key FROM store_settings');
    const existing = new Set(rows.map(r => r.setting_key));
    for (const [k, v] of Object.entries(defaults)) {
      if (!existing.has(k)) {
        await this.saveStoreSetting(k, v);
      }
    }
    return true;
  },

  // ─── 10. NOTIFICATIONS ───
  async getUserNotifications(opts = {}) {
    const userId = typeof opts === 'object' ? opts.userId : opts;
    const role = typeof opts === 'object' ? opts.role : 'customer';
    const isAdmin = ['superadmin', 'admin', 'manager', 'staff'].includes(role);

    let query, params;
    if (isAdmin) {
      query = `SELECT * FROM customer_notifications 
               WHERE target_role IN ('admin', 'staff', 'all') OR user_id = ? 
               ORDER BY id DESC LIMIT 50`;
      params = [userId ? Number(userId) : null];
    } else {
      query = `SELECT * FROM customer_notifications 
               WHERE (user_id = ? OR (user_id IS NULL AND target_role IN ('customer', 'all'))) 
               ORDER BY id DESC LIMIT 50`;
      params = [userId ? Number(userId) : null];
    }

    const [rows] = await pool.query(query, params).catch(() => [[]]);
    return rows.map(r => ({
      id: Number(r.id),
      userId: r.user_id ? Number(r.user_id) : null,
      targetRole: r.target_role || 'all',
      type: r.type || 'announcement',
      title: r.title,
      message: r.message,
      productId: r.product_id ? Number(r.product_id) : null,
      link: r.link || '',
      image: r.image || '',
      isRead: Boolean(r.read_at),
      readAt: r.read_at ? new Date(r.read_at).toISOString() : null,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
    }));
  },

  async createNotification(n) {
    const [res] = await pool.query(
      `INSERT INTO customer_notifications (user_id, target_role, type, title, message, product_id, link, image, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        n.userId || null,
        n.targetRole || 'all',
        n.type || 'announcement',
        n.title || '',
        n.message || '',
        n.productId || null,
        n.link || '',
        n.image || ''
      ]
    ).catch(() => [{ insertId: Date.now() }]);
    return {
      id: res.insertId,
      ...n,
      isRead: false,
      readAt: null,
      createdAt: new Date().toISOString()
    };
  },

  async markNotificationRead(id, userId) {
    await pool.query(
      'UPDATE customer_notifications SET read_at = NOW() WHERE id = ?',
      [Number(id)]
    ).catch(() => {});
    return true;
  },

  async markAllNotificationsRead(opts = {}) {
    const userId = typeof opts === 'object' ? opts.userId : opts;
    const role = typeof opts === 'object' ? opts.role : 'customer';
    const isAdmin = ['superadmin', 'admin', 'manager', 'staff'].includes(role);

    if (isAdmin) {
      await pool.query(
        "UPDATE customer_notifications SET read_at = NOW() WHERE target_role IN ('admin', 'staff', 'all') AND read_at IS NULL"
      ).catch(() => {});
    } else {
      await pool.query(
        "UPDATE customer_notifications SET read_at = NOW() WHERE (user_id = ? OR (user_id IS NULL AND target_role IN ('customer', 'all'))) AND read_at IS NULL",
        [userId ? Number(userId) : null]
      ).catch(() => {});
    }
    return true;
  },

  // ─── 11. SUBSCRIBERS ───
  async addSubscriber(email) {
    const norm = String(email).trim().toLowerCase();
    await pool.query('INSERT IGNORE INTO subscribers (email, subscribed_at) VALUES (?, NOW())', [norm]);
    return true;
  },

  async getSubscribers() {
    const [rows] = await pool.query('SELECT * FROM subscribers ORDER BY id DESC');
    return rows.map(r => ({ id: Number(r.id), email: r.email, subscribedAt: r.subscribed_at }));
  },

  async deleteSubscriber(id) {
    await pool.query('DELETE FROM subscribers WHERE id = ?', [id]);
    return true;
  },

  // ── EMAIL GATEWAY CONFIGURATION (Encrypted) ──
  async saveEmailConfig(configObj) {
    if (!configObj) return null;
    const config = {
      provider: String(configObj.provider || 'smtp').slice(0, 60),
      host: String(configObj.host || '').slice(0, 200),
      port: Number(configObj.port) || 587,
      username: String(configObj.username || configObj.user || '').slice(0, 300),
      password_encrypted: configObj.password_encrypted || '',
      from_email: String(configObj.fromEmail || configObj.from_email || '').slice(0, 255),
      from_name: String(configObj.fromName || configObj.from_name || 'ENMAR').slice(0, 120),
      use_tls: !!configObj.useTls !== false,
      created_by_admin_id: configObj.createdByAdminId || null
    };
    
    await pool.query(
      `INSERT INTO email_gateway_config 
       (provider, host, port, username, password_encrypted, from_email, from_name, use_tls, created_by_admin_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         provider=VALUES(provider),
         host=VALUES(host),
         port=VALUES(port),
         username=VALUES(username),
         password_encrypted=VALUES(password_encrypted),
         from_email=VALUES(from_email),
         from_name=VALUES(from_name),
         use_tls=VALUES(use_tls),
         updated_at=NOW()`,
      [
        config.provider,
        config.host,
        config.port,
        config.username,
        config.password_encrypted,
        config.from_email,
        config.from_name,
        config.use_tls,
        config.created_by_admin_id
      ]
    );
    return config;
  },

  async getEmailConfig() {
    try {
      const [rows] = await pool.query('SELECT * FROM email_gateway_config WHERE id = 1');
      if (!rows || rows.length === 0) return null;
      const r = rows[0];
      let pass = r.password_encrypted || r.password || '';
      return {
        id: 1,
        provider: r.provider || 'smtp',
        host: r.host || 'smtp.gmail.com',
        port: Number(r.port) || 465,
        username: r.username || '',
        password: pass,
        pass: pass,
        fromEmail: r.from_email || r.username || '',
        fromName: r.from_name || 'ENMAR Official',
        useTls: !!r.use_tls,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      };
    } catch {
      return null;
    }
  },

  async getEmailConfigMasked() {
    const config = await this.getEmailConfig();
    if (!config) return null;
    return {
      ...config,
      password_encrypted: undefined,
      passwordSet: !!config.password_encrypted,
      username: config.username ? config.username.replace(/(.{2})(.*)(.{2})/, '$1***$3') : ''
    };
  },

  // ─── 12. RECYCLE BIN (Safety Store) ───
  async ensureBinTable() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS recycle_bin (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        type VARCHAR(40) NOT NULL,
        original_id BIGINT UNSIGNED NOT NULL,
        title VARCHAR(300) NOT NULL DEFAULT '',
        subtitle VARCHAR(500) NOT NULL DEFAULT '',
        data LONGTEXT NULL,
        deleted_by VARCHAR(120) NOT NULL DEFAULT 'System',
        deleted_by_email VARCHAR(255) NOT NULL DEFAULT '',
        deleted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NULL DEFAULT NULL,
        PRIMARY KEY (id),
        KEY recycle_bin_type_index (type),
        KEY recycle_bin_deleted_at_index (deleted_at)
      ) ENGINE=InnoDB
    `);
  },

  async getBinItems() {
    await this.ensureBinTable();
    const [rows] = await pool.query('SELECT * FROM recycle_bin ORDER BY deleted_at DESC');
    return rows.map(r => ({
      id: Number(r.id),
      type: r.type,
      originalId: Number(r.original_id),
      title: r.title || '',
      subtitle: r.subtitle || '',
      details: r.subtitle || '',
      data: safeJsonParse(r.data, null),
      deletedBy: r.deleted_by || 'System',
      deletedByEmail: r.deleted_by_email || '',
      deletedAt: r.deleted_at ? new Date(r.deleted_at).toISOString() : new Date().toISOString(),
      expiresAt: r.expires_at ? new Date(r.expires_at).toISOString() : null
    }));
  },

  async addBinItem(item) {
    await this.ensureBinTable();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    const [res] = await pool.query(
      `INSERT INTO recycle_bin (type, original_id, title, subtitle, data, deleted_by, deleted_by_email, deleted_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
      [
        item.type || 'unknown',
        Number(item.originalId) || 0,
        item.title || '',
        item.subtitle || item.details || '',
        item.data ? JSON.stringify(item.data) : null,
        item.deletedBy || 'System',
        item.deletedByEmail || '',
        expiresAt
      ]
    );
    return {
      id: Number(res.insertId),
      type: item.type,
      originalId: Number(item.originalId),
      title: item.title || '',
      subtitle: item.subtitle || item.details || '',
      details: item.subtitle || item.details || '',
      data: item.data || null,
      deletedBy: item.deletedBy || 'System',
      deletedByEmail: item.deletedByEmail || '',
      deletedAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString()
    };
  },

  async removeBinItem(binId) {
    await this.ensureBinTable();
    await pool.query('DELETE FROM recycle_bin WHERE id = ?', [Number(binId)]);
    return true;
  },

  async getBinItemById(binId) {
    await this.ensureBinTable();
    const [rows] = await pool.query('SELECT * FROM recycle_bin WHERE id = ?', [Number(binId)]);
    if (!rows.length) return null;
    const r = rows[0];
    return {
      id: Number(r.id),
      type: r.type,
      originalId: Number(r.original_id),
      title: r.title || '',
      subtitle: r.subtitle || '',
      details: r.subtitle || '',
      data: safeJsonParse(r.data, null),
      deletedBy: r.deleted_by || 'System',
      deletedByEmail: r.deleted_by_email || '',
      deletedAt: r.deleted_at ? new Date(r.deleted_at).toISOString() : new Date().toISOString(),
      expiresAt: r.expires_at ? new Date(r.expires_at).toISOString() : null
    };
  },

  async emptyBin(type) {
    await this.ensureBinTable();
    if (type && type !== 'all') {
      await pool.query('DELETE FROM recycle_bin WHERE type = ?', [type]);
    } else {
      await pool.query('DELETE FROM recycle_bin');
    }
    return true;
  },

  async getBinCounts() {
    await this.ensureBinTable();
    const [rows] = await pool.query(
      `SELECT type, COUNT(*) as cnt FROM recycle_bin GROUP BY type`
    );
    const counts = { all: 0, product: 0, order: 0, user: 0, comment: 0, review: 0, subscriber: 0, ad: 0 };
    for (const r of rows) {
      counts[r.type] = Number(r.cnt);
      counts.all += Number(r.cnt);
    }
    return counts;
  },

  // ─── 13. CATEGORIES ───
  async ensureCategoriesTable() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        name VARCHAR(120) NOT NULL,
        icon VARCHAR(80) NOT NULL DEFAULT 'leaf',
        image LONGTEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY categories_name_unique (name)
      ) ENGINE=InnoDB
    `);
  },

  async getCategories() {
    await this.ensureCategoriesTable();
    const [rows] = await pool.query('SELECT * FROM categories ORDER BY name ASC');
    return rows.map(r => ({
      id: Number(r.id),
      name: r.name,
      icon: r.icon || 'leaf',
      image: r.image || '',
      createdAt: r.created_at
    }));
  },

  async createCategory({ name, icon = 'leaf', image = '' }) {
    await this.ensureCategoriesTable();
    const cleanName = String(name || '').trim();
    if (!cleanName) return null;
    await pool.query(
      `INSERT INTO categories (name, icon, image) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE icon = VALUES(icon), image = VALUES(image)`,
      [cleanName, String(icon || 'leaf'), String(image || '')]
    );
    const [rows] = await pool.query('SELECT * FROM categories WHERE name = ?', [cleanName]);
    if (!rows.length) return null;
    return {
      id: Number(rows[0].id),
      name: rows[0].name,
      icon: rows[0].icon || 'leaf',
      image: rows[0].image || ''
    };
  },

  async updateCategoryIcon(name, { icon, image }) {
    await this.ensureCategoriesTable();
    const cleanName = String(name || '').trim();
    const updates = [];
    const params = [];
    if (icon !== undefined) {
      updates.push('icon = ?');
      params.push(String(icon || 'leaf'));
    }
    if (image !== undefined) {
      updates.push('image = ?');
      params.push(String(image || ''));
    }
    if (!updates.length) return null;
    params.push(cleanName);
    await pool.query(`UPDATE categories SET ${updates.join(', ')} WHERE name = ?`, params);
    const [rows] = await pool.query('SELECT * FROM categories WHERE name = ?', [cleanName]);
    return rows.length ? { id: Number(rows[0].id), name: rows[0].name, icon: rows[0].icon, image: rows[0].image } : null;
  },

  async deleteCategory(name) {
    await this.ensureCategoriesTable();
    const cleanName = String(name || '').trim();
    await pool.query('DELETE FROM categories WHERE name = ?', [cleanName]);
    return true;
  },

  // ─── 14. ADS & BANNER CAMPAIGNS ───
  async ensureAdsTable() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ads (
        id VARCHAR(80) NOT NULL,
        name VARCHAR(200) NOT NULL DEFAULT '',
        tag VARCHAR(100) NOT NULL DEFAULT '',
        headline TEXT NULL,
        body TEXT NULL,
        button_text VARCHAR(100) NOT NULL DEFAULT 'Shop Now →',
        button_cat VARCHAR(120) NOT NULL DEFAULT 'None',
        bg LONGTEXT NOT NULL,
        text_color VARCHAR(30) NOT NULL DEFAULT '#ffffff',
        image LONGTEXT NOT NULL,
        image_size INT NOT NULL DEFAULT 130,
        active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB
    `);
  },

  async getAllAdsAdmin() {
    await this.ensureAdsTable();
    const [rows] = await pool.query('SELECT * FROM ads ORDER BY created_at DESC');
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      tag: r.tag || '',
      headline: r.headline || '',
      body: r.body || '',
      buttonText: r.button_text || 'Shop Now →',
      buttonCat: r.button_cat || 'None',
      bg: r.bg || 'linear-gradient(135deg,#f5a623 0%,#f76b1c 100%)',
      textColor: r.text_color || '#ffffff',
      image: r.image || '',
      imageSize: Number(r.image_size) || 130,
      active: !!r.active,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  },

  async createAd(data) {
    await this.ensureAdsTable();
    const id = data.id || `ad_${Date.now()}`;
    await pool.query(
      `INSERT INTO ads (id, name, tag, headline, body, button_text, button_cat, bg, text_color, image, image_size, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.name || 'Untitled Ad',
        data.tag || '',
        data.headline || '',
        data.body || '',
        data.buttonText || data.button_text || 'Shop Now →',
        data.buttonCat || data.button_cat || 'None',
        data.bg || 'linear-gradient(135deg,#f5a623 0%,#f76b1c 100%)',
        data.textColor || data.text_color || '#ffffff',
        data.image || '',
        Number(data.imageSize || data.image_size) || 130,
        data.active !== false ? 1 : 0
      ]
    );
    const [rows] = await pool.query('SELECT * FROM ads WHERE id = ?', [id]);
    if (!rows.length) return null;
    const r = rows[0];
    return {
      id: r.id,
      name: r.name,
      tag: r.tag,
      headline: r.headline,
      body: r.body,
      buttonText: r.button_text,
      buttonCat: r.button_cat,
      bg: r.bg,
      textColor: r.text_color,
      image: r.image,
      imageSize: Number(r.image_size),
      active: !!r.active
    };
  },

  async updateAd(id, data) {
    await this.ensureAdsTable();
    const updates = [];
    const params = [];
    if (data.name !== undefined) { updates.push('name = ?'); params.push(data.name); }
    if (data.tag !== undefined) { updates.push('tag = ?'); params.push(data.tag); }
    if (data.headline !== undefined) { updates.push('headline = ?'); params.push(data.headline); }
    if (data.body !== undefined) { updates.push('body = ?'); params.push(data.body); }
    if (data.buttonText !== undefined || data.button_text !== undefined) {
      updates.push('button_text = ?'); params.push(data.buttonText || data.button_text);
    }
    if (data.buttonCat !== undefined || data.button_cat !== undefined) {
      updates.push('button_cat = ?'); params.push(data.buttonCat || data.button_cat);
    }
    if (data.bg !== undefined) { updates.push('bg = ?'); params.push(data.bg); }
    if (data.textColor !== undefined || data.text_color !== undefined) {
      updates.push('text_color = ?'); params.push(data.textColor || data.text_color);
    }
    if (data.image !== undefined) { updates.push('image = ?'); params.push(data.image); }
    if (data.imageSize !== undefined || data.image_size !== undefined) {
      updates.push('image_size = ?'); params.push(Number(data.imageSize || data.image_size));
    }
    if (data.active !== undefined) { updates.push('active = ?'); params.push(data.active ? 1 : 0); }

    if (updates.length) {
      params.push(String(id));
      await pool.query(`UPDATE ads SET ${updates.join(', ')} WHERE id = ?`, params);
    }
    const [rows] = await pool.query('SELECT * FROM ads WHERE id = ?', [String(id)]);
    if (!rows.length) return null;
    const r = rows[0];
    return {
      id: r.id,
      name: r.name,
      tag: r.tag,
      headline: r.headline,
      body: r.body,
      buttonText: r.button_text,
      buttonCat: r.button_cat,
      bg: r.bg,
      textColor: r.text_color,
      image: r.image,
      imageSize: Number(r.image_size),
      active: !!r.active
    };
  },

  async deleteAd(id) {
    await this.ensureAdsTable();
    await pool.query('DELETE FROM ads WHERE id = ?', [String(id)]);
    return true;
  },

  async getAdMedia() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ad_media (
        id VARCHAR(80) NOT NULL,
        url LONGTEXT NOT NULL,
        type VARCHAR(40) NOT NULL DEFAULT 'image',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB
    `);
    const [rows] = await pool.query('SELECT * FROM ad_media ORDER BY created_at DESC');
    return rows.map(r => ({ id: r.id, url: r.url, type: r.type, createdAt: r.created_at }));
  },

  async getEmailConfig() {
    try {
      const [rows] = await pool.query("SELECT * FROM email_gateway_config WHERE id = 1 LIMIT 1");
      if (rows.length && rows[0].username) {
        const r = rows[0];
        return {
          provider: r.provider || 'gmail',
          host: r.host || 'smtp.gmail.com',
          port: Number(r.port) || 465,
          user: r.username,
          username: r.username,
          pass: r.password_encrypted,
          password: r.password_encrypted,
          fromEmail: r.from_email || r.username,
          fromName: r.from_name || 'ENMAR Official',
          secure: Boolean(r.use_tls)
        };
      }
    } catch {}

    try {
      const [rows] = await pool.query("SELECT setting_val FROM store_settings WHERE setting_key = 'apiConfigs'");
      if (rows.length && rows[0].setting_val) {
        const parsed = safeJsonParse(rows[0].setting_val, {});
        if (parsed.email && parsed.email.user) {
          return {
            provider: parsed.email.provider || 'gmail',
            host: parsed.email.host || 'smtp.gmail.com',
            port: Number(parsed.email.port) || 465,
            user: parsed.email.user,
            username: parsed.email.user,
            pass: parsed.email.pass,
            password: parsed.email.pass,
            fromEmail: parsed.email.fromEmail || parsed.email.user,
            fromName: parsed.email.fromName || 'ENMAR Official',
            secure: parsed.email.secure !== false
          };
        }
      }
    } catch {}

    return null;
  },

  async saveEmailGatewayConfig(cfg, adminId = null) {
    try {
      await pool.query(
        `INSERT INTO email_gateway_config (id, provider, host, port, username, password_encrypted, from_email, from_name, use_tls, created_by_admin_id, updated_at)
         VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
           provider = VALUES(provider),
           host = VALUES(host),
           port = VALUES(port),
           username = VALUES(username),
           password_encrypted = IF(VALUES(password_encrypted) != '', VALUES(password_encrypted), password_encrypted),
           from_email = VALUES(from_email),
           from_name = VALUES(from_name),
           use_tls = VALUES(use_tls),
           updated_at = NOW()`,
        [
          cfg.provider || 'gmail',
          cfg.host || 'smtp.gmail.com',
          Number(cfg.port) || 465,
          String(cfg.user || cfg.username || '').trim(),
          String(cfg.pass || cfg.password || '').trim(),
          String(cfg.fromEmail || cfg.from_email || cfg.user || '').trim(),
          String(cfg.fromName || cfg.from_name || 'ENMAR Official').trim(),
          cfg.secure !== false ? 1 : 0,
          adminId ? Number(adminId) : null
        ]
      );
      return true;
    } catch (err) {
      console.error('[DB] Failed to save email_gateway_config:', err.message);
      return false;
    }
  },

  // ─── 16. PERSISTENT SESSIONS ───
  async ensureSessionsTable() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        token VARCHAR(128) NOT NULL,
        user_id BIGINT UNSIGNED NOT NULL,
        expires BIGINT UNSIGNED NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (token),
        KEY idx_user_id (user_id)
      ) ENGINE=InnoDB
    `);
  },

  async createSession(userId, token, expires) {
    try {
      await this.ensureSessionsTable();
      await pool.query(
        `INSERT INTO user_sessions (token, user_id, expires) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE expires = VALUES(expires)`,
        [token, Number(userId), Number(expires) || (Date.now() + 7 * 86400000)]
      );
    } catch {}
  },

  async getSession(token) {
    if (!token) return null;
    try {
      await this.ensureSessionsTable();
      const [rows] = await pool.query('SELECT * FROM user_sessions WHERE token = ? AND expires > ?', [token, Date.now()]);
      if (!rows.length) return null;
      return { token: rows[0].token, userId: Number(rows[0].user_id), expires: Number(rows[0].expires) };
    } catch {
      return null;
    }
  },

  async deleteSession(token) {
    if (!token) return;
    try {
      await this.ensureSessionsTable();
      await pool.query('DELETE FROM user_sessions WHERE token = ?', [token]);
    } catch {}
  },

  // ─── 15. NOTIFICATIONS ───
  async createNotification({ userId = null, targetRole = 'all', type = 'announcement', title, message, link = '', image = '', productId = null }) {
    try {
      const [res] = await pool.query(
        `INSERT INTO customer_notifications (user_id, target_role, type, title, message, product_id, link, image, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          userId ? Number(userId) : null,
          targetRole || 'all',
          type || 'announcement',
          String(title || 'Notification').slice(0, 200),
          String(message || ''),
          productId ? Number(productId) : null,
          String(link || '').slice(0, 500),
          String(image || '').slice(0, 500)
        ]
      );
      return {
        id: res.insertId,
        userId,
        targetRole,
        type,
        title,
        message,
        link,
        image,
        productId,
        createdAt: new Date().toISOString()
      };
    } catch {
      return {
        id: Date.now(),
        userId,
        targetRole,
        type,
        title,
        message,
        link,
        image,
        productId,
        createdAt: new Date().toISOString()
      };
    }
  },

  async getCustomerNotifications(userId) {
    try {
      const [rows] = await pool.query(
        `SELECT * FROM customer_notifications
         WHERE target_role = 'all' OR user_id = ?
         ORDER BY id DESC LIMIT 50`,
        [Number(userId) || 0]
      );
      return rows.map(r => ({
        id: Number(r.id),
        userId: r.user_id ? Number(r.user_id) : null,
        targetRole: r.target_role,
        type: r.type,
        title: r.title,
        message: r.message,
        link: r.link,
        image: r.image,
        readAt: r.read_at,
        createdAt: r.created_at
      }));
    } catch {
      return [];
    }
  }
};

module.exports = dbService;
