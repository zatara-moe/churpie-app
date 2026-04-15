// lib/watch-token.js
import { SignJWT, jwtVerify } from 'jose'

const secret = () => new TextEncoder().encode(process.env.WATCH_SECRET)

export async function signWatchToken(cardId) {
  return new SignJWT({ cardId, type: 'watch' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('90d')
    .sign(secret())
}

export async function verifyWatchToken(token) {
  try {
    const { payload } = await jwtVerify(token, secret())
    return payload
  } catch {
    return null
  }
}
