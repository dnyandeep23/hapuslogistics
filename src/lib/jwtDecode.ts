export type JwtPayload = Record<string, any> | null

export function decodeJwt(token?: string | null): JwtPayload {
    if (!token) return null
    try {
        const parts = token.split('.')
        if (parts.length < 2) return null
        const payload = parts[1]
        const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
        const json = Buffer.from(base64, 'base64').toString('utf8')
        return JSON.parse(json)
    } catch (e) {
        return null
    }
}
