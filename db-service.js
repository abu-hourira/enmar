// db-service.js - High-performance MySQL Data Access Layer for ENMAR
const pool = require('./db.js');
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
      cancelReason: orderData.cancelReason || ''
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

  async deleteComment(id) {
    await pool.query('DELETE FROM community_comments WHERE id = ?', [Number(id)]);
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
  async getStoreSettings() {
    const [rows] = await pool.query('SELECT setting_key, setting_val FROM store_settings');
    const settings = {
      brandName: 'ENMAR',
      tagline: 'Farm-fresh 100% Organic Grocery & Produce',
      contactPhone: '01614113082',
      contactEmail: 'info@enmar.bd',
      freeDeliveryThreshold: 500,
      defaultShippingFee: 50,
      openHours: '8:00 AM - 10:00 PM',
      address: 'Dhaka, Bangladesh'
    };
    let apiConfigs = {
      sms: { provider: 'alpha', baseUrl: 'https://api.sms.net.bd/sendsms', apiKey: '', senderId: '', enabled: true },
      email: { provider: 'gmail', host: 'smtp.gmail.com', port: 465, secure: true, user: '', pass: '', fromName: 'ENMAR Official', fromEmail: '' }
    };

    for (const r of rows) {
      if (r.setting_key === 'allSettings') {
        const parsed = safeJsonParse(r.setting_val, {});
        Object.assign(settings, parsed);
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
    if (settingsObj) {
      await dbService.saveStoreSetting('allSettings', settingsObj);
      for (const [k, v] of Object.entries(settingsObj)) {
        await dbService.saveStoreSetting(k, v);
      }
    }
    if (apiConfigsObj) {
      await dbService.saveStoreSetting('apiConfigs', apiConfigsObj);
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

  // ─── 10. NOTIFICATIONS ───
  async getUserNotifications(userId) {
    const [rows] = await pool.query(
      `SELECT * FROM customer_notifications 
       WHERE (user_id = ? OR user_id IS NULL) 
       ORDER BY id DESC LIMIT 50`,
      [userId ? Number(userId) : null]
    );
    return rows.map(r => ({
      id: r.id,
      userId: r.user_id ? Number(r.user_id) : null,
      type: r.type || 'announcement',
      title: r.title,
      message: r.message,
      productId: r.product_id ? Number(r.product_id) : null,
      link: r.link || '',
      image: r.image || '',
      readAt: r.read_at ? new Date(r.read_at).toISOString() : null,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
    }));
  },

  async createNotification(n) {
    const [res] = await pool.query(
      `INSERT INTO customer_notifications (user_id, type, title, message, product_id, link, image, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        n.userId || null,
        n.type || 'account_welcome',
        n.title || '',
        n.message || '',
        n.productId || null,
        n.link || '',
        n.image || ''
      ]
    );
    return { id: res.insertId, ...n, createdAt: new Date().toISOString() };
  },

  async markNotificationRead(id, userId) {
    await pool.query(
      'UPDATE customer_notifications SET read_at = NOW() WHERE id = ? AND (user_id = ? OR user_id IS NULL)',
      [Number(id), userId ? Number(userId) : null]
    );
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
    const [rows] = await pool.query('SELECT * FROM email_gateway_config WHERE id = 1');
    if (!rows || rows.length === 0) return null;
    const r = rows[0];
    return {
      id: 1,
      provider: r.provider || 'smtp',
      host: r.host || '',
      port: Number(r.port) || 587,
      username: r.username || '',
      password_encrypted: r.password_encrypted || '',
      fromEmail: r.from_email || '',
      fromName: r.from_name || 'ENMAR',
      useTls: !!r.use_tls,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
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
  }
};

module.exports = dbService;
