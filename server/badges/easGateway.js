import {
  AbiCoder,
  Signature,
  Wallet,
  getAddress,
  hexlify,
  isHexString,
  randomBytes,
  solidityPackedKeccak256,
  toUtf8Bytes,
  verifyTypedData,
} from 'ethers'

import {
  EAS_BADGE_PAYLOAD_KIND,
  EAS_BADGE_PAYLOAD_VERSION,
  EAS_OFFCHAIN_DOMAIN_NAME,
  EAS_OFFCHAIN_DOMAIN_VERSION,
  EAS_OFFCHAIN_VERSION,
  ZERO_ADDRESS,
  ZERO_BYTES32,
} from './constants.js'
import { BadgeError } from './errors.js'

export const EAS_OFFCHAIN_TYPES = Object.freeze({
  Attest: Object.freeze([
    Object.freeze({ name: 'version', type: 'uint16' }),
    Object.freeze({ name: 'schema', type: 'bytes32' }),
    Object.freeze({ name: 'recipient', type: 'address' }),
    Object.freeze({ name: 'time', type: 'uint64' }),
    Object.freeze({ name: 'expirationTime', type: 'uint64' }),
    Object.freeze({ name: 'revocable', type: 'bool' }),
    Object.freeze({ name: 'refUID', type: 'bytes32' }),
    Object.freeze({ name: 'data', type: 'bytes' }),
    Object.freeze({ name: 'salt', type: 'bytes32' }),
  ]),
})

const abiCoder = AbiCoder.defaultAbiCoder()
const REQUIRED_PAYLOAD_KEYS = [
  'kind', 'version', 'subjectKey', 'repositoryId', 'repositoryUrl', 'commitOid',
  'reportHash', 'score', 'badgeLevel', 'policyHash', 'policyVersion', 'rulesetVersion',
]

export function computeSchemaUid(schema) {
  return solidityPackedKeccak256(['string', 'address', 'bool'], [schema, ZERO_ADDRESS, true])
}

function canonicalBadgePayload(input) {
  return {
    kind: EAS_BADGE_PAYLOAD_KIND,
    version: EAS_BADGE_PAYLOAD_VERSION,
    subjectKey: input.subjectKey,
    repositoryId: String(input.repositoryId),
    repositoryUrl: input.repositoryUrl,
    commitOid: input.commitSha,
    reportHash: input.reportHash,
    score: Number(input.score),
    badgeLevel: Number(input.badgeLevelCode),
    policyHash: input.policyHash,
    policyVersion: input.policyVersion,
    rulesetVersion: input.rulesetVersion,
  }
}

export function encodeBadgeData(input) {
  return abiCoder.encode(['string'], [JSON.stringify(canonicalBadgePayload(input))])
}

export function decodeBadgeData(data) {
  const [statement] = abiCoder.decode(['string'], data)
  const parsed = JSON.parse(statement)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Invalid EduSafe badge statement.')
  }
  if (
    Object.keys(parsed).length !== REQUIRED_PAYLOAD_KEYS.length
    || REQUIRED_PAYLOAD_KEYS.some((key) => !(key in parsed))
    || parsed.kind !== EAS_BADGE_PAYLOAD_KIND
    || parsed.version !== EAS_BADGE_PAYLOAD_VERSION
  ) throw new Error('Unsupported EduSafe badge statement.')
  return parsed
}

export function makeOffchainDomain(config) {
  return Object.freeze({
    name: EAS_OFFCHAIN_DOMAIN_NAME,
    version: EAS_OFFCHAIN_DOMAIN_VERSION,
    chainId: config.chainId,
    verifyingContract: config.easAddress,
  })
}

// EAS SDK Offchain.getOffchainUID(Version2)와 바이트 단위로 같은 계산식이다.
export function computeOffchainUid(message) {
  return solidityPackedKeccak256(
    [
      'uint16', 'bytes', 'address', 'address', 'uint64', 'uint64', 'bool',
      'bytes32', 'bytes', 'bytes32', 'uint32',
    ],
    [
      Number(message.version),
      hexlify(toUtf8Bytes(message.schema)),
      message.recipient,
      ZERO_ADDRESS,
      BigInt(message.time),
      BigInt(message.expirationTime),
      Boolean(message.revocable),
      message.refUID,
      message.data,
      message.salt,
      0,
    ],
  )
}

function messageFromRecord(record) {
  return {
    version: Number(record.easVersion),
    schema: record.schemaUid,
    recipient: ZERO_ADDRESS,
    time: BigInt(record.signedAt),
    expirationTime: BigInt(record.expirationTime),
    revocable: true,
    refUID: ZERO_BYTES32,
    data: record.encodedData,
    salt: record.salt,
  }
}

function serializeMessage(message) {
  return {
    ...message,
    version: Number(message.version),
    time: String(message.time),
    expirationTime: String(message.expirationTime),
  }
}

export function makeOffchainProof(record) {
  const signature = Signature.from(record.signature)
  return {
    scheme: 'eas-offchain-v2',
    version: Number(record.easVersion),
    uid: record.uid,
    domain: {
      name: EAS_OFFCHAIN_DOMAIN_NAME,
      version: record.domainVersion,
      chainId: String(record.chainId),
      verifyingContract: record.easAddress,
    },
    primaryType: 'Attest',
    types: EAS_OFFCHAIN_TYPES,
    message: serializeMessage(messageFromRecord(record)),
    signature: { v: signature.v, r: signature.r, s: signature.s },
    rawSignature: record.signature,
    attester: record.attesterAddress,
  }
}

export function createEasGateway(config, { randomBytesImpl = randomBytes } = {}) {
  const domain = makeOffchainDomain(config)
  let signer

  const getSigner = () => {
    if (!config.privateKey) {
      throw new BadgeError(503, 'badge_issuer_disabled', '가스리스 인증 서명 기능이 설정되지 않았습니다.')
    }
    signer ||= new Wallet(config.privateKey)
    if (getAddress(signer.address) !== getAddress(config.attesterAddress)) {
      throw new BadgeError(503, 'wrong_attester_key', '발급 개인키와 공개 발급자 주소가 일치하지 않습니다.')
    }
    return signer
  }

  return {
    async issue(input) {
      const wallet = getSigner()
      const message = {
        version: EAS_OFFCHAIN_VERSION,
        schema: config.schemaUid,
        recipient: ZERO_ADDRESS,
        time: BigInt(input.signedAt),
        expirationTime: BigInt(input.expirationTime || 0),
        revocable: true,
        refUID: ZERO_BYTES32,
        data: encodeBadgeData(input),
        salt: hexlify(randomBytesImpl(32)),
      }
      const signature = await wallet.signTypedData(domain, EAS_OFFCHAIN_TYPES, message)
      return {
        uid: computeOffchainUid(message),
        signature: signature.toLowerCase(),
        salt: message.salt.toLowerCase(),
        encodedData: message.data.toLowerCase(),
        signedAt: String(message.time),
        expirationTime: String(message.expirationTime),
        easVersion: EAS_OFFCHAIN_VERSION,
        domainVersion: EAS_OFFCHAIN_DOMAIN_VERSION,
      }
    },

    verify(record, now = Date.now()) {
      let data = null
      let recoveredAttester = null
      let uidMatches = false
      let signatureValid = false
      let trustedDomain = false
      let trustedAttester = false
      try {
        const message = messageFromRecord(record)
        uidMatches = isHexString(record.uid, 32)
          && computeOffchainUid(message).toLowerCase() === record.uid.toLowerCase()
        const recordDomain = {
          name: EAS_OFFCHAIN_DOMAIN_NAME,
          version: record.domainVersion,
          chainId: BigInt(record.chainId),
          verifyingContract: record.easAddress,
        }
        recoveredAttester = verifyTypedData(recordDomain, EAS_OFFCHAIN_TYPES, message, record.signature)
        signatureValid = getAddress(recoveredAttester) === getAddress(record.attesterAddress)
        trustedDomain = (
          record.domainVersion === EAS_OFFCHAIN_DOMAIN_VERSION
          && BigInt(record.chainId) === config.chainId
          && getAddress(record.easAddress) === getAddress(config.easAddress)
          && record.schemaUid.toLowerCase() === config.schemaUid.toLowerCase()
          && Number(record.easVersion) === EAS_OFFCHAIN_VERSION
        )
        trustedAttester = config.trustedAttesterAddresses
          .some((address) => getAddress(address) === getAddress(recoveredAttester))
        data = decodeBadgeData(record.encodedData)
      } catch {
        // 저장된 proof가 손상되거나 형식이 다르면 예외 대신 invalid로 닫는다.
      }
      const expirationTime = BigInt(record.expirationTime || 0)
      const expired = expirationTime !== 0n && expirationTime <= BigInt(Math.floor(now / 1000))
      return {
        active: uidMatches && signatureValid && trustedDomain && trustedAttester && !expired,
        uidMatches,
        signatureValid,
        trustedDomain,
        trustedAttester,
        recoveredAttester,
        expired,
        data,
        proof: makeOffchainProof(record),
      }
    },
  }
}
