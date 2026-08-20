// scripts/seed-and-flatten-all-store-settings.js
const pool = require('../config/db.js');

const DEFAULT_STOREFRONT_SETTINGS = {
  // ── 1. Storefront & Admin Identity ──
  brandName: 'ENMAR',
  tagline: 'Farm-fresh 100% Organic Grocery & Produce',
  brandLogo: '',
  adminBrandName: 'ENMAR Admin',
  adminLogo: '',
  favicon: '',

  // ── 2. Theme & Colors ──
  themeName: 'Default Forest',
  themePrimary: '#14421a',
  themeAccent: '#7e8019',

  // ── 3. Contact & Location ──
  contactPhone: '+880 1614 113082',
  contactWhatsapp: 'https://wa.me/8801614113082',
  contactEmail: 'info@enmar.bd',
  contactFacebook: 'https://facebook.com/enmar.bd',
  messengerUrl: 'https://m.me/enmar.bd',
  contactAddress: 'House 12, Road 4, Dhanmondi, Dhaka - 1205, Bangladesh',
  openHours: '8:00 AM - 10:00 PM',

  // ── 4. Shipping & Delivery Pricing ──
  shippingFlat: 70,
  defaultShippingFee: 70,
  shippingFreeThreshold: 1500,
  freeDeliveryThreshold: 1500,
  deliveryCountdownHours: 4,
  defaultDeliveryEstimate: '4 hours',
  defaultOrderMessage: 'Thank you for shopping with ENMAR. Fresh organic food on the way!',
  orderSuccessHeading: 'Order Placed Successfully!',
  orderSuccessMessage: 'Your order has been received. Our team will verify and deliver fresh organic produce to your doorstep.',

  // ── 5. Newsletter ──
  newsletterHeading: 'Stay Updated with Fresh Food',
  newsletterBody: 'Subscribe to get weekly seasonal crop updates, exclusive member discounts, and farm stories directly to your inbox.',

  // ── 6. Footer Info Panels ──
  footerTagline: 'Pure, organic, farm-fresh food delivered directly to your home.',
  footerShippingInfo: 'We deliver within 4 to 24 hours of fresh morning food.\nFree shipping on orders over ৳1500.\nDelivery available across all areas of Dhaka and major cities in Bangladesh.',
  footerFarmInfo: 'We partner with over 40+ certified organic farmers across Savar, Gazipur, Rajshahi, and Bogura to deliver pesticide-free, chemically untampered vegetables, fruits, and dairy.',
  footerContactInfo: 'Customer Support: Sat–Thu, 9:00 AM – 10:00 PM\nHelpline: +880 1614 113082\nEmail: hello@enmar.bd',

  // ── 7. Information Pages ──
  pageAboutUs: 'Welcome to ENMAR — Bangladesh\'s trusted farm-to-table organic grocery platform. Founded with a vision to connect health-conscious families with ethical organic farmers, we eliminate intermediaries to guarantee maximum freshness, fair farmer compensation, and pure nutritional value.',
  pageContactUs: 'Have questions or need assistance? Contact our team at:\n• Office: House 12, Road 4, Dhanmondi, Dhaka\n• Phone: +880 1614 113082\n• Email: info@enmar.bd\n• Hours: 8:00 AM - 10:00 PM daily',
  pageCompanyInfo: 'ENMAR Agro-Commerce Bangladesh Ltd.\nTrade License: TRAD/DSCC/019283/2024\nBSTI & Organic Certification Partner\nDedicated to ecological agriculture and sustainable food security in Bangladesh.',
  pageTerms: '1. Orders placed on ENMAR are subject to product availability and food quality.\n2. Prices are displayed in Bangladeshi Taka (BDT) including applicable taxes.\n3. Cash on Delivery is available for all eligible delivery zones.\n4. Customers can cancel pending orders before warehouse dispatch.',
  pagePrivacyPolicy: 'Your privacy is paramount to us. ENMAR collects customer contact details solely for order fulfillment, delivery logistics, and essential account security notifications. We never sell or share customer data with third parties.',

  // ── 8. Support & Help Pages ──
  pageSupportCenter: 'Need help with your account, order tracking, or returns? Our customer support agents are ready to assist you via WhatsApp, live order chat, or phone helpline.',
  pageHowToOrder: '1. Browse fresh categories or search your desired organic items.\n2. Add produce to your food basket.\n3. Proceed to checkout and enter your delivery address.\n4. Select Cash on Delivery and confirm your order.\n5. Track live delivery countdown from your order history.',
  pageOrderTracking: 'Track your package in real-time from the "My Orders" dashboard. Once confirmed by our team, a live countdown timer displays the exact remaining delivery time.',
  pagePaymentInfo: 'We currently accept Cash on Delivery (COD) across Dhaka. Digital payment options (bKash & Nagad) are being integrated and will launch soon.',
  pageSupportShipping: 'Express delivery within 4 hours inside Dhaka city. Standard delivery within 24 hours for suburban areas. All items are packed in eco-friendly protective crates.',
  pageFaq: 'Q: How do you ensure products are 100% organic?\nA: We inspect partner farms regularly and test soil/produce for zero synthetic chemicals.\n\nQ: What if an item arrives damaged?\nA: Our Happy Return policy guarantees instant replacement or full credit.',

  // ── 9. Consumer Policies ──
  pageHappyReturn: 'If you are unsatisfied with the quality or freshness of any item upon delivery, return it to the delivery agent instantly with zero return fees.',
  pageRefundPolicy: 'Approved refunds are processed within 24–48 hours to the customer\'s preferred payment method or store credit.',
  pageCancellation: 'You can cancel any pending order directly from your "My Orders" dashboard before the order is marked Confirmed or Out for Delivery.',
  pagePreOrder: 'Seasonal items such as Rajshahi Mangoes, Sundarban Raw Honey, and Winter Specialty Vegetables can be pre-ordered ahead of food season.',

  // ── 10. Catalog & Search Headings ──
  categorySectionTitle: 'Featured Food Categories',
  productsSectionTitle: 'Farm Fresh Products',
  searchPlaceholder: 'Search fresh food by name, farm variety, category…',
  cartEmptyMessage: 'Your food basket is empty. Explore our farm-fresh catalog!',

  // ── 11. Recently Added Products Section ──
  recentSectionEnabled: 'true',
  recentSectionBadge: 'Fresh In',
  recentSectionTitle: 'Recently Added Food',
  recentSectionSubtitle: 'Direct from this morning\'s food from our partner farms',
  recentSectionExploreText: 'View All Food',
  recentSectionExploreLink: '#products',
  recentSectionMaxProducts: 8,
  recentSectionScrollSpeed: 3.8,
  recentSectionDaysLimit: 7,
  recentSectionCardBadge: 'New',
  recentSectionRatingText: 'Verified Organic',

  // ── 12. Community Voices Section ──
  communitySectionPill: 'Community Voices',
  communitySectionTitle: 'What Our Customers Say',
  communitySectionSubtitle: 'Real feedback from healthy families enjoying ENMAR produce',
  communityPromptGuest: 'Sign in to join the conversation and share your feedback.',
  communityPlaceholder: 'Share your experience with our organic food…',
  communityEmptyMessage: 'No community comments yet. Be the first to share your thoughts!',
  defaultCommentReply: 'Thank you for your valuable feedback! We are committed to delivering the best organic food.',

  // ── 13. Customer Portal Texts ──
  myOrdersPageTitle: 'My Orders & Deliveries',
  myOrdersEmptyMessage: 'You haven\'t placed any orders yet.',
  shopHarvestButtonText: 'Shop This Week\'s Food',

  // ── 14. Registration Guide ──
  regGuideEnabled: 'true',
  regGuideTitle: 'How to Register / Create Account',
  regGuideSubtitle: 'New to our shop? Follow these simple steps to create your customer account:',
  regGuideSteps: '1. Click "Sign in / Register" in the top bar.\n2. Enter your email and click "Send OTP".\n3. Enter the 6-digit OTP code received in your inbox.\n4. Set your secure password and click "Create Account".'
};

async function seedSettings() {
  console.log('Seeding and flattening all Storefront Settings in MySQL...');

  // 1. Fetch current rows
  const [existingRows] = await pool.query('SELECT setting_key, setting_val FROM store_settings');
  const existingMap = new Map();
  for (const r of existingRows) {
    existingMap.set(r.setting_key, r.setting_val);
  }

  // 2. Remove legacy nesting keys
  await pool.query('DELETE FROM store_settings WHERE setting_key IN ("allSettings", "settings")');

  // 3. Insert each default key if not present, or keep custom if already present
  let inserted = 0;
  let preserved = 0;

  for (const [key, defaultVal] of Object.entries(DEFAULT_STOREFRONT_SETTINGS)) {
    const existingVal = existingMap.get(key);
    let valToSave = defaultVal;

    if (existingVal !== undefined && existingVal !== null && existingVal !== '') {
      try {
        valToSave = JSON.parse(existingVal);
      } catch {
        valToSave = existingVal;
      }
      preserved++;
    } else {
      inserted++;
    }

    const valStr = typeof valToSave === 'object' ? JSON.stringify(valToSave) : String(valToSave);
    await pool.query(
      `INSERT INTO store_settings (setting_key, setting_val)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_val = VALUES(setting_val)`,
      [key, valStr]
    );
  }

  const [finalRows] = await pool.query('SELECT COUNT(*) as total FROM store_settings');
  console.log(`✅ Success! Seeded ${inserted} missing keys, Preserved ${preserved} custom keys.`);
  console.log(`Total active setting keys in store_settings table: ${finalRows[0].total}`);
  process.exit(0);
}

seedSettings().catch(err => {
  console.error('Failed to seed settings:', err);
  process.exit(1);
});
