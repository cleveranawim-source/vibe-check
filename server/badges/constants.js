export const BASE_SEPOLIA_CHAIN_ID = 84532n
export const BASE_SEPOLIA_EAS_ADDRESS = '0x4200000000000000000000000000000000000021'
export const BASE_SEPOLIA_SCHEMA_REGISTRY_ADDRESS = '0x4200000000000000000000000000000000000020'
export const BASE_SEPOLIA_EASSCAN_URL = 'https://base-sepolia.easscan.org'

// 필드명·타입·순서는 스키마 UID와 온체인 데이터 계약이므로 등록 후 변경하지 않는다.
export const EAS_BADGE_SCHEMA = [
  'bytes32 subjectKey',
  'uint256 repositoryId',
  'string repositoryUrl',
  'string commitOid',
  'bytes32 reportHash',
  'uint16 score',
  'uint8 badgeLevel',
  'bytes32 policyHash',
  'string rulesetVersion',
].join(',')

// 위 스키마 + zero resolver + revocable=true의 결정적 UID. 등록 스크립트와 서버가 같은
// 데이터 계약을 사용하도록 설정값도 이 UID와 일치해야 한다.
export const EAS_BADGE_SCHEMA_UID = '0x30f3de9886990bb89c624a980df6e4715b2f3e24be7912f04f0b8446a80f2ca8'

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
export const ZERO_BYTES32 = `0x${'0'.repeat(64)}`
