// 방명록(GUESTBOOK) 저장소 설정 — 방명록 폴더만 따로 올려도 동작하도록 이 폴더 안에 둔 사본.
// (3D 공간은 experience/js/live/live-config.js 를 쓴다. Supabase를 연결할 때는 두 파일에 같은 값을 넣는다)
// 비워 두면: 로컬 서버(/api)가 있으면 그것을, 없으면(GitHub Pages) '미리보기' — 쓰기·애니메이션은 되지만 저장되지 않는다.
//
// 1) 로컬·자체 서버: 비워 두면 같은 주소의 /api/ (python3 tools/serve.py)를 자동으로 쓴다.
// 2) GitHub Pages 등 정적 호스팅: Supabase 프로젝트를 만들고 supabase/hirang_live.sql 을 실행한 뒤
//    아래에 Project URL 과 anon(public) key 만 넣는다. anon key는 공개용 키다 — service_role 키는 절대 넣지 않는다.
//    anon 권한으로는 테이블을 직접 읽을 수 없고(RLS), 정해진 함수(RPC)만 부를 수 있다.
export const LIVE = {
  supabase: { url: '', anonKey: '' },
};
