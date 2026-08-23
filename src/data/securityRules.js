// 바이브 코딩 결과물에서 자주 발견되는 취약점 패턴 규칙집.
// severity: critical(심각) | warning(경고) | info(확인 필요)
// scanMinified: true인 규칙은 압축(번들) 파일에서도 검사한다 — 비밀키는 번들 속에도 숨어 있기 때문.

export const CATEGORIES = {
  secret: { label: '비밀키·민감정보 노출', icon: '🔑' },
  xss: { label: '위험한 코드 실행 (XSS 등)', icon: '💉' },
  db: { label: '인증·데이터베이스', icon: '🗄️' },
  privacy: { label: '개인정보', icon: '🪪' },
  transport: { label: '전송·연결 보안', icon: '🔒' },
  etc: { label: '기타 점검', icon: '🧹' },
}

export const SEVERITIES = {
  critical: { label: '심각', color: 'var(--danger)', weight: 15 },
  warning: { label: '경고', color: 'var(--warn)', weight: 5 },
  info: { label: '확인 필요', color: 'var(--info)', weight: 1 },
}

const rules = [
  // ───────────────────────── 비밀키·민감정보 노출 ─────────────────────────
  {
    id: 'google-api-key',
    category: 'secret',
    severity: 'critical',
    scanMinified: true,
    maskSecret: true,
    title: 'Google API 키가 코드에 노출됨',
    pattern: /AIza[0-9A-Za-z\-_]{35}/g,
    explain:
      'Google(지도, 시트, Gemini 등) API 키가 코드에 그대로 적혀 있어요. 웹에 올라간 코드는 누구나 "소스 보기"로 열어볼 수 있어서, 이 키는 이미 공개된 것과 같아요.',
    risk: '다른 사람이 내 키로 유료 API를 마음껏 호출해서 요금 폭탄을 맞거나, 키가 정지될 수 있어요. (Firebase 웹 설정의 apiKey는 예외 — 아래 Firebase 항목 참고)',
    fix: 'Google Cloud 콘솔에서 이 키를 삭제(재발급)하고, 새 키에는 "HTTP 리퍼러 제한"으로 내 사이트 주소에서만 쓰이게 제한하세요. 결제가 걸린 API라면 서버(프록시)를 거쳐 호출하는 것이 안전해요.',
    aiPrompt:
      '내 코드에 Google API 키가 하드코딩되어 노출되어 있어. 이 키를 코드에서 제거하고, 정적 사이트(GitHub Pages)에서도 안전하게 쓸 수 있는 구조(리퍼러 제한 안내 포함)로 바꿔줘. 키가 필요 없는 대안이 있다면 그것도 알려줘.',
  },
  {
    id: 'openai-key',
    category: 'secret',
    severity: 'critical',
    scanMinified: true,
    maskSecret: true,
    title: 'OpenAI API 키가 코드에 노출됨',
    pattern: /sk-(?:proj-)?[A-Za-z0-9_-]{20,}T3BlbkFJ[A-Za-z0-9_-]{20,}|sk-proj-[A-Za-z0-9_-]{40,}/g,
    explain: 'OpenAI(ChatGPT API) 비밀키가 코드에 그대로 들어 있어요. 이 키는 통장 비밀번호처럼 절대 공개되면 안 되는 값이에요.',
    risk: '누구나 이 키로 내 계정 요금을 쓸 수 있어요. 실제로 노출된 키는 자동 수집 봇이 몇 분 안에 찾아냅니다.',
    fix: '지금 바로 OpenAI 대시보드에서 이 키를 폐기(revoke)하세요. 브라우저에서 직접 호출하지 말고, 키를 숨길 수 있는 서버(예: Cloudflare Workers, Vercel Functions)를 중간에 두세요.',
    aiPrompt:
      '내 웹앱 코드에 OpenAI API 키가 하드코딩되어 있어. 키를 코드에서 제거하고, 무료로 만들 수 있는 간단한 프록시 서버(Cloudflare Workers 또는 Vercel Functions)를 통해 호출하는 구조로 바꿔줘. 프록시 배포 방법도 단계별로 알려줘.',
  },
  {
    id: 'anthropic-key',
    category: 'secret',
    severity: 'critical',
    scanMinified: true,
    maskSecret: true,
    title: 'Anthropic(Claude) API 키가 코드에 노출됨',
    pattern: /sk-ant-[A-Za-z0-9\-_]{20,}/g,
    explain: 'Claude API 비밀키가 코드에 그대로 들어 있어요. 웹에 배포하면 누구나 볼 수 있는 값이 됩니다.',
    risk: '타인이 내 키로 요금을 발생시킬 수 있어요. 노출된 키는 폐기하는 것 외에 되돌릴 방법이 없어요.',
    fix: 'Anthropic 콘솔에서 키를 폐기하고 새로 발급하세요. 배포용 앱이라면 프록시 서버를 두거나, 사용자가 각자 자기 키를 입력하는 방식으로 바꾸세요.',
    aiPrompt:
      '내 웹앱 코드에 Anthropic API 키가 하드코딩되어 있어. 키를 제거하고, 사용자가 자신의 API 키를 직접 입력해서 쓰는 방식(키는 저장하지 않음) 또는 프록시 서버 방식 중 내 상황에 맞는 쪽으로 리팩토링해줘.',
  },
  {
    id: 'aws-key',
    category: 'secret',
    severity: 'critical',
    scanMinified: true,
    maskSecret: true,
    title: 'AWS 액세스 키가 코드에 노출됨',
    pattern: /AKIA[0-9A-Z]{16}/g,
    explain: 'AWS(아마존 클라우드) 액세스 키가 코드에 들어 있어요.',
    risk: '해커가 이 키로 서버를 만들어 비트코인 채굴 등에 쓰면 수백만 원 단위의 요금이 나올 수 있어요. 가장 위험한 유형의 노출입니다.',
    fix: '지금 즉시 AWS IAM 콘솔에서 이 키를 비활성화하고 삭제하세요. 클라이언트 코드에는 AWS 키를 절대 넣지 마세요.',
    aiPrompt:
      '내 코드에 AWS 액세스 키가 노출되어 있어. 키를 제거하고, 프론트엔드에서 AWS 리소스에 안전하게 접근하는 구조(Cognito, 서명된 URL, 또는 서버 경유)로 바꿔줘.',
  },
  {
    id: 'github-token',
    category: 'secret',
    severity: 'critical',
    scanMinified: true,
    maskSecret: true,
    title: 'GitHub 토큰이 코드에 노출됨',
    pattern: /gh[pousr]_[A-Za-z0-9]{36,}/g,
    explain: 'GitHub 개인 액세스 토큰이 코드에 들어 있어요. 이 토큰은 내 GitHub 계정의 열쇠예요.',
    risk: '타인이 내 저장소를 삭제하거나 악성 코드를 심을 수 있어요.',
    fix: 'GitHub Settings → Developer settings에서 이 토큰을 즉시 폐기하세요.',
    aiPrompt: '내 코드에 GitHub 토큰이 하드코딩되어 있어. 토큰 없이 동작하도록 코드를 수정하고, 토큰이 필요한 작업이라면 안전한 대안을 제시해줘.',
  },
  {
    id: 'telegram-token',
    category: 'secret',
    severity: 'critical',
    scanMinified: true,
    maskSecret: true,
    title: '텔레그램 봇 토큰이 코드에 노출됨',
    pattern: /\b\d{8,10}:AA[A-Za-z0-9_-]{30,}\b/g,
    explain: '텔레그램 봇 토큰이 코드에 들어 있어요. 알림 발송용으로 넣는 경우가 많은데, 이 토큰이 있으면 누구나 내 봇을 조종할 수 있어요.',
    risk: '타인이 내 봇 이름으로 학생·학부모에게 아무 메시지나 보낼 수 있어요.',
    fix: 'BotFather에서 /revoke로 토큰을 재발급하고, 봇 호출은 서버(프록시)를 거치게 하세요.',
    aiPrompt: '내 웹앱에 텔레그램 봇 토큰이 노출되어 있어. 토큰을 숨긴 채 알림을 보낼 수 있는 구조(무료 서버리스 프록시)로 바꿔줘.',
  },
  {
    id: 'private-key-block',
    category: 'secret',
    severity: 'critical',
    scanMinified: true,
    title: '개인키(Private Key) 파일 내용이 포함됨',
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    explain: '암호화용 개인키(서비스 계정 JSON, SSH 키 등)가 코드에 포함되어 있어요.',
    risk: '이 키로 서버나 클라우드 계정 전체가 탈취될 수 있어요.',
    fix: '해당 키를 즉시 폐기·재발급하고, 코드와 저장소 기록(git history)에서도 제거하세요.',
    aiPrompt: '내 프로젝트에 개인키가 포함되어 커밋됐어. git 기록에서 완전히 제거하는 방법과, 키 없이 동작하는 구조로 바꾸는 방법을 알려줘.',
  },
  {
    id: 'supabase-service-role',
    category: 'secret',
    severity: 'critical',
    scanMinified: true,
    title: 'Supabase service_role 키로 의심되는 값 발견',
    pattern: /["']service_role["']|SUPABASE_SERVICE_ROLE/g,
    explain: 'Supabase의 service_role 키는 모든 보안 규칙(RLS)을 무시하는 "마스터 키"예요. 브라우저 코드에는 절대 넣으면 안 돼요. (anon 키는 공개용이라 괜찮아요.)',
    risk: '데이터베이스의 모든 데이터를 누구나 읽고, 고치고, 지울 수 있게 됩니다.',
    fix: '프론트엔드에서는 anon 키만 쓰고, service_role 키는 서버 환경변수로만 보관하세요. 노출됐다면 Supabase 대시보드에서 키를 재발급하세요.',
    aiPrompt: '내 프론트엔드 코드에 Supabase service_role 키가 쓰이고 있어. anon 키 + RLS(Row Level Security) 정책 기반으로 안전하게 리팩토링해줘. 필요한 RLS 정책 SQL도 함께 만들어줘.',
  },
  {
    id: 'hardcoded-password',
    category: 'secret',
    severity: 'warning',
    title: '비밀번호가 코드에 직접 적혀 있음',
    pattern: /(?:password|passwd|pwd|비밀번호|암호)\s*(?:===?|[:=])\s*["'][^"']{3,}["']/gi,
    explain:
      '관리자 모드 진입 등에 쓰는 비밀번호가 코드에 그대로 적혀 있어요. 웹 코드는 누구나 "소스 보기"(F12)로 볼 수 있어서, 학생들이 몇 분 만에 찾아냅니다.',
    risk: '학생이 교사용 화면·관리자 기능에 들어가 데이터를 보거나 조작할 수 있어요.',
    fix: '간단한 도구라면 비밀번호의 해시값만 코드에 두는 방식으로 바꾸고, 진짜 보호가 필요한 데이터라면 서버 인증(Firebase Auth 등)을 쓰세요.',
    aiPrompt:
      '내 웹앱의 관리자 비밀번호가 코드에 평문으로 하드코딩되어 있어. 최소한 SHA-256 해시 비교 방식으로 바꿔주고, 이 방식의 한계(정적 사이트에서는 완전한 보호가 불가능함)도 주석으로 설명해줘. 더 안전한 구조가 필요하면 대안도 제시해줘.',
  },
  {
    id: 'vite-env-secret',
    category: 'secret',
    severity: 'warning',
    scanMinified: true,
    title: 'VITE_ 환경변수에 비밀키를 넣은 흔적',
    pattern: /VITE_[A-Z_]*(?:SECRET|TOKEN|PRIVATE|SERVICE)[A-Z_]*/g,
    explain:
      '"환경변수에 넣었으니 안전하다"고 생각하기 쉽지만, VITE_로 시작하는 환경변수는 빌드할 때 결과 파일에 값이 그대로 새겨져 공개됩니다.',
    risk: '배포된 사이트의 JS 파일을 열면 비밀키가 그대로 보여요.',
    fix: '비밀키는 VITE_ 변수에 넣지 마세요. 브라우저 코드에서 비밀키가 필요하다면 구조 자체를 바꿔야 해요(프록시 서버 등).',
    aiPrompt:
      '내 Vite 프로젝트에서 VITE_ 환경변수로 비밀키를 다루고 있는데, 이러면 빌드 결과물에 노출된다고 들었어. 노출되면 안 되는 키를 안전하게 다루는 구조로 바꿔줘.',
  },

  // ───────────────────────── 위험한 코드 실행 (XSS 등) ─────────────────────────
  {
    id: 'eval-usage',
    category: 'xss',
    severity: 'warning',
    title: 'eval() 사용',
    pattern: /\beval\s*\(/g,
    explain: 'eval()은 문자열을 코드로 실행하는 함수예요. 사용자 입력이 조금이라도 섞이면, 입력창이 해커의 코드 실행 통로가 됩니다.',
    risk: '악성 스크립트 실행(XSS)으로 다른 학생의 데이터 탈취, 화면 변조 등이 가능해져요.',
    fix: '대부분의 eval()은 JSON.parse(), 객체 조회, 함수 매핑 등으로 바꿀 수 있어요.',
    example: {
      bad: 'const data = eval(jsonText)',
      good: 'const data = JSON.parse(jsonText)',
    },
    aiPrompt: '내 코드에서 eval() 사용을 전부 찾아서, 같은 기능을 하는 안전한 코드(JSON.parse, 객체 매핑 등)로 바꿔줘.',
  },
  {
    id: 'new-function',
    category: 'xss',
    severity: 'warning',
    title: 'new Function() 사용',
    pattern: /new\s+Function\s*\(/g,
    explain: 'new Function()도 eval()처럼 문자열을 코드로 실행해요.',
    risk: '사용자 입력이 섞이면 악성 코드 실행 통로가 됩니다.',
    fix: '문자열로 코드를 만들지 말고 일반 함수로 바꾸세요.',
    aiPrompt: '내 코드의 new Function() 사용을 안전한 일반 함수 구조로 리팩토링해줘.',
  },
  {
    id: 'innerhtml-dynamic',
    category: 'xss',
    severity: 'warning',
    title: 'innerHTML에 변수·입력값을 넣고 있음',
    pattern: /\.innerHTML\s*[+]?=\s*[^;\n]*(?:\$\{|\+\s*[A-Za-z_$])/g,
    explain:
      'innerHTML에 변수(특히 사용자가 입력한 값)를 넣으면, 입력값에 <script>나 <img onerror=...> 같은 태그가 섞였을 때 그대로 실행돼요. 이것이 가장 흔한 XSS(교차 사이트 스크립팅) 취약점이에요.',
    risk: '학생이 이름이나 일기에 악성 태그를 넣으면, 그 화면을 보는 다른 학생·교사의 브라우저에서 코드가 실행됩니다. 방명록·게시판·발표 화면 기능이 특히 위험해요.',
    fix: '텍스트만 넣을 곳에는 textContent를 쓰세요. HTML 구조가 필요하면 createElement로 조립하거나, DOMPurify 같은 정화 라이브러리를 거치세요.',
    example: {
      bad: 'list.innerHTML += "<li>" + userName + "</li>";',
      good: 'const li = document.createElement("li");\nli.textContent = userName; // 태그가 글자로만 취급돼 안전\nlist.appendChild(li);',
    },
    aiPrompt:
      '내 코드에서 사용자 입력이 innerHTML로 들어가는 부분을 전부 찾아서 XSS에 안전하게 바꿔줘. 단순 텍스트는 textContent로, HTML이 꼭 필요한 곳은 DOMPurify를 적용해줘.',
  },
  {
    id: 'document-write',
    category: 'xss',
    severity: 'info',
    title: 'document.write() 사용',
    pattern: /document\.write\s*\(/g,
    explain: 'document.write()는 오래된 방식으로, 변수가 섞이면 XSS 위험이 있고 페이지 로딩도 방해해요.',
    risk: '사용자 입력이 섞일 경우 악성 코드 실행 가능.',
    fix: 'DOM API(createElement, textContent)로 바꾸세요.',
    example: {
      bad: 'document.write("<p>" + msg + "</p>");',
      good: 'const p = document.createElement("p");\np.textContent = msg;\ndocument.body.appendChild(p);',
    },
    aiPrompt: '내 코드의 document.write() 사용을 현대적인 DOM API로 바꿔줘.',
  },
  {
    id: 'settimeout-string',
    category: 'xss',
    severity: 'info',
    title: 'setTimeout/setInterval에 문자열 전달',
    pattern: /set(?:Timeout|Interval)\s*\(\s*["'`]/g,
    explain: 'setTimeout("코드문자열", ...)은 eval()과 같은 방식으로 동작해요.',
    risk: '문자열에 변수가 섞이면 코드 실행 통로가 됩니다.',
    fix: '문자열 대신 함수를 전달하세요: setTimeout(() => {...}, 1000)',
    example: {
      bad: 'setTimeout("nextQuestion()", 1000);',
      good: 'setTimeout(() => nextQuestion(), 1000);',
    },
    aiPrompt: '내 코드의 setTimeout/setInterval 문자열 인자를 화살표 함수로 바꿔줘.',
  },
  {
    id: 'javascript-url',
    category: 'xss',
    severity: 'info',
    title: 'javascript: URL 사용',
    pattern: /(?:href|src)\s*=\s*["']javascript:/gi,
    explain: 'href="javascript:..." 방식은 XSS의 통로가 되기 쉬운 오래된 패턴이에요.',
    risk: '링크 값이 동적으로 만들어지면 악성 코드가 실행될 수 있어요.',
    fix: '버튼 + 이벤트 리스너(addEventListener) 방식으로 바꾸세요.',
    example: {
      bad: '<a href="javascript:openMenu()">메뉴</a>',
      good: '<button type="button" onclick="openMenu()">메뉴</button>',
    },
    aiPrompt: '내 코드의 javascript: URL 패턴을 이벤트 리스너 방식으로 바꿔줘.',
  },

  // ───────────────────────── 인증·데이터베이스 ─────────────────────────
  {
    id: 'firestore-open-write',
    category: 'db',
    severity: 'critical',
    title: 'Firebase 보안 규칙이 전체 공개(쓰기 허용)로 되어 있음',
    pattern: /allow\s+(?:read\s*,\s*)?write\s*:\s*if\s+true|"\.write"\s*:\s*true/g,
    explain:
      '데이터베이스 보안 규칙이 "누구나 쓰기 가능"으로 되어 있어요. 앱을 만들 때 임시로 열어두고 잊는 경우가 가장 많아요. 이 규칙이면 데이터베이스가 인터넷에 문 열린 채로 있는 것과 같아요.',
    risk: '누구나 학생 데이터를 지우거나 바꾸거나, 가짜 데이터를 무한히 넣을 수 있어요. 학생 개인정보가 담겨 있다면 유출 사고가 됩니다.',
    fix: '규칙을 "필요한 경로만, 필요한 조건에서만" 허용하도록 좁히세요. 예: 로그인한 본인 문서만 쓰기 가능, 특정 컬렉션은 생성만 가능 등.',
    aiPrompt:
      '내 Firebase 보안 규칙이 allow write: if true로 전체 공개되어 있어. 내 앱의 데이터 구조를 보고, 학생은 자기 데이터만 쓸 수 있고 교사만 전체를 읽을 수 있는 최소 권한 규칙으로 다시 작성해줘. 각 규칙에 설명 주석도 달아줘.',
  },
  {
    id: 'firestore-open-read',
    category: 'db',
    severity: 'warning',
    title: 'Firebase 보안 규칙이 전체 공개(읽기 허용)로 되어 있음',
    pattern: /allow\s+read\s*:\s*if\s+true|"\.read"\s*:\s*true/g,
    explain: '데이터베이스가 "누구나 읽기 가능"으로 되어 있어요. 공개 게시판이라면 괜찮지만, 학생 이름·일기·감정기록이 있다면 문제예요.',
    risk: 'URL만 알면 외부인이 학생 데이터를 전부 열람할 수 있어요.',
    fix: '개인정보가 담긴 경로는 로그인/역할 조건을 걸고, 정말 공개해도 되는 데이터만 열어두세요.',
    aiPrompt: '내 Firebase 규칙이 allow read: if true야. 데이터 중 공개해도 되는 것과 보호해야 하는 것을 구분해서, 보호 대상에는 인증 조건을 거는 규칙으로 다시 써줘.',
  },
  {
    id: 'firebase-config',
    category: 'db',
    severity: 'info',
    title: 'Firebase 웹 설정(apiKey 등)이 코드에 있음 — 이건 괜찮지만, 확인할 것이 있어요',
    pattern: /apiKey\s*:\s*["']AIza/g,
    explain:
      'Firebase 웹 설정의 apiKey는 비밀키가 아니라 "프로젝트 주소"에 가까워서 공개되어도 괜찮아요. 진짜 보안은 Firestore/RTDB "보안 규칙"이 담당해요.',
    risk: '설정 자체는 위험하지 않지만, 보안 규칙이 열려 있으면(위 항목 참고) 이 주소로 누구나 데이터에 접근할 수 있어요.',
    fix: 'Firebase 콘솔에서 Firestore·Realtime DB·Storage 보안 규칙을 확인하세요. "테스트 모드"로 만든 프로젝트는 30일 후 잠기기 전까지 전체 공개 상태예요.',
    aiPrompt: '내 Firebase 프로젝트의 Firestore 보안 규칙을 점검하고 싶어. 규칙 파일을 보여줄 테니 위험한 부분을 찾아 최소 권한 원칙으로 고쳐줘.',
  },
  {
    id: 'client-side-gate',
    category: 'db',
    severity: 'warning',
    title: '브라우저에서 비밀번호를 확인하는 코드 (prompt 등)',
    pattern: /prompt\s*\([^)]*(?:비밀번호|암호|password|pin|코드)/gi,
    explain:
      'prompt() 창으로 비밀번호를 물어보고 코드 안에서 비교하는 방식이에요. 브라우저 코드는 누구나 볼 수 있어서, 정답이 코드에 함께 들어 있는 셈이에요.',
    risk: '학생이 F12 개발자 도구로 몇 분 안에 통과할 수 있어요.',
    fix: '가벼운 구분용이라면 해시 비교로, 진짜 보호가 필요하면 서버 인증으로 바꾸세요.',
    aiPrompt: '내 앱의 prompt() 기반 비밀번호 확인을 더 안전한 방식으로 바꿔줘. 정적 사이트라는 제약 안에서 가능한 최선의 방법과 그 한계를 함께 설명해줘.',
  },
  {
    id: 'sql-concat',
    category: 'db',
    severity: 'warning',
    title: 'SQL 문자열 직접 조립 (SQL 인젝션 위험)',
    pattern: /["'`]\s*(?:SELECT|INSERT|UPDATE|DELETE)\s[^"'`]*["'`]\s*\+/gi,
    explain: 'SQL 문장을 문자열 덧셈으로 조립하고 있어요. 사용자 입력이 섞이면 데이터베이스 명령을 마음대로 조작하는 "SQL 인젝션" 공격이 가능해져요.',
    risk: '데이터 전체 유출·삭제가 가능한 고전적이지만 여전히 강력한 공격이에요.',
    fix: '파라미터 바인딩(prepared statement)을 쓰세요. 예: query("... WHERE id = ?", [userId])',
    aiPrompt: '내 코드에서 SQL 문자열을 직접 조립하는 부분을 전부 파라미터 바인딩 방식으로 바꿔줘.',
  },

  // ───────────────────────── 개인정보 ─────────────────────────
  {
    id: 'rrn-data',
    category: 'privacy',
    severity: 'critical',
    scanMinified: true,
    maskSecret: true,
    title: '주민등록번호로 보이는 데이터 발견',
    pattern: /\b\d{6}\s*-\s*[1-4]\d{6}\b/g,
    explain: '주민등록번호 형식(6자리-7자리)의 데이터가 코드나 데이터에 들어 있어요.',
    risk: '주민등록번호는 법령상 근거 없이는 수집·보관 자체가 금지예요(개인정보보호법 제24조의2). 유출 시 법적 책임이 가장 무거운 정보입니다.',
    fix: '즉시 삭제하세요. 학생 구분이 필요하면 학번, 임의 코드, 닉네임으로 충분해요.',
    aiPrompt: '내 앱에서 주민등록번호를 다루는 부분을 전부 제거하고, 대신 임의 생성 코드로 사용자를 구분하는 방식으로 바꿔줘.',
  },
  {
    id: 'rrn-field',
    category: 'privacy',
    severity: 'critical',
    title: '주민등록번호 입력·수집 필드 발견',
    pattern: /주민\s*등록\s*번호|주민번호|(?:\b|_)(?:jumin|rrn|resident_?(?:registration_?)?number)(?:\b|_)/gi,
    explain: '주민등록번호를 입력받는 필드나 변수가 있어요.',
    risk: '주민등록번호는 법령에 구체적 근거가 있을 때만 처리할 수 있어요(개인정보보호법 제24조의2). 학교 수업·행사용 앱에는 그런 근거가 없습니다.',
    fix: '해당 필드를 삭제하세요. 본인 확인이 필요하면 학번+이름, 또는 임의 코드로 대체하세요.',
    aiPrompt: '내 앱의 주민등록번호 입력 필드를 제거하고, 학번이나 임의 코드 기반의 구분 방식으로 바꿔줘.',
  },
  {
    id: 'localstorage-personal',
    category: 'privacy',
    severity: 'warning',
    title: 'localStorage에 개인정보를 저장하는 것으로 보임',
    pattern: /localStorage\.setItem\s*\(\s*["'][^"']*(?:name|이름|phone|전화|tel|email|이메일|birth|생년월일|student)/gi,
    explain:
      'localStorage는 그 컴퓨터·브라우저에 계속 남는 저장소예요. 교실 공용 태블릿이나 컴퓨터실 PC에서는 다음 학생이 이전 학생의 정보를 볼 수 있어요.',
    risk: '공용 기기에서 학생 개인정보(이름, 기록)가 다른 학생에게 노출됩니다.',
    fix: '꼭 남길 필요가 없으면 sessionStorage(탭 닫으면 삭제)로 바꾸고, "내 기록 지우기" 버튼을 만들어 주세요. 활동 종료 시 자동 삭제도 좋아요.',
    example: {
      bad: 'localStorage.setItem("studentName", name); // 기기에 계속 남음',
      good: 'sessionStorage.setItem("studentName", name); // 탭을 닫으면 사라짐',
    },
    aiPrompt:
      '내 앱이 localStorage에 학생 개인정보를 저장하고 있어. 공용 기기 안전을 위해 (1) 민감한 값은 sessionStorage로 옮기고 (2) "내 기록 지우기" 버튼을 추가하고 (3) 활동 완료 시 개인정보를 자동 정리하는 코드로 바꿔줘.',
  },
  {
    id: 'geolocation',
    category: 'privacy',
    severity: 'info',
    title: '위치정보 사용 (getCurrentPosition)',
    pattern: /getCurrentPosition|watchPosition/g,
    explain: '앱이 사용자의 위치정보를 가져와요. 위치정보는 별도의 법(위치정보법)으로 보호되는 민감한 정보예요.',
    risk: '학생 위치가 저장·전송되면 안전 문제와 법적 문제가 함께 생겨요.',
    fix: '위치를 서버로 보내거나 저장하지 말고 기기 안에서만 쓰세요. 사용 전에 왜 필요한지 안내하고, 대략적인 위치(동네 단위)로 충분하면 정밀 위치를 쓰지 마세요.',
    aiPrompt: '내 앱의 위치정보 사용 부분을 점검해줘. 위치가 저장·전송되는지 확인하고, 기기 안에서만 처리하도록 바꿔줘.',
  },
  {
    id: 'camera-mic',
    category: 'privacy',
    severity: 'info',
    title: '카메라·마이크 사용 (getUserMedia)',
    pattern: /getUserMedia/g,
    explain: '앱이 카메라나 마이크를 사용해요. 얼굴·음성은 그 자체로 개인정보(생체정보에 준하는 정보)예요.',
    risk: '촬영물이 서버로 전송·저장된다면 별도 동의가 필요하고, 유출 시 매우 민감한 사고가 됩니다.',
    fix: '가능하면 영상·음성을 기기 안에서만 처리(온디바이스)하고 저장·전송하지 마세요. 화면에 "촬영 영상은 저장되지 않아요" 안내를 넣어 주세요.',
    aiPrompt: '내 앱의 카메라/마이크 사용을 점검해줘. 영상·음성 데이터가 외부로 전송되거나 저장되는 부분이 있는지 확인하고, 온디바이스 처리로 바꾸고, 사용자 안내 문구도 추가해줘.',
  },
  {
    id: 'google-form-endpoint',
    category: 'privacy',
    severity: 'info',
    title: 'Google 폼/시트로 데이터 전송',
    pattern: /docs\.google\.com\/forms|script\.google\.com\/macros|formResponse/g,
    explain: '입력받은 데이터를 Google 폼이나 앱스 스크립트로 보내고 있어요. 편리한 방법이지만 개인정보가 담긴다면 챙길 것이 있어요.',
    risk: '시트 공유 설정이 "링크가 있는 모든 사용자"로 되어 있으면 수집된 개인정보가 통째로 공개됩니다. 또한 해외 서버 보관에 해당해요.',
    fix: '연결된 시트의 공유 설정을 "특정 사용자만"으로 제한하고, 수집 항목을 최소화하세요. 앱 화면에 어떤 정보가 어디로 가는지 안내를 넣으세요.',
    aiPrompt: '내 앱이 Google 시트로 데이터를 보내고 있어. 개인정보 최소화 관점에서 수집 항목을 점검하고, 사용자 안내 문구를 추가해줘.',
  },

  // ───────────────────────── 전송·연결 보안 ─────────────────────────
  {
    id: 'http-resource',
    category: 'transport',
    severity: 'warning',
    title: '암호화되지 않은 http:// 주소 사용',
    pattern: /(?:src|href|action|url)\s*[:=]\s*["']http:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0)/gi,
    explain: 'https가 아닌 http 주소로 리소스를 불러오거나 데이터를 보내요. http는 암호화가 없어서 중간에서 내용을 훔쳐보거나 바꿀 수 있어요.',
    risk: '같은 와이파이에 있는 사람이 전송 내용을 볼 수 있고, 브라우저가 리소스를 차단해 앱이 깨질 수도 있어요(혼합 콘텐츠).',
    fix: '주소를 https://로 바꾸세요. https를 지원하지 않는 서비스라면 다른 서비스를 찾는 것이 좋아요.',
    example: {
      bad: '<img src="http://example.com/pic.png">',
      good: '<img src="https://example.com/pic.png">',
    },
    aiPrompt: '내 코드의 http:// 주소를 전부 찾아서 https://로 바꿔줘. https를 지원하지 않는 주소가 있다면 알려줘.',
  },
  {
    id: 'target-blank',
    category: 'transport',
    severity: 'info',
    title: 'target="_blank" 링크에 rel="noopener" 누락',
    pattern: /target\s*=\s*["']_blank["'](?![^>]*rel\s*=)/gi,
    explain: '새 탭으로 여는 링크에 rel="noopener"가 없으면, 열린 페이지가 원래 페이지를 조작할 수 있는 통로가 생겨요.',
    risk: '외부 링크라면 피싱 페이지로 원래 탭을 바꿔치기하는 공격(tabnabbing)이 가능해요.',
    fix: 'target="_blank"인 모든 링크에 rel="noopener noreferrer"를 추가하세요.',
    example: {
      bad: '<a href="https://..." target="_blank">자료 보기</a>',
      good: '<a href="https://..." target="_blank" rel="noopener noreferrer">자료 보기</a>',
    },
    aiPrompt: '내 HTML의 모든 target="_blank" 링크에 rel="noopener noreferrer"를 추가해줘.',
  },
  {
    id: 'cors-wildcard',
    category: 'transport',
    severity: 'warning',
    title: 'CORS 전체 허용 (Access-Control-Allow-Origin: *)',
    pattern: /Access-Control-Allow-Origin["']?\s*[:,]\s*["']\*/g,
    explain: '서버가 모든 사이트의 요청을 허용하도록 설정되어 있어요.',
    risk: '아무 사이트나 내 서버의 데이터를 가져다 쓸 수 있어요. 개인 데이터를 다루는 API라면 위험해요.',
    fix: '허용할 도메인(내 사이트 주소)만 명시하세요.',
    aiPrompt: '내 서버의 CORS 설정이 전체 허용(*)이야. 내 사이트 도메인만 허용하도록 바꿔줘.',
  },

  // ───────────────────────── 기타 점검 ─────────────────────────
  {
    id: 'console-sensitive',
    category: 'etc',
    severity: 'info',
    title: '민감한 값을 console.log로 출력',
    pattern: /console\.log\s*\([^)]*(?:password|token|secret|key|비밀번호)/gi,
    explain: '비밀번호나 토큰을 콘솔에 찍고 있어요. 개발할 땐 편하지만 배포 후에도 누구나 F12로 볼 수 있어요.',
    risk: '민감한 값이 개발자 도구에 그대로 노출됩니다.',
    fix: '배포 전에 민감한 값의 console.log를 제거하세요.',
    aiPrompt: '내 코드에서 민감한 정보(비밀번호, 토큰 등)를 console.log로 출력하는 부분을 전부 찾아 제거해줘.',
  },
  {
    id: 'alert-debug',
    category: 'etc',
    severity: 'info',
    title: 'alert()로 내부 데이터 출력',
    pattern: /alert\s*\([^)]*(?:token|password|secret|JSON\.stringify)/gi,
    explain: '디버깅용 alert가 내부 데이터를 화면에 띄우고 있어요.',
    risk: '내부 구조나 민감한 값이 사용자에게 노출됩니다.',
    fix: '배포 전에 디버깅용 alert를 제거하세요.',
    aiPrompt: '내 코드의 디버깅용 alert 호출을 전부 찾아 제거해줘.',
  },
]

export default rules

// 프로젝트 단위 규칙: 한 줄 패턴이 아니라 파일 전체를 보고 "있어야 할 것이 없음"을 찾는다.
// check(files)가 발견 위치 배열(비면 문제 없음)을 반환한다.
export const projectRules = [
  {
    id: 'firebase-no-appcheck',
    category: 'db',
    severity: 'info',
    title: 'Firebase를 쓰는데 App Check 흔적이 없어요',
    explain:
      'App Check는 "내 앱에서 온 요청만" 데이터베이스에 접근하게 하는 잠금장치예요. 이게 없으면 보안 규칙이 올바르더라도, 봇이 정상 경로로 무한 요청을 보내 무료 한도를 소진시켜 앱을 멈출 수 있어요.',
    risk: '무료 한도 소진으로 그날 하루 서비스가 중단되거나, 유료 플랜이라면 요금이 발생할 수 있어요. "코드에 잘못이 없어도 당하는" 가용성 공격이에요.',
    fix: 'Firebase 콘솔 → App Check에서 reCAPTCHA v3로 활성화하고, 초기화 코드에 initializeAppCheck를 추가하세요. 처음엔 "모니터링 모드"로 시작해 정상 요청이 막히지 않는지 확인한 뒤 강제 적용으로 바꾸면 안전해요.',
    aiPrompt:
      '내 웹앱이 Firebase를 쓰는데 App Check가 없어. reCAPTCHA v3 기반 App Check를 추가해줘 — initializeAppCheck 초기화 코드와, Firebase 콘솔에서 해야 할 설정 단계를 순서대로 알려줘.',
    check(files) {
      const hasAppCheck = files.some((f) => /app-?check/i.test(f.text))
      if (hasAppCheck) return []
      const occurrences = []
      for (const f of files) {
        if (!/firebase/i.test(f.text)) continue
        const lines = f.text.split('\n')
        for (let i = 0; i < lines.length; i++) {
          if (/initializeApp\s*\(/.test(lines[i])) {
            occurrences.push({
              file: f.path,
              line: i + 1,
              snippet: lines[i].trim().slice(0, 160),
            })
            break
          }
        }
      }
      return occurrences
    },
  },
]
