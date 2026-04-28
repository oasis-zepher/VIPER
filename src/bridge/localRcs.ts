import { randomBytes } from 'crypto'
import { createServer } from 'net'
import { networkInterfaces } from 'os'

export const LOCAL_RCS_ENV = 'VIPER_LOCAL_RCS'

export type LocalRcsConfig = {
  host: string
  port: number
  lanHost: string
  baseUrl: string
  apiKey: string
  pairingToken: string
  pairingUrl: string
}

export function isLocalRcsMode(): boolean {
  return process.env[LOCAL_RCS_ENV] === '1'
}

export function generateLocalRcsApiKey(): string {
  return `viper-rcs_${randomBytes(32).toString('base64url')}`
}

export function generateLocalRcsPairingToken(): string {
  return `pair_${randomBytes(24).toString('base64url')}`
}

export function getLocalLanHost(): string {
  const candidates: string[] = []
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family !== 'IPv4' || entry.internal) {
        continue
      }
      candidates.push(entry.address)
    }
  }

  return candidates.find(isPrivateIpv4Address) ?? candidates[0] ?? '127.0.0.1'
}

export async function findAvailablePort(
  startPort = 3000,
  host = '0.0.0.0',
  maxAttempts = 100,
): Promise<number> {
  for (let offset = 0; offset < maxAttempts; offset++) {
    const port = startPort + offset
    if (await canListen(port, host)) {
      return port
    }
  }
  throw new Error(
    `No available local RCS port found from ${startPort} to ${
      startPort + maxAttempts - 1
    }`,
  )
}

export async function createLocalRcsConfig(
  startPort = 3000,
): Promise<LocalRcsConfig> {
  const host = '0.0.0.0'
  const port = await findAvailablePort(startPort, host)
  const lanHost = getLocalLanHost()
  const baseUrl = `http://${lanHost}:${port}`
  const pairingToken = generateLocalRcsPairingToken()
  return {
    host,
    port,
    lanHost,
    baseUrl,
    apiKey: generateLocalRcsApiKey(),
    pairingToken,
    pairingUrl: `${baseUrl}/code?pair=${encodeURIComponent(pairingToken)}`,
  }
}

export function isHttpBridgeBaseUrlAllowed(baseUrl: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(baseUrl)
  } catch {
    return false
  }

  if (parsed.protocol !== 'http:') {
    return true
  }

  const host = parsed.hostname.toLowerCase()
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
    return true
  }

  return isLocalRcsMode() && isPrivateIpv4Address(host)
}

export function getHttpBridgeBaseUrlError(baseUrl: string): string | null {
  if (isHttpBridgeBaseUrlAllowed(baseUrl)) {
    return null
  }

  if (isLocalRcsMode()) {
    return 'Remote Control local RCS mode only allows HTTP on localhost or private LAN IPv4 addresses.'
  }

  return 'Remote Control base URL uses HTTP. Only HTTPS or localhost HTTP is allowed.'
}

function isPrivateIpv4Address(host: string): boolean {
  const parts = host.split('.').map(part => Number(part))
  if (
    parts.length !== 4 ||
    parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false
  }

  const [a, b] = parts as [number, number, number, number]
  return (
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)
  )
}

function canListen(port: number, host: string): Promise<boolean> {
  return new Promise(resolve => {
    const server = createServer()
    server.once('error', () => resolve(false))
    server.once('listening', () => {
      server.close(() => resolve(true))
    })
    server.listen(port, host)
  })
}
