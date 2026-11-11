// 하이랑 라이브(익명 방문자·비밀 방명록) 백엔드 설정.
//
// 1) 로컬·자체 서버: 비워 두면 같은 주소의 /api/ (python3 tools/serve.py)를 자동으로 쓴다.
// 2) GitHub Pages 등 정적 호스팅: Supabase 프로젝트를 만들고 supabase/hirang_live.sql 을 실행한 뒤
//    아래에 Project URL 과 anon(public) key 만 넣는다. anon key는 공개용 키다 — service_role 키는 절대 넣지 않는다.
//    anon 권한으로는 테이블을 직접 읽을 수 없고(RLS), 정해진 함수(RPC)만 부를 수 있다.
export const LIVE = {
  supabase: { url: '', anonKey: '' },
};
