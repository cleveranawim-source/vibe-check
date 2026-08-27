import { parseBadgeConfig } from '../server/badges/config.js'
import { getBadgePool } from '../server/badges/database.js'
import { createEasGateway } from '../server/badges/easGateway.js'
import { handleBadgeHttp } from '../server/badges/http.js'
import { PostgresBadgeRepository } from '../server/badges/repository.js'
import { BadgeService } from '../server/badges/service.js'

let readDependencies
let issuerDependencies

function getDependencies(requireIssuer) {
  if (requireIssuer && issuerDependencies) return issuerDependencies
  if (!requireIssuer && readDependencies) return readDependencies
  const config = parseBadgeConfig(process.env, { requireIssuer })
  const repository = new PostgresBadgeRepository(getBadgePool(config.databaseUrl))
  const easGateway = createEasGateway(config)
  const dependencies = {
    config,
    service: new BadgeService({
      repository,
      easGateway,
      attesterAddress: config.attesterAddress,
      chainId: config.chainId,
      easAddress: config.easAddress,
      schemaUid: config.schemaUid,
    }),
  }
  if (requireIssuer) issuerDependencies = dependencies
  else readDependencies = dependencies
  return dependencies
}

export default {
  async fetch(request) {
    try {
      const requireIssuer = request.method === 'POST' || request.method === 'OPTIONS'
      return await handleBadgeHttp(request, getDependencies(requireIssuer))
    } catch {
      return Response.json(
        { error: { code: 'badge_server_misconfigured', message: '블록체인 인증 서버 설정을 확인해 주세요.' } },
        { status: 503, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } },
      )
    }
  },
}
