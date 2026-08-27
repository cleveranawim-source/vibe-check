import { Contract, JsonRpcProvider, Wallet } from 'ethers'

import {
  BASE_SEPOLIA_CHAIN_ID,
  BASE_SEPOLIA_EAS_ADDRESS,
  BASE_SEPOLIA_SCHEMA_REGISTRY_ADDRESS,
  EAS_BADGE_SCHEMA,
  EAS_BADGE_SCHEMA_UID,
  ZERO_ADDRESS,
  ZERO_BYTES32,
} from '../server/badges/constants.js'
import { computeSchemaUid } from '../server/badges/easGateway.js'

const REGISTRY_ABI = [
  'function register(string schema,address resolver,bool revocable) returns (bytes32)',
  'function getSchema(bytes32 uid) view returns ((bytes32 uid,address resolver,bool revocable,string schema))',
]
const EAS_VERSION_ABI = ['function version() view returns (string)']

const rpcUrl = process.env.EAS_RPC_URL
const privateKey = process.env.EAS_ATTESTER_PRIVATE_KEY
if (!rpcUrl || !privateKey) throw new Error('EAS_RPC_URL and EAS_ATTESTER_PRIVATE_KEY are required.')

const provider = new JsonRpcProvider(rpcUrl)
const network = await provider.getNetwork()
if (network.chainId !== BASE_SEPOLIA_CHAIN_ID) throw new Error('EAS_RPC_URL must point to Base Sepolia (84532).')
const signer = new Wallet(privateKey, provider)
const registry = new Contract(BASE_SEPOLIA_SCHEMA_REGISTRY_ADDRESS, REGISTRY_ABI, signer)
const expectedUid = computeSchemaUid()
if (expectedUid !== EAS_BADGE_SCHEMA_UID) throw new Error('Badge schema UID constant is out of sync.')
const existing = await registry.getSchema(expectedUid)

if (existing.uid !== ZERO_BYTES32) {
  console.log(JSON.stringify({ status: 'already_registered', schemaUid: expectedUid }, null, 2))
  process.exit(0)
}

await registry.register.estimateGas(EAS_BADGE_SCHEMA, ZERO_ADDRESS, true)
const transaction = await registry.register(EAS_BADGE_SCHEMA, ZERO_ADDRESS, true)
const receipt = await transaction.wait(1)
if (!receipt) throw new Error('Schema registration receipt is missing.')
const stored = await registry.getSchema(expectedUid)
if (stored.uid !== expectedUid) throw new Error('Registered schema UID differs from the deterministic UID.')

const eas = new Contract(BASE_SEPOLIA_EAS_ADDRESS, EAS_VERSION_ABI, provider)
console.log(JSON.stringify({
  status: 'registered',
  schemaUid: expectedUid,
  transactionHash: receipt.hash,
  easVersion: await eas.version(),
}, null, 2))
