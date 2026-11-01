# 하이랑 공개 배포 순서

## 1. GitHub에 사이트 올리기

1. GitHub Desktop에서 `File → Add Local Repository`를 누른다.
2. 로컬 저장소로 다음 폴더를 선택한다.
   `/Users/Lee/Documents/New project/output/hirang-pages-publish/hirang-pages-source`
3. GitHub 계정으로 로그인한 뒤 `Push origin`을 누른다.
4. 저장소 `jhee216/hirang`에서 `Settings → Pages`로 가서 Source를 `GitHub Actions`로 선택한다.
5. Actions 탭의 `Deploy static site to GitHub Pages` 작업이 성공하면 사이트가 공개된다.
   공개 주소: `https://jhee216.github.io/hirang/`

## 2. 네이버 프록시를 공개 배포하기

GitHub Pages는 정적 사이트 호스팅이라 Node 서버를 실행하지 않는다. 프록시는 별도 서버리스 서비스로 배포한다.

1. Vercel에 로그인하고 GitHub 저장소 `jhee216/hirang`을 Import한다.
2. 프로젝트 설정에서 Root Directory를 `naver-proxy`로 지정하고 배포한다.
3. Vercel 프로젝트 `Settings → Environment Variables`에 아래 변수를 추가한다.
   - `NAVER_CLIENT_ID`
   - `NAVER_CLIENT_SECRET`
4. 다시 Deploy한다. `.env`나 비밀키 파일은 GitHub에 올리지 않는다.
5. 배포된 도메인에서 다음 주소를 열어 JSON 응답을 확인한다.
   `https://<Vercel이-발급한-도메인>/api/stores?brand=GS25&query=서울`

## 3. 사이트와 프록시 연결하기

Vercel에서 실제 도메인을 받은 뒤 `index.html`의 `NAVER_PROXY_BASE_URL` 값을 그 도메인으로 바꾸고 GitHub Desktop에서 Commit 후 Push한다.

```js
var NAVER_PROXY_BASE_URL='https://<Vercel이-발급한-도메인>';
```

`http://localhost:5178`은 개발용 주소라 공개 사이트에는 사용할 수 없다. 실제 Vercel 도메인이 생기기 전에는 사이트가 샘플 매장 정보로 표시된다.
