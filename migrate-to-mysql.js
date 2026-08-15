// migrate-to-mysql.js - Seamless 1-Click Data Migration into MySQL
const fs = require('fs');
const pool = require('./db.js');

async function migrate() {
  console.log('🚀 Starting Data Migration to MySQL enmar_db...\n');
  const store = JSON.parse(fs.readFileSync('data/store.json', 'utf8'));

  try {
    await pool.query('SET FOREIGN_KEY_CHECKS = 0');

    // 1. Migrate Users
    console.log(`1. Migrating ${store.users.length} users...`);
    for (const u of store.users) {
      await pool.query(
        `INSERT INTO users (id, name, email, phone, password_hash, role, active, avatar, designation, bio, address, city, zip, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name=VALUES(name), phone=VALUES(phone), password_hash=VALUES(password_hash), role=VALUES(role), active=VALUES(active), avatar=VALUES(avatar), address=VALUES(address), city=VALUES(city)`,
        [
          u.id,
          u.name || 'User',
          u.email,
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
          u.notes || '',
          u.createdAt ? new Date(u.createdAt) : new Date()
        ]
      );
    }
    console.log('   ✅ Users migrated.');

    // 2. Migrate Categories
    if (Array.isArray(store.categories)) {
      console.log(`2. Migrating ${store.categories.length} categories...`);
      for (let i = 0; i < store.categories.length; i++) {
        const cat = store.categories[i];
        const catName = typeof cat === 'string' ? cat : cat.name;
        const catIcon = typeof cat === 'object' && cat.icon ? cat.icon : 'leaf';
        const catImage = typeof cat === 'object' && cat.image ? cat.image : '';
        await pool.query(
          `INSERT INTO categories (name, icon, image, created_at)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE icon=VALUES(icon), image=VALUES(image)`,
          [catName, catIcon, catImage, new Date()]
        );
      }
      console.log('   ✅ Categories migrated.');
    }

    // 3. Migrate Products
    if (Array.isArray(store.products)) {
      console.log(`3. Migrating ${store.products.length} products...`);
      for (const p of store.products) {
        await pool.query(
          `INSERT INTO products (id, name, farm, price, unit, category, icon, tag, lot, discount, description, images, active, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE name=VALUES(name), farm=VALUES(farm), price=VALUES(price), unit=VALUES(unit), category=VALUES(category), discount=VALUES(discount), description=VALUES(description), images=VALUES(images), active=VALUES(active)`,
          [
            p.id,
            p.name,
            p.farm || '',
            p.price || 0,
            p.unit || 'kg',
            p.cat || p.category || 'General',
            p.icon || 'leaf',
            p.tag || '',
            p.lot || '',
            p.discount || 0,
            p.description || '',
            JSON.stringify(p.images || []),
            p.active !== false,
            p.createdAt ? new Date(p.createdAt) : new Date()
          ]
        );
      }
      console.log('   ✅ Products migrated.');
    }

    // 4. Migrate Orders
    if (Array.isArray(store.orders)) {
      console.log(`4. Migrating ${store.orders.length} orders...`);
      for (const o of store.orders) {
        const del = o.delivery || {};
        await pool.query(
          `INSERT INTO orders (id, order_number, user_id, customer_name, customer_phone, delivery_address, delivery_city, delivery_zip, delivery_notes, payment_method, subtotal, shipping, total, status, estimated_delivery, order_message, conversation, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE status=VALUES(status), total=VALUES(total)`,
          [
            o.id,
            o.number || `ORD-${o.id}`,
            o.userId || null,
            del.name || o.customerName || 'Customer',
            del.phone || o.customerPhone || '',
            del.address || o.deliveryAddress || '',
            del.city || o.deliveryCity || '',
            del.zip || '',
            del.notes || '',
            o.paymentMethod || 'Cash on Delivery',
            o.subtotal || o.total || 0,
            o.deliveryFee || 0,
            o.total || 0,
            o.status || 'Pending',
            o.estimatedDelivery || '24–48 hours',
            o.orderMessage || '',
            JSON.stringify(o.conversation || []),
            o.createdAt ? new Date(o.createdAt) : new Date()
          ]
        );

        if (Array.isArray(o.items)) {
          for (const it of o.items) {
            await pool.query(
              `INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, unit, total_price)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [o.id, it.id, it.name || 'Product', it.price || 0, it.qty || 1, it.unit || 'kg', (it.price || 0) * (it.qty || 1)]
            );
          }
        }
      }
      console.log('   ✅ Orders migrated.');
    }

    // 5. Migrate Store Settings (Key-Value)
    if (store.settings) {
      console.log('5. Migrating Store Settings...');
      const settingsMap = {
        'brandName': store.settings.brandName || 'ENMAR',
        'contactPhone': store.settings.contactPhone || '',
        'contactEmail': store.settings.contactEmail || '',
        'freeDeliveryThreshold': JSON.stringify(store.settings.freeDeliveryThreshold || 500),
        'defaultShippingFee': JSON.stringify(store.settings.defaultShippingFee || 50),
        'openHours': store.settings.openHours || '8:00 AM - 10:00 PM',
        'address': store.settings.address || 'Dhaka, Bangladesh',
        'apiConfigs': JSON.stringify(store.apiConfigs || {}),
        'allSettings': JSON.stringify(store.settings)
      };

      for (const [k, v] of Object.entries(settingsMap)) {
        await pool.query(
          `INSERT INTO store_settings (setting_key, setting_val)
           VALUES (?, ?)
           ON DUPLICATE KEY UPDATE setting_val=VALUES(setting_val)`,
          [k, v]
        );
      }
      console.log('   ✅ Settings migrated.');
    }

    await pool.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('\n🎉 DATA MIGRATION COMPLETE! All records successfully synced into MySQL (enmar_db).');
  } catch (err) {
    console.error('❌ Migration error:', err);
  } finally {
    await pool.end();
  }
}

migrate();
