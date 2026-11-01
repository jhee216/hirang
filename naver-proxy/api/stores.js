// Vercel 서버리스 함수 버전 (백엔드 서버를 따로 띄우기 어렵다면 이 방법이 가장 간단해요)
// 배포: 이 폴더를 그대로 Vercel 프로젝트 루트에 두고 `vercel` 명령으로 배포하면
//       https://your-project.vercel.app/api/stores 로 바로 호출할 수 있어요.
// 환경변수(NAVER_CLIENT_ID, NAVER_CLIENT_SECRET)는 Vercel 대시보드 > Settings > Environment Variables에 등록하세요.

function stripTags(str) {
  return String(str || '').replace(/<[^>]*>/g, '');
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  const { brand, query } = req.query;
  if (!brand || !['GS25', 'CU'].includes(brand)) {
    res.status(400).json({ error: 'brand must be GS25 or CU' });
    return;
  }
  const q = (query || '').toString().trim();
  const searchQuery = `${q} ${brand} 편의점`.trim();

  const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
  const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    res.status(500).json({ error: 'NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 환경변수가 없어요.' });
    return;
  }

  try {
    const url = `https://naverapihub.apigw.ntruss.com/search/v1/local?query=${encodeURIComponent(searchQuery)}&display=5&format=json`;
    const naverRes = await fetch(url, {
      headers: {
        'X-NCP-APIGW-API-KEY-ID': NAVER_CLIENT_ID,
        'X-NCP-APIGW-API-KEY': NAVER_CLIENT_SECRET,
      },
    });

    if (!naverRes.ok) {
      const detail = await naverRes.text();
      res.status(502).json({ error: 'naver api error', detail });
      return;
    }

    const data = await naverRes.json();

    const stores = (data.items || [])
      .map((item) => ({
        name: stripTags(item.title),
        addr: item.roadAddress || item.address,
        category: item.category,
        mapx: item.mapx,
        mapy: item.mapy,
        link: item.link,
      }))
      .filter((s) => s.category && s.category.includes('편의점'))
      .filter((s) => s.name.toUpperCase().includes(brand));

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json({ brand, query: q, count: stores.length, stores });
  } catch (err) {
    res.status(500).json({ error: 'server error', detail: String(err) });
  }
}
