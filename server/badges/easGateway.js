import {
  AbiCoder,
  Contract,
  JsonRpcProvider,
  Wallet,
  getAddress,
  isHexString,
  solidityPackedKeccak256,
} from 'ethers'

import {
  BASE_SEPOLIA_CHAIN_ID,
  EAS_BADGE_SCHEMA,
  ZERO_ADDRESS,
  ZERO_BYTES32,
} from './constants.js'
import { BadgeError } from './errors.js'

const EAS_ABI = [
  'function attest((bytes32 schema,(address recipient,uint64 expirationTime,bool revocable,bytes32 refUID,bytes data,uint256 value) data) request) payable returns (bytes32)',
  'function getAttestation(bytes32 uid) view returns ((bytes32 uid,bytes32 schema,uint64 time,uint64 expirationTime,uint64 revocationTime,bytes32 refUID,address recipient,address attester,bool revocable,bytes data))',
  'function version() view returns (string)',
  'event Attested(address indexed recipient,address indexed attester,bytes32 uid,bytes32 indexed schemaUID)',
]

const SCHEMA_TYPES = [
  'bytes32', 'uint256', 'string', 'string', 'bytes32', 'uint16',
  'uint8', 'bytes32', 'string',
]
const SCHEMA_NAMES = EAS_BADGE_SCHEMA.split(',').map((field) => field.trim().split(/\s+/).at(-1))
const abiCoder = AbiCoder.defaultAbiCoder()

export function computeSchemaUid(schema = EAS_BADGE_SCHEMA) {
  return solidityPackedKeccak256(['string', 'address', 'bool'], [schema, ZERO_ADDRESS, true])
}

export function encodeBadgeData(input) {
  return abiCoder.encode(SCHEMA_TYPES, [
    input.subjectKey,
    BigInt(input.repositoryId),
    input.repositoryUrl,
    input.commitSha,
    input.reportHash,
    input.score,
    input.badgeLevelCode,
    input.policyHash,
    input.rulesetVersion,
  ])
}

export function decodeBadgeData(data) {
  const decoded = abiCoder.decode(SCHEMA_TYPES, data)
  return Object.fromEntries(SCHEMA_NAMES.map((name, index) => {
    const value = decoded[index]
    if (name === 'repositoryId' && typeof value === 'bigint') return [name, value.toString()]
    return [name, typeof value === 'bigint' ? Number(value) : value]
  }))
}

function uidFromReceipt(contract, receipt, { easAddress, schemaUid, attesterAddress }) {
  for (const log of receipt.logs) {
    try {
      if (getAddress(log.address) !== getAddress(easAddress)) continue
      const parsed = contract.interface.parseLog(log)
      if (
        parsed?.name === 'Attested'
        && parsed.args.schemaUID.toLowerCase() === schemaUid.toLowerCase()
        && getAddress(parsed.args.attester) === getAddress(attesterAddress)
        && getAddress(parsed.args.recipient) === ZERO_ADDRESS
      ) return parsed.args.uid
    } catch {
      // 다른 컨트랙트의 로그는 무시한다.
    }
  }
  return null
}

export function createEasGateway(config) {
  const provider = new JsonRpcProvider(config.rpcUrl)
  const easReader = new Contract(config.easAddress, EAS_ABI, provider)
  let networkPromise
  let writer

  const assertNetwork = async () => {
    networkPromise ||= provider.getNetwork()
    const network = await networkPromise
    if (network.chainId !== BASE_SEPOLIA_CHAIN_ID || network.chainId !== config.chainId) {
      throw new BadgeError(503, 'wrong_eas_network', 'EAS RPC가 Base Sepolia 네트워크가 아닙니다.')
    }
  }

  const getWriter = async () => {
    if (!config.privateKey) {
      throw new BadgeError(503, 'badge_issuer_disabled', '블록체인 인증 발급 기능이 설정되지 않았습니다.')
    }
    await assertNetwork()
    const signer = new Wallet(config.privateKey, provider)
    if (getAddress(signer.address) !== getAddress(config.attesterAddress)) {
      throw new BadgeError(503, 'wrong_attester_key', '발급 개인키와 공개 발급자 주소가 일치하지 않습니다.')
    }
    writer ||= new Contract(config.easAddress, EAS_ABI, signer)
    return writer
  }

  return {
    async issue(input, { onBroadcast } = {}) {
      const easWriter = await getWriter()
      const request = {
        schema: config.schemaUid,
        data: {
          recipient: ZERO_ADDRESS,
          expirationTime: input.expiresAt
            ? BigInt(Math.floor(new Date(input.expiresAt).getTime() / 1000))
            : 0n,
          revocable: true,
          refUID: ZERO_BYTES32,
          data: encodeBadgeData(input),
          value: 0n,
        },
      }
      await easWriter.attest.estimateGas(request)
      const response = await easWriter.attest(request)
      await onBroadcast?.(response.hash)
      let receipt
      try {
        receipt = await response.wait(config.confirmations)
      } catch (error) {
        if (error?.code === 'TRANSACTION_REPLACED' && !error.cancelled && error.receipt) {
          receipt = error.receipt
        } else {
          throw error
        }
      }
      if (!receipt) throw new BadgeError(502, 'eas_receipt_missing', 'EAS 트랜잭션 영수증을 확인하지 못했습니다.')
      const uid = uidFromReceipt(easWriter, receipt, config)
      if (!isHexString(uid, 32)) throw new BadgeError(502, 'eas_uid_missing', 'EAS 인증 UID를 확인하지 못했습니다.')
      const stored = await easReader.getAttestation(uid)
      if (
        stored.schema.toLowerCase() !== config.schemaUid.toLowerCase()
        || getAddress(stored.attester) !== getAddress(config.attesterAddress)
        || stored.data.toLowerCase() !== request.data.data.toLowerCase()
      ) throw new BadgeError(502, 'eas_attestation_mismatch', '발급된 EAS 데이터가 요청한 인증 snapshot과 다릅니다.')
      return { uid, txHash: receipt.hash }
    },

    async reconcile(txHash) {
      await assertNetwork()
      if (!isHexString(txHash, 32)) throw new BadgeError(422, 'invalid_transaction_hash', '트랜잭션 해시 형식이 올바르지 않습니다.')
      const receipt = await provider.getTransactionReceipt(txHash)
      if (!receipt) return { status: 'pending', txHash }
      if (receipt.status !== 1) return { status: 'failed', txHash: receipt.hash }
      const uid = uidFromReceipt(easReader, receipt, config)
      if (!isHexString(uid, 32)) return { status: 'invalid_receipt', txHash: receipt.hash }
      return { status: 'confirmed', uid, txHash: receipt.hash }
    },

    async verify(uid, now = Date.now(), expected = {}) {
      await assertNetwork()
      if (!isHexString(uid, 32)) throw new BadgeError(422, 'invalid_attestation_uid', '인증 UID 형식이 올바르지 않습니다.')
      const attestation = await easReader.getAttestation(uid)
      if (attestation.uid === ZERO_BYTES32) throw new BadgeError(404, 'attestation_not_found', '온체인 인증을 찾을 수 없습니다.')
      const trustedSchema = attestation.schema.toLowerCase() === (expected.schemaUid || config.schemaUid).toLowerCase()
      const trustedAttester = getAddress(attestation.attester) === getAddress(expected.attesterAddress || config.attesterAddress)
      const revoked = attestation.revocationTime !== 0n
      const expired = attestation.expirationTime !== 0n && attestation.expirationTime <= BigInt(Math.floor(now / 1000))
      return {
        uid: attestation.uid,
        schema: attestation.schema,
        attester: attestation.attester,
        issuedAt: new Date(Number(attestation.time) * 1000).toISOString(),
        expiresAt: attestation.expirationTime === 0n ? null : new Date(Number(attestation.expirationTime) * 1000).toISOString(),
        revoked,
        expired,
        trustedSchema,
        trustedAttester,
        active: trustedSchema && trustedAttester && !revoked && !expired,
        data: decodeBadgeData(attestation.data),
      }
    },
  }
}

export { EAS_ABI, SCHEMA_TYPES, uidFromReceipt }
