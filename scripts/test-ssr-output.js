const http = require('http');

http.get('http://localhost:3000/', res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    console.log('Title match:', data.match(/<title[^>]*>([^<]*)<\/title>/)?.[0]);
    console.log('Meta Title match:', data.match(/<meta[^>]*name=["']title["'][^>]*>/)?.[0]);
    console.log('Favicon match:', data.match(/<link[^>]*id=["']siteFavicon["'][^>]*>/)?.[0]);
    console.log('BrandName match:', data.match(/<span id=["']brandName["']>([^<]*)<\/span>/)?.[0]);
    console.log('Theme style match:', data.match(/<style id=["']serverTheme["']>([\s\S]*?)<\/style>/)?.[0]);
  });
});
