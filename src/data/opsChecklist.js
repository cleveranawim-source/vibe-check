// 운영·복구(가용성) 자가점검 체크리스트
// 코드의 문이 잠겨 있어도 서비스를 마비시키는 공격(한도 소진, 계정 탈취)과
// 사고 후 복구 준비를 점검한다.

export const opsGate = {
  id: 'o-gate',
  question: '이 앱이 Firebase 같은 외부 데이터베이스·API를 사용하나요?',
  help:
    '학생 입력을 저장하거나 실시간 공유(반 모드, 교사 발표 화면)를 하면 대부분 해당돼요. 데이터 저장 없이 화면만 보여주는 앱이면 "아니요"를 선택하세요.',
  noResult:
    '데이터베이스가 없으면 마비시킬 대상도 적어요. 계정 보안과 긴급 대응 두 가지만 확인해 주세요.',
}

export const opsAlwaysItems = ['o-2fa', 'o-takedown']

export const opsItems = [
  {
    id: 'o-appcheck',
    title: 'App Check — "내 앱에서 온 요청"만 데이터베이스에 접근할 수 있나요?',
    desc:
      '보안 규칙이 올바르더라도, 쓰기가 허용된 경로로 봇이 수만 건의 요청을 보내면 무료 한도가 소진되어 그날 하루 앱이 멈춰요. Firebase App Check(reCAPTCHA v3)를 켜면 내 사이트에서 온 정상 요청만 통과됩니다.',
    basis: 'Firebase 공식 권장 (가용성 보호)',
    fixTip:
      'Firebase 콘솔 → App Check에서 reCAPTCHA v3로 등록하고, 초기화 코드에 initializeAppCheck를 추가하세요. 처음엔 "모니터링 모드"로 켜서 정상 요청이 막히지 않는지 확인한 뒤 강제 적용으로 바꾸면 안전해요.',
    weight: 2,
  },
  {
    id: 'o-write-guard',
    title: '쓰기 제한 — 쓰레기 데이터를 무한히 넣을 수 없게 규칙에 조건이 있나요?',
    desc:
      '쓰기 규칙에 문서 크기 제한, 필수 필드 검사 같은 검증 조건을 넣으면 도배 공격의 피해를 크게 줄일 수 있어요. 예: request.resource.data.text is string && request.resource.data.text.size() < 500',
    basis: 'Firebase 보안 규칙 권장 패턴',
    fixTip:
      'AI에게 이렇게 요청하세요: "내 Firestore 쓰기 규칙에 문서 크기와 필드 형식을 검증하는 조건을 추가해줘. 지금 앱이 저장하는 데이터 구조에 맞게."',
    weight: 2,
  },
  {
    id: 'o-2fa',
    title: '계정 2단계 인증 — GitHub·Google(Firebase) 계정에 2FA를 켰나요?',
    desc:
      '코드가 아무리 안전해도 계정을 뺏기면 사이트 변조·삭제·데이터 유출이 한 번에 일어나요. 배포 계정(GitHub)과 데이터 계정(Google)의 2단계 인증이 사실상 유일한 방어입니다.',
    basis: '계정 보안 기본 (GitHub·Google 권장)',
    fixTip:
      'GitHub: Settings → Password and authentication → Two-factor authentication. Google: 계정 관리 → 보안 → 2단계 인증. 두 개 합쳐 5분이면 켤 수 있어요.',
    weight: 3,
  },
  {
    id: 'o-backup',
    title: '백업 — 사고가 나면 데이터를 복구할 사본이 있나요?',
    desc:
      '소스코드는 GitHub에 있으니 다시 배포하면 되지만, 학생 데이터(Firestore 등)는 지워지면 끝이에요. 중요한 활동 데이터는 활동 후마다 내보내기(CSV/JSON)로 사본을 남겨 두세요.',
    basis: '운영 기본 (복구 계획)',
    fixTip:
      '교사 화면에 CSV 내보내기 버튼이 있다면 활동이 끝날 때마다 저장하세요. 없다면 AI에게 "교사 화면에 Firestore 데이터를 CSV로 내보내는 버튼을 추가해줘"라고 요청하세요.',
    weight: 2,
  },
  {
    id: 'o-takedown',
    title: '긴급 대응 — 이상을 발견하면 앱을 즉시 멈추는 방법을 아나요?',
    desc:
      '유출·도배 같은 사고 시 첫 조치는 "일단 내리기"예요. GitHub Pages는 저장소 Settings → Pages에서 끄거나 저장소를 Private으로 바꾸면 즉시 내려가고, Firebase는 규칙을 allow read, write: if false로 바꾸면 잠깁니다. 사용량(예산) 알림도 켜 두면 이상을 빨리 알 수 있어요.',
    basis: '운영 기본 (사고 대응)',
    fixTip:
      '지금 한 번 연습해 두세요: ① Pages 끄는 위치 확인 ② Firebase 규칙 잠금 문구 메모해 두기 ③ Google Cloud 예산 알림 설정.',
    weight: 1,
  },
]
