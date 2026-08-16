-- ENMAR Organic Market Bangladesh
-- MySQL 8+ Full Production Relational Schema
-- Import with: mysql -u root -p < database.sql

CREATE DATABASE IF NOT EXISTS enmar_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE enmar_db;

-- 1. USERS & STAFF
CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(30) NOT NULL DEFAULT '',
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('customer', 'moderator', 'manager', 'admin', 'superadmin') NOT NULL DEFAULT 'customer',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  avatar VARCHAR(500) NOT NULL DEFAULT '',
  designation VARCHAR(120) NOT NULL DEFAULT '',
  bio TEXT NULL,
  address VARCHAR(500) NOT NULL DEFAULT '',
  city VARCHAR(120) NOT NULL DEFAULT '',
  zip VARCHAR(30) NOT NULL DEFAULT '',
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY users_email_unique (email),
  KEY users_role_active_index (role, active)
) ENGINE=InnoDB;

-- 2. USER SESSIONS
CREATE TABLE IF NOT EXISTS user_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY sessions_token_hash_unique (token_hash),
  KEY sessions_expiry_index (expires_at),
  CONSTRAINT sessions_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 3. CATEGORIES
CREATE TABLE IF NOT EXISTS categories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  icon VARCHAR(80) NOT NULL DEFAULT 'leaf',
  image VARCHAR(500) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY categories_name_unique (name)
) ENGINE=InnoDB;

-- 4. PRODUCTS (Supports unlimited long markdown descriptions & multi-images)
CREATE TABLE IF NOT EXISTS products (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(200) NOT NULL,
  farm VARCHAR(200) NOT NULL,
  price DECIMAL(10,2) UNSIGNED NOT NULL,
  unit VARCHAR(60) NOT NULL,
  category VARCHAR(120) NOT NULL,
  icon VARCHAR(60) NOT NULL DEFAULT 'leaf',
  tag VARCHAR(100) NOT NULL DEFAULT '',
  lot VARCHAR(60) NOT NULL DEFAULT '',
  discount DECIMAL(5,2) UNSIGNED NOT NULL DEFAULT 0.00,
  description LONGTEXT NULL,
  images JSON NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY products_category_active_index (category, active)
) ENGINE=InnoDB;

-- 5. ORDERS
CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_number VARCHAR(40) NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  customer_name VARCHAR(120) NOT NULL,
  customer_phone VARCHAR(30) NOT NULL,
  delivery_address VARCHAR(500) NOT NULL,
  delivery_city VARCHAR(120) NOT NULL,
  delivery_zip VARCHAR(30) NOT NULL DEFAULT '',
  delivery_notes TEXT NULL,
  payment_method ENUM('Cash on Delivery', 'bKash', 'Nagad') NOT NULL DEFAULT 'Cash on Delivery',
  subtotal DECIMAL(10,2) UNSIGNED NOT NULL,
  shipping DECIMAL(10,2) UNSIGNED NOT NULL,
  total DECIMAL(10,2) UNSIGNED NOT NULL,
  status ENUM('Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled') NOT NULL DEFAULT 'Pending',
  estimated_delivery VARCHAR(120) NOT NULL DEFAULT '24–48 hours',
  order_message TEXT NULL,
  conversation JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY orders_number_unique (order_number),
  KEY orders_user_created_index (user_id, created_at),
  KEY orders_status_index (status),
  CONSTRAINT orders_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 6. ORDER ITEMS
CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NULL,
  product_name VARCHAR(200) NOT NULL,
  unit_price DECIMAL(10,2) UNSIGNED NOT NULL,
  quantity SMALLINT UNSIGNED NOT NULL,
  unit VARCHAR(60) NOT NULL DEFAULT 'kg',
  total_price DECIMAL(10,2) UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT order_items_order_fk FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT order_items_product_fk FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 7. PRODUCT REVIEWS
CREATE TABLE IF NOT EXISTS reviews (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  author_name VARCHAR(120) NOT NULL,
  author_email VARCHAR(255) NOT NULL DEFAULT '',
  rating TINYINT UNSIGNED NOT NULL,
  comment TEXT NOT NULL,
  images JSON NULL,
  hidden BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY reviews_product_hidden_index (product_id, hidden),
  CONSTRAINT reviews_product_fk FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT reviews_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 8. COMMUNITY COMMENTS & STAFF REPLIES
CREATE TABLE IF NOT EXISTS community_comments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  author_name VARCHAR(120) NOT NULL,
  author_email VARCHAR(255) NOT NULL DEFAULT '',
  author_role VARCHAR(60) NOT NULL DEFAULT 'customer',
  text TEXT NOT NULL,
  reply JSON NULL,
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  hidden BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY comments_hidden_pinned_index (hidden, pinned),
  CONSTRAINT comments_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 9. CUSTOM PROMOTIONAL ADS
CREATE TABLE IF NOT EXISTS ads (
  id VARCHAR(60) NOT NULL,
  tag VARCHAR(100) NOT NULL DEFAULT '',
  title VARCHAR(200) NOT NULL,
  sub VARCHAR(300) NOT NULL DEFAULT '',
  badge VARCHAR(100) NOT NULL DEFAULT '',
  bg VARCHAR(60) NOT NULL DEFAULT '#135412',
  category_target VARCHAR(120) NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- 10. AD BANNER MEDIA UPLOADS
CREATE TABLE IF NOT EXISTS ad_media (
  id VARCHAR(60) NOT NULL,
  url VARCHAR(500) NOT NULL,
  type ENUM('image', 'video') NOT NULL DEFAULT 'image',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- 11. NEWSLETTER SUBSCRIBERS
CREATE TABLE IF NOT EXISTS subscribers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  subscribed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY subscribers_email_unique (email)
) ENGINE=InnoDB;

-- 12. STORE SETTINGS & BRANDING (Key-Value configuration)
CREATE TABLE IF NOT EXISTS store_settings (
  setting_key VARCHAR(100) NOT NULL,
  setting_val LONGTEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB;

INSERT IGNORE INTO store_settings (setting_key, setting_val) VALUES
  ('brandName', 'ENMAR'),
  ('tagline', 'Farm-fresh 100% Organic Grocery & Produce'),
  ('brandLogo', ''),
  ('adminBrandName', 'ENMAR Admin'),
  ('adminLogo', ''),
  ('favicon', ''),
  ('themeName', 'Default Forest'),
  ('themePrimary', '#14421a'),
  ('themeAccent', '#7e8019'),
  ('contactPhone', '+880 1614 113082'),
  ('contactWhatsapp', 'https://wa.me/8801614113082'),
  ('contactEmail', 'info@enmar.bd'),
  ('contactFacebook', 'https://facebook.com/enmar.bd'),
  ('messengerUrl', 'https://m.me/enmar.bd'),
  ('contactAddress', 'House 12, Road 4, Dhanmondi, Dhaka - 1205, Bangladesh'),
  ('openHours', '8:00 AM - 10:00 PM'),
  ('shippingFlat', '70'),
  ('defaultShippingFee', '70'),
  ('shippingFreeThreshold', '1500'),
  ('freeDeliveryThreshold', '1500'),
  ('deliveryCountdownHours', '4'),
  ('defaultDeliveryEstimate', '4 hours'),
  ('defaultOrderMessage', 'Thank you for shopping with ENMAR. Fresh organic harvest on the way!'),
  ('orderSuccessHeading', 'Order Placed Successfully!'),
  ('orderSuccessMessage', 'Your order has been received. Our team will verify and deliver fresh organic produce to your doorstep.'),
  ('newsletterHeading', 'Stay Updated with Fresh Harvest'),
  ('newsletterBody', 'Subscribe to get weekly seasonal crop updates, exclusive member discounts, and farm stories directly to your inbox.'),
  ('footerTagline', 'Pure, organic, farm-fresh harvest delivered directly to your home.'),
  ('footerShippingInfo', 'We deliver within 4 to 24 hours of fresh morning harvest.\nFree shipping on orders over ৳1500.\nDelivery available across all areas of Dhaka and major cities in Bangladesh.'),
  ('footerFarmInfo', 'We partner with over 40+ certified organic farmers across Savar, Gazipur, Rajshahi, and Bogura to deliver pesticide-free, chemically untampered vegetables, fruits, and dairy.'),
  ('footerContactInfo', 'Customer Support: Sat–Thu, 9:00 AM – 10:00 PM\nHelpline: +880 1614 113082\nEmail: hello@enmar.bd'),
  ('pageAboutUs', 'Welcome to ENMAR — Bangladesh\'s trusted farm-to-table organic grocery platform. Founded with a vision to connect health-conscious families with ethical organic farmers, we eliminate intermediaries to guarantee maximum freshness, fair farmer compensation, and pure nutritional value.'),
  ('pageContactUs', 'Have questions or need assistance? Contact our team at:\n• Office: House 12, Road 4, Dhanmondi, Dhaka\n• Phone: +880 1614 113082\n• Email: info@enmar.bd\n• Hours: 8:00 AM - 10:00 PM daily'),
  ('pageCompanyInfo', 'ENMAR Agro-Commerce Bangladesh Ltd.\nTrade License: TRAD/DSCC/019283/2024\nBSTI & Organic Certification Partner\nDedicated to ecological agriculture and sustainable food security in Bangladesh.'),
  ('pageTerms', '1. Orders placed on ENMAR are subject to product availability and harvest quality.\n2. Prices are displayed in Bangladeshi Taka (BDT) including applicable taxes.\n3. Cash on Delivery is available for all eligible delivery zones.\n4. Customers can cancel pending orders before warehouse dispatch.'),
  ('pagePrivacyPolicy', 'Your privacy is paramount to us. ENMAR collects customer contact details solely for order fulfillment, delivery logistics, and essential account security notifications. We never sell or share customer data with third parties.'),
  ('pageSupportCenter', 'Need help with your account, order tracking, or returns? Our customer support agents are ready to assist you via WhatsApp, live order chat, or phone helpline.'),
  ('pageHowToOrder', '1. Browse fresh categories or search your desired organic items.\n2. Add produce to your harvest basket.\n3. Proceed to checkout and enter your delivery address.\n4. Select Cash on Delivery and confirm your order.\n5. Track live delivery countdown from your order history.'),
  ('pageOrderTracking', 'Track your package in real-time from the "My Orders" dashboard. Once confirmed by our team, a live countdown timer displays the exact remaining delivery time.'),
  ('pagePaymentInfo', 'We currently accept Cash on Delivery (COD) across Dhaka. Digital payment options (bKash & Nagad) are being integrated and will launch soon.'),
  ('pageSupportShipping', 'Express delivery within 4 hours inside Dhaka city. Standard delivery within 24 hours for suburban areas. All items are packed in eco-friendly protective crates.'),
  ('pageFaq', 'Q: How do you ensure products are 100% organic?\nA: We inspect partner farms regularly and test soil/produce for zero synthetic chemicals.\n\nQ: What if an item arrives damaged?\nA: Our Happy Return policy guarantees instant replacement or full credit.'),
  ('pageHappyReturn', 'If you are unsatisfied with the quality or freshness of any item upon delivery, return it to the delivery agent instantly with zero return fees.'),
  ('pageRefundPolicy', 'Approved refunds are processed within 24–48 hours to the customer\'s preferred payment method or store credit.'),
  ('pageCancellation', 'You can cancel any pending order directly from your "My Orders" dashboard before the order is marked Confirmed or Out for Delivery.'),
  ('pagePreOrder', 'Seasonal items such as Rajshahi Mangoes, Sundarban Raw Honey, and Winter Specialty Vegetables can be pre-ordered ahead of harvest season.'),
  ('categorySectionTitle', 'Featured Harvest Categories'),
  ('productsSectionTitle', 'Farm Fresh Products'),
  ('searchPlaceholder', 'Search fresh harvest by name, farm variety, category…'),
  ('cartEmptyMessage', 'Your harvest basket is empty. Explore our farm-fresh catalog!'),
  ('recentSectionEnabled', 'true'),
  ('recentSectionBadge', 'Fresh In'),
  ('recentSectionTitle', 'Recently Added Harvest'),
  ('recentSectionSubtitle', 'Direct from this morning\'s harvest from our partner farms'),
  ('recentSectionExploreText', 'View All Harvest'),
  ('recentSectionExploreLink', '#products'),
  ('recentSectionMaxProducts', '8'),
  ('recentSectionScrollSpeed', '3.8'),
  ('recentSectionDaysLimit', '7'),
  ('recentSectionCardBadge', 'New'),
  ('recentSectionRatingText', 'Verified Organic'),
  ('communitySectionPill', 'Community Voices'),
  ('communitySectionTitle', 'What Our Customers Say'),
  ('communitySectionSubtitle', 'Real feedback from healthy families enjoying ENMAR produce'),
  ('communityPromptGuest', 'Sign in to join the conversation and share your feedback.'),
  ('communityPlaceholder', 'Share your experience with our organic harvest…'),
  ('communityEmptyMessage', 'No community comments yet. Be the first to share your thoughts!'),
  ('defaultCommentReply', 'Thank you for your valuable feedback! We are committed to delivering the best organic harvest.'),
  ('myOrdersPageTitle', 'My Orders & Deliveries'),
  ('myOrdersEmptyMessage', 'You haven\'t placed any orders yet.'),
  ('shopHarvestButtonText', 'Shop This Week\'s Harvest'),
  ('regGuideEnabled', 'true'),
  ('regGuideTitle', 'How to Register / Create Account'),
  ('regGuideSubtitle', 'New to our shop? Follow these simple steps to create your customer account:'),
  ('regGuideSteps', '1. Click "Sign in / Register" in the top bar.\n2. Enter your email and click "Send OTP".\n3. Enter the 6-digit OTP code received in your inbox.\n4. Set your secure password and click "Create Account".');

-- 13. CUSTOMER NOTIFICATIONS (Product arrivals, order status updates, announcements)
-- 14. EMAIL GATEWAY CONFIGURATION (Encrypted Credentials)
CREATE TABLE IF NOT EXISTS email_gateway_config (
  id TINYINT UNSIGNED NOT NULL DEFAULT 1,
  provider VARCHAR(60) NOT NULL DEFAULT 'smtp',
  host VARCHAR(200) NOT NULL,
  port SMALLINT UNSIGNED NOT NULL DEFAULT 587,
  username VARCHAR(300) NOT NULL DEFAULT '',
  password_encrypted LONGTEXT NOT NULL,
  from_email VARCHAR(255) NOT NULL DEFAULT '',
  from_name VARCHAR(120) NOT NULL DEFAULT 'ENMAR',
  use_tls BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by_admin_id BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  KEY email_config_updated_index (updated_at),
  CONSTRAINT email_config_admin_fk FOREIGN KEY (created_by_admin_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 15. CUSTOMER NOTIFICATIONS
CREATE TABLE IF NOT EXISTS customer_notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL, -- NULL means broadcast to all customers
  type VARCHAR(60) NOT NULL DEFAULT 'product_arrival',
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  product_id BIGINT UNSIGNED NULL,
  link VARCHAR(500) NOT NULL DEFAULT '',
  image VARCHAR(500) NOT NULL DEFAULT '',
  read_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY notifications_user_created_index (user_id, created_at),
  CONSTRAINT notifications_product_fk FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 16. RECYCLE BIN (Safety Store for soft-deleted items)
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
) ENGINE=InnoDB;

