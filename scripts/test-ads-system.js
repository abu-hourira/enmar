const dbService = require('../services/db-service');
const pool = require('../config/db');

async function testAdsSystem() {
  console.log('🧪 Starting Ads & Ad-Media Full System Test...\n');

  // 1. Test dbService.ensureAdsTable & ensureAdMediaTable
  console.log('1️⃣ Testing Table Verification...');
  await dbService.ensureAdsTable();
  await dbService.ensureAdMediaTable();
  console.log('✅ Tables ensured.\n');

  // 2. Test createAdMedia
  console.log('2️⃣ Testing Ad-Media Insertion...');
  const testMedia = await dbService.createAdMedia({
    id: `test_ad_media_${Date.now()}`,
    url: '/uploads/sample-farm-fresh.png',
    type: 'image'
  });
  console.log('✅ Created Ad Media:', testMedia);

  const mediaList = await dbService.getAdMedia();
  const foundMedia = mediaList.find(m => m.id === testMedia.id);
  if (!foundMedia) throw new Error('Created ad media was not found in getAdMedia()');
  console.log('✅ Verified ad media in getAdMedia(), total items:', mediaList.length, '\n');

  // 3. Test createAd (Promotional Ad)
  console.log('3️⃣ Testing Promotional Ad Creation...');
  const sampleAd = await dbService.createAd({
    name: 'Summer Mango Fest',
    tag: 'LIMITED HARVEST',
    headline: 'Fresh Rajshahi Mangoes\nDirect from Orchards',
    body: 'Hand-picked organic sweet mangoes delivered within 4 hours.',
    buttonText: 'Order Mangoes →',
    buttonCat: 'Fruits',
    bg: 'linear-gradient(135deg,#f5a623 0%,#f76b1c 100%)',
    textColor: '#ffffff',
    image: '/uploads/mango-banner.png',
    imageSize: 140,
    active: true
  });
  console.log('✅ Created Promotional Ad:', sampleAd);

  // 4. Test getAllAdsAdmin & getActiveAds
  console.log('4️⃣ Testing Fetching Ads...');
  const allAds = await dbService.getAllAdsAdmin();
  const foundAd = allAds.find(a => a.id === sampleAd.id);
  if (!foundAd) throw new Error('Created ad was not found in getAllAdsAdmin()');
  console.log('✅ Verified ad in getAllAdsAdmin(), total ads:', allAds.length);

  const activeAds = await dbService.getActiveAds();
  const foundActive = activeAds.find(a => a.id === sampleAd.id);
  if (!foundActive) throw new Error('Active ad was not found in getActiveAds()');
  console.log('✅ Verified ad in getActiveAds(), total active ads:', activeAds.length, '\n');

  // 5. Test updateAd
  console.log('5️⃣ Testing Updating Ad...');
  const updatedAd = await dbService.updateAd(sampleAd.id, {
    headline: 'Updated Summer Mango Fest 2026',
    active: false
  });
  console.log('✅ Updated Ad:', updatedAd);

  // 6. Test Direct Database Query Verification
  console.log('6️⃣ Direct MySQL Database Query Verification...');
  const [adRows] = await pool.query('SELECT * FROM ads WHERE id = ?', [sampleAd.id]);
  if (!adRows.length) throw new Error('Direct query failed to find ad in MySQL table');
  console.log('✅ MySQL ads row verified:', {
    id: adRows[0].id,
    name: adRows[0].name,
    headline: adRows[0].headline,
    title: adRows[0].title,
    sub: adRows[0].sub,
    button_text: adRows[0].button_text,
    badge: adRows[0].badge,
    button_cat: adRows[0].button_cat,
    category_target: adRows[0].category_target,
    active: adRows[0].active
  });

  const [mediaRows] = await pool.query('SELECT * FROM ad_media WHERE id = ?', [testMedia.id]);
  if (!mediaRows.length) throw new Error('Direct query failed to find media in MySQL table');
  console.log('✅ MySQL ad_media row verified:', mediaRows[0], '\n');

  // 7. Cleanup test items
  console.log('7️⃣ Cleaning up test items...');
  await dbService.deleteAd(sampleAd.id);
  await dbService.deleteAdMedia(testMedia.id);
  console.log('✅ Test items deleted successfully.\n');

  console.log('🎉 ALL ADS & AD-MEDIA DATABASE TESTS PASSED!');
}

testAdsSystem()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  });
