// 하이랑 GS25/CU 편의점 검색 프록시 서버 (Express)
// 프론트엔드(hirang.html)는 이 서버의 /api/stores 엔드포인트만 호출합니다.
// 네이버 Client ID/Secret은 이 서버 안에만 존재하며 브라우저로 절대 전달되지 않습니다.
// 이 서버가 hirang.html도 같이 서빙해서, 브라우저 주소가 http://localhost:3000 하나로 통일돼요
// (네이버 지도 Web 서비스 URL 등록 등에 file:// 대신 이 주소를 쓰면 돼요).

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
app.use(express.static(path.join(__dirname, 'public')));

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;

// 5분 캐시 (같은 검색어 반복 호출 시 네이버 API 호출 절약)
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

// 실제로 택배 접수가 되지 않는 매장은 상호명으로 여기에 수동 등록해서 결과에서 제외할 수 있어요.
// (네이버/카카오 등 공개 지도 API에는 "택배 가능 여부" 정보가 없어서, 운영 중 확인되는 대로 채워가는 방식입니다.)
const DELIVERY_UNAVAILABLE = new Set([
  // 예: 'GS25 OO점'
]);

function stripTags(str) {
  return String(str || '').replace(/<[^>]*>/g, '');
}

app.get('/api/stores', async (req, res) => {
  const { brand, query } = req.query;
  if (!brand || !['GS25', 'CU'].includes(brand)) {
    return res.status(400).json({ error: 'brand must be GS25 or CU' });
  }
  const q = (query || '').toString().trim();
  const searchQuery = `${q} ${brand} 편의점`.trim();
  const cacheKey = `${brand}:${q}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.time < CACHE_TTL_MS) {
    return res.json(cached.data);
  }

  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    return res.status(500).json({ error: 'NAVER_CLIENT_ID / NAVER_CLIENT_SECRET가 설정되지 않았어요. .env를 확인해주세요.' });
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
      return res.status(502).json({ error: 'naver api error', detail });
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
      // 카테고리가 편의점인 것만
      .filter((s) => s.category && s.category.includes('편의점'))
      // 상호명에 검색한 브랜드가 포함된 것만 (GS25 / CU)
      .filter((s) => s.name.toUpperCase().includes(brand))
      // 운영 중 확인된 "택배 미접수 매장" 제외
      .filter((s) => !DELIVERY_UNAVAILABLE.has(s.name));

    const payload = { brand, query: q, count: stores.length, stores };
    cache.set(cacheKey, { time: Date.now(), data: payload });
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: 'server error', detail: String(err) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`하이랑 네이버 프록시 서버 실행 중: http://localhost:${PORT}`));
