import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"
import prisma from "@/lib/prisma"
import jwt from "jsonwebtoken"

// POST /api/auth/oidc/exchange
// This handles the OIDC code exchange flow (for university SSO if needed).
// Currently the app uses Google One-Tap which does NOT use this endpoint.
// For now, this is implemented as a passthrough that verifies our own JWT
// in case some part of the app redirects here after Google login.
export async function POST(request: NextRequest) {
  try {
    const { code, state } = await request.json()

    if (!code) {
      return NextResponse.json({ error: "Missing authorization code" }, { status: 400 })
    }

    // Try to decode it as one of our own JWTs (in case frontend routes through here)
    try {
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('JWT_SECRET is not defined in environment variables');
      }
      const decoded = jwt.verify(code, jwtSecret) as any

      const user = await prisma.user.findUnique({ where: { id: decoded.sub } })
      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 })
      }

      if (!user.isActive) {
        return NextResponse.json({ error: "Your account has been deactivated." }, { status: 403 })
      }

      return NextResponse.json({
        token: code,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role.toLowerCase(),
        },
        expiresIn: 604800, // 7 days
      })
    } catch {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 })
    }

  } catch (error) {
    console.error("POST /api/auth/oidc/exchange error:", error)
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 })
  }
}
