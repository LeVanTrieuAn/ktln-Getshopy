const { prisma } = require('./src/db');

// Duplicate the logic of buildContext here to test it
async function test() {
  const norm = 'tôi muốn tìm iphone'.toLowerCase();
  
  // same stop words as ai.js
  const stopWords = new Set([
          'muon','mua','tim','xem','gia','bao','nhieu','co','ban','khong',
          'shop','oi','can','toi','minh','em','ban','cho','hoi','ve',
          'duoi','tam','khoang','nao','gi','nhu','the','nay','do',
          'tiep','theo','la','nua','them','voi','nhe','nha'
  ]);
  
  let normClean = norm
          .replace(/may tinh xach tay|may tinh/g, 'laptop')
          .replace(/dien thoai/g, 'smartphone')
          .replace(/may tinh bang/g, 'tablet')
          .replace(/\btv\b/g, 'tivi');
          
  // Step 3 logic
  const tokens = normClean.split(/\s+/).filter(w => !stopWords.has(w) && w.length > 1);
  console.log('Tokens:', tokens);
  
  if (tokens.length > 0) {
    let candidateProducts = await prisma.product.findMany({
      where: {
        OR: tokens.map(t => ({ name: { contains: t, mode: 'insensitive' } })),
        is_deleted: false,
      },
      take: 50,
    });
    console.log('Found candidates:', candidateProducts.length);
    if (candidateProducts.length > 0) {
      candidateProducts.forEach(p => {
        p._score = tokens.filter(t => p.name.toLowerCase().includes(t.toLowerCase())).length;
      });
      candidateProducts.sort((a, b) => b._score - a._score || b.sold - a.sold);
      const products = candidateProducts.slice(0, 4);
      const keyword = tokens.join(' ');
      const link = `/shop?search=${encodeURIComponent(keyword)}`;
      console.log('Link:', link);
    }
  }
}
test().finally(() => process.exit(0));
