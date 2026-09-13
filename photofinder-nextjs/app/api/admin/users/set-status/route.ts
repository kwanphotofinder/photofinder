import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const caller = await getUserFromRequest(req);
    if (!caller || !["ADMIN", "SUPER_ADMIN"].includes(caller.role)) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
    }

    const { userId, isActive } = await req.json();

    if (!userId || typeof isActive !== "boolean") {
      return NextResponse.json({ error: "userId and isActive are required" }, { status: 400 });
    }

    // Check target user
    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (caller.role === "ADMIN" && ["ADMIN", "SUPER_ADMIN"].includes(targetUser.role)) {
      return NextResponse.json({ error: "Admins cannot modify other Admins or Super Admins" }, { status: 403 });
    }

    // Don't allow anyone to deactivate themselves
    if (caller.sub === userId) {
      return NextResponse.json({ error: "Cannot deactivate yourself" }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { isActive },
    });

    const { recordAuditLog } = await import("@/lib/audit-logger");
    await recordAuditLog({
      actorId: caller.sub,
      actorEmail: caller.email || "unknown_admin",
      actorRole: caller.role,
      action: isActive ? "UNBLOCK_USER" : "BLOCK_USER",
      category: "USER_MGMT",
      targetType: "USER",
      targetId: user.id,
      targetLabel: user.email,
      details: isActive ? `Unblocked user account access for ${user.email}.` : `Blocked user account access for ${user.email}.`,
      ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null,
    });

    return NextResponse.json({ 
      success: true, 
      user: {
        id: user.id,
        email: user.email,
        isActive: user.isActive
      }
    });
  } catch (error) {
    console.error("Error setting user status:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
