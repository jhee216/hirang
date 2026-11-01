# 하이랑 네이버 검색 프록시 배포

이 폴더는 Vercel에 별도 프로젝트로 배포하는 API야. GitHub Pages는 정적 파일만 제공해서 네이버 API 키를 안전하게 보관하거나 `/api/stores`를 실행할 수 없어.

## Vercel 배포
1. GitHub 저장소 `jhee216/hirang`을 Vercel에 Import해.
2. 프로젝트 설정에서 Root Directory를 `naver-proxy`로 지정해.
3. Environment Variables에 `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`를 등록해. 비밀키는 GitHub 파일에 넣지 마.
4. 배포한 뒤 `https://<배포 도메인>/api/stores?brand=GS25&query=서울`로 응답을 확인해.
5. 사이트의 `NAVER_PROXY_BASE_URL`에 배포 도메인을 넣고 GitHub Pages에 다시 반영해야 실시간 검색이 연결돼. 현재 빈 문자열이면 샘플 매장 목록으로 동작해.

## 로컬 실행
`npm install` 후 `.env.example`을 `.env`로 복사하고 키를 채워 `PORT=5178 npm start`를 실행해. `.env`는 Git에 포함되지 않아.
