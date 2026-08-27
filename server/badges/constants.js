export const BASE_SEPOLIA_CHAIN_ID = 84532n
export const BASE_SEPOLIA_EAS_ADDRESS = '0x4200000000000000000000000000000000000021'
export const EAS_OFFCHAIN_DOMAIN_NAME = 'EAS Attestation'
export const EAS_OFFCHAIN_DOMAIN_VERSION = '1.2.0'
export const EAS_OFFCHAIN_VERSION = 2

// Base Sepolia에 이미 등록된 EAS "Make a Statement" 스키마를 재사용한다. EduSafe의
// canonical JSON payload는 ABI string으로 감싼다. 신규 schema 등록 트랜잭션은 필요 없다.
export const EAS_BADGE_SCHEMA = 'string statement'
export const EAS_BADGE_SCHEMA_UID = '0xf58b8b212ef75ee8cd7e8d803c37c03e0519890502d5e99ee2412aae1456cafe'
export const EAS_BADGE_PAYLOAD_KIND = 'edusafe.repository-security-badge'
export const EAS_BADGE_PAYLOAD_VERSION = 1

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
export const ZERO_BYTES32 = `0x${'0'.repeat(64)}`
