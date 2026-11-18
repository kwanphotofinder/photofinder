import prisma from "@/lib/prisma"
import { recordAuditLog } from "@/lib/audit-logger"

export interface SystemSettingDef {
  key: string
  nameTh: string
  nameEn: string
  descriptionTh: string
  descriptionEn: string
  category: "business" | "features"
  type: "number" | "boolean"
  defaultValue: number
  min?: number
  max?: number
  step?: number
  unitTh?: string
  unitEn?: string
  isDangerous?: boolean
}

export const SYSTEM_SETTING_DEFINITIONS: Record<string, SystemSettingDef> = {
  // Business Logic
  biometric_match_confidence: {
    key: "biometric_match_confidence",
    nameTh: "เกณฑ์ความแม่นยำในการจับคู่ใบหน้า",
    nameEn: "Biometric Match Confidence",
    descriptionTh: "ระดับคะแนนความมั่นใจขั้นต่ำในการค้นหาและจับคู่ใบหน้านักศึกษา ค่ายิ่งสูงระบบจะยิ่งเข้มงวดและแม่นยำขึ้น",
    descriptionEn: "Minimum confidence score required for facial recognition matching. Higher values yield stricter, more accurate matches.",
    category: "business",
    type: "number",
    defaultValue: 0.50,
    min: 10,
    max: 99,
    step: 1,
    unitTh: "%",
    unitEn: "%",
  },
  max_upload_size_mb: {
    key: "max_upload_size_mb",
    nameTh: "ขนาดไฟล์รูปภาพสูงสุดต่อรูป",
    nameEn: "Max Photo Upload Size",
    descriptionTh: "จำกัดขนาดไฟล์ภาพถ่ายต่อรูปที่ช่างภาพสามารถอัปโหลดเข้าสู่ระบบ",
    descriptionEn: "Maximum photo file size allowed per image during photographer uploads.",
    category: "business",
    type: "number",
    defaultValue: 25,
    min: 5,
    max: 100,
    step: 1,
    unitTh: "MB",
    unitEn: "MB",
  },
  max_photos_per_event: {
    key: "max_photos_per_event",
    nameTh: "โควต้ารูปภาพสูงสุดต่องานกิจกรรม",
    nameEn: "Max Photos Per Event",
    descriptionTh: "จำกัดจำนวนภาพถ่ายสูงสุดที่สามารถอัปโหลดได้ใน 1 กิจกรรม เพื่อควบคุมพื้นที่จัดเก็บและทรัพยากร",
    descriptionEn: "Maximum number of photos allowed in a single event to regulate storage and compute resources.",
    category: "business",
    type: "number",
    defaultValue: 1000,
    min: 50,
    max: 5000,
    step: 50,
    unitTh: "รูป",
    unitEn: "Photos",
  },
  max_faces_per_photo: {
    key: "max_faces_per_photo",
    nameTh: "จำกัดจำนวนใบหน้าตรวจจับต่อภาพถ่าย",
    nameEn: "Max Detected Faces Per Photo",
    descriptionTh: "จำนวนใบหน้าสูงสุดที่จะตรวจจับและนำไปสกัดเวกเตอร์ต่อ 1 รูปภาพ เพื่อป้องกันระบบ AI รับภาระประมวลผลเกินขนาด",
    descriptionEn: "Maximum detected faces extracted into vector embeddings per photo to prevent AI service overload.",
    category: "business",
    type: "number",
    defaultValue: 20,
    min: 1,
    max: 50,
    step: 1,
    unitTh: "ใบหน้า",
    unitEn: "Faces",
  },
  ai_timeout_seconds: {
    key: "ai_timeout_seconds",
    nameTh: "ระยะเวลารอการประมวลผลของ AI",
    nameEn: "AI Service Timeout",
    descriptionTh: "ระยะเวลาสูงสุดในการรอรับผลลัพธ์เวกเตอร์ใบหน้าจาก AI Service ก่อนจะตัดเป็นข้อผิดพลาด",
    descriptionEn: "Maximum timeout duration when waiting for facial embeddings from the AI microservice before failing.",
    category: "business",
    type: "number",
    defaultValue: 30,
    min: 5,
    max: 120,
    step: 5,
    unitTh: "วินาที",
    unitEn: "Seconds",
  },

  // Feature Switches / Kill Switches
  maintenance_mode: {
    key: "maintenance_mode",
    nameTh: "โหมดปิดปรับปรุงระบบชั่วคราว",
    nameEn: "Maintenance Mode",
    descriptionTh: "ระงับการเข้าถึงของนักศึกษาและช่างภาพชั่วคราว พร้อมแสดงหน้าแจ้งเตือน (ผู้ดูแลระบบยังเข้าใช้งานได้ตามปกติ)",
    descriptionEn: "Restrict general user access while displaying a maintenance notice. Administrators retain full access.",
    category: "features",
    type: "boolean",
    defaultValue: 0,
    isDangerous: true,
  },
  enable_ai_face_search: {
    key: "enable_ai_face_search",
    nameTh: "ระบบตรวจจับและค้นหาใบหน้าด้วย AI",
    nameEn: "AI Facial Search Engine",
    descriptionTh: "สวิตช์หลักสำหรับเปิดหรือปิดระบบค้นหาภาพด้วย AI ทั่วทั้งระบบ กรณีบริการ AI มีปัญหาหรือคิวเต็ม",
    descriptionEn: "Master kill-switch for facial detection and matching capabilities across the entire application.",
    category: "features",
    type: "boolean",
    defaultValue: 1,
  },
  allow_public_registration: {
    key: "allow_public_registration",
    nameTh: "เปิดรับการลงทะเบียนผู้ใช้งานใหม่",
    nameEn: "New User Registration",
    descriptionTh: "อนุญาตให้นักศึกษาใหม่ที่ยังไม่มีบัญชีในระบบสามารถเข้าสู่ระบบผ่าน Google OAuth ได้",
    descriptionEn: "Allow new users without existing accounts to register and sign in via Google OAuth.",
    category: "features",
    type: "boolean",
    defaultValue: 1,
  },
  enable_email_notifications: {
    key: "enable_email_notifications",
    nameTh: "ระบบส่งอีเมลแจ้งเตือนอัตโนมัติ",
    nameEn: "Automated Email Notifications",
    descriptionTh: "ส่งอีเมลแจ้งเตือนสรุปภาพถ่ายไปยังนักศึกษาโดยอัตโนมัติเมื่อตรวจพบรูปภาพใหม่ที่ตรงกับใบหน้า",
    descriptionEn: "Dispatch automated summary emails to students whenever new matching photos are discovered.",
    category: "features",
    type: "boolean",
    defaultValue: 1,
  },
  enable_original_download: {
    key: "enable_original_download",
    nameTh: "อนุญาตดาวน์โหลดไฟล์ภาพต้นฉบับความละเอียดสูง",
    nameEn: "Full-Resolution Photo Downloads",
    descriptionTh: "เปิดให้นักศึกษาสามารถดาวน์โหลดไฟล์ภาพถ่ายขนาดต้นฉบับที่มีความละเอียดสูงสุดได้",
    descriptionEn: "Allow students to download original, uncompressed high-resolution photos directly.",
    category: "features",
    type: "boolean",
    defaultValue: 1,
  },
}

// ==============================================================================
// 2. EXTERNAL SERVICE SECRETS & INTEGRATIONS (API Keys)
// ==============================================================================

export interface SystemSecretDef {
  key: string
  nameTh: string
  nameEn: string
  serviceTh: string
  serviceEn: string
  descriptionTh: string
  descriptionEn: string
  docsUrl?: string
  placeholder: string
  isPassword?: boolean
}

export const SYSTEM_SECRET_DEFINITIONS: Record<string, SystemSecretDef> = {
  GROQ_API_KEY: {
    key: "GROQ_API_KEY",
    nameTh: "คีย์เชื่อมต่อ Groq Cloud สำหรับผู้ช่วย AI",
    nameEn: "Groq Cloud API Key",
    serviceTh: "Groq Cloud (โมเดล LLM)",
    serviceEn: "Groq Cloud (LLM)",
    descriptionTh: "คีย์ API สำหรับเชื่อมต่อโมเดลภาษาขนาดใหญ่ที่ขับเคลื่อนระบบแชทบอทตอบคำถามนักศึกษา",
    descriptionEn: "API Key for Groq LLaMA models powering the interactive student assistant chatbot.",
    docsUrl: "https://console.groq.com/keys",
    placeholder: "gsk_••••••••••••••••••••••••••••••••",
    isPassword: true,
  },
  LINE_CHANNEL_ACCESS_TOKEN: {
    key: "LINE_CHANNEL_ACCESS_TOKEN",
    nameTh: "โทเค็นการส่งข้อความ LINE (Channel Access Token)",
    nameEn: "LINE Messaging Channel Access Token",
    serviceTh: "LINE Messaging API",
    serviceEn: "LINE Messaging API",
    descriptionTh: "โทเค็นระยะยาวสำหรับส่งข้อความ Flex Message แจ้งเตือนนักศึกษาผ่าน LINE Official Account เมื่อพบรูปถ่ายใหม่",
    descriptionEn: "Long-lived channel access token for delivering real-time Flex Message photo alerts via LINE OA.",
    docsUrl: "https://developers.line.biz/",
    placeholder: "••••••••••••••••••••••••••••••••••••••••",
    isPassword: true,
  },
  LINE_CHANNEL_SECRET: {
    key: "LINE_CHANNEL_SECRET",
    nameTh: "รหัสลับ LINE Channel Secret",
    nameEn: "LINE Channel Secret",
    serviceTh: "LINE Messaging API",
    serviceEn: "LINE Messaging API",
    descriptionTh: "รหัสลับประจำ Channel สำหรับตรวจสอบความถูกต้องของลายเซ็น Webhook และความปลอดภัยของระบบ",
    descriptionEn: "Channel Secret used to verify incoming webhook signatures and secure the bot interface.",
    docsUrl: "https://developers.line.biz/",
    placeholder: "••••••••••••••••••••••••••••••••",
    isPassword: true,
  },
  LINE_CHANNEL_ID: {
    key: "LINE_CHANNEL_ID",
    nameTh: "หมายเลข LINE Channel ID",
    nameEn: "LINE Channel ID",
    serviceTh: "LINE Messaging API",
    serviceEn: "LINE Messaging API",
    descriptionTh: "หมายเลขประจำ Channel สำหรับการยืนยันตัวตนกับ LINE Developers Console",
    descriptionEn: "Channel ID assigned to your official LINE Developers application.",
    docsUrl: "https://developers.line.biz/",
    placeholder: "1234567890",
    isPassword: false,
  },
  GMAIL_USER: {
    key: "GMAIL_USER",
    nameTh: "ที่อยู่อีเมล Gmail สำหรับส่งแจ้งเตือน",
    nameEn: "Gmail Sender Email Address",
    serviceTh: "บริการส่งอีเมล Gmail SMTP",
    serviceEn: "Gmail SMTP Service",
    descriptionTh: "ที่อยู่อีเมล Gmail ที่ระบบใช้เป็นผู้ส่งการแจ้งเตือนสรุปภาพถ่ายไปยังนักศึกษา",
    descriptionEn: "Gmail address utilized by the system to dispatch photo notification summaries.",
    placeholder: "photofinder.notification@gmail.com",
    isPassword: false,
  },
  GMAIL_APP_PASSWORD: {
    key: "GMAIL_APP_PASSWORD",
    nameTh: "รหัสผ่านแอป Google (App Password)",
    nameEn: "Google App Password",
    serviceTh: "บริการส่งอีเมล Gmail SMTP",
    serviceEn: "Gmail SMTP Service",
    descriptionTh: "รหัสผ่านแอป 16 หลักที่สร้างจากบัญชี Google สำหรับอนุญาตให้ระบบส่งอีเมลผ่านโพรโทคอล SMTP",
    descriptionEn: "16-character application password generated in Google Account settings for secure SMTP relay.",
    docsUrl: "https://myaccount.google.com/apppasswords",
    placeholder: "xxxx xxxx xxxx xxxx",
    isPassword: true,
  },
}

// In-memory cache for numerical & toggle settings
interface CacheEntry {
  values: Record<string, number>
  timestamp: number
}

let cachedSettings: CacheEntry | null = null
const CACHE_TTL_MS = 30_000 // 30 seconds

// In-memory cache for secrets
interface SecretCacheEntry {
  values: Record<string, string>
  timestamp: number
}

let cachedSecrets: SecretCacheEntry | null = null

/**
 * Mask secret string for safe display in UI
 */
export function maskSecretValue(value: string | undefined): string {
  if (!value) return ""
  const str = value.trim()
  if (str.length <= 6) return "••••••"
  const prefix = str.slice(0, 4)
  const suffix = str.slice(-4)
  return `${prefix}••••••••${suffix}`
}

/**
 * Get all system settings with fallback to defaults and in-memory caching.
 */
export async function getAllSystemSettings(): Promise<Record<string, number>> {
  const now = Date.now()
  if (cachedSettings && now - cachedSettings.timestamp < CACHE_TTL_MS) {
    return { ...cachedSettings.values }
  }

  const result: Record<string, number> = {}
  for (const [key, def] of Object.entries(SYSTEM_SETTING_DEFINITIONS)) {
    result[key] = def.defaultValue
  }

  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ key: string; value: number | string }>>(
      `SELECT "key", "value" FROM "system_settings"`
    )

    for (const row of rows) {
      if (row.key in SYSTEM_SETTING_DEFINITIONS) {
        result[row.key] = Number(row.value)
      }
    }

    cachedSettings = {
      values: result,
      timestamp: now,
    }
  } catch (error) {
    console.error("[SystemSettings] Failed to fetch settings from DB, using fallback defaults:", error)
  }

  return { ...result }
}

/**
 * Get a single setting value with fallback to default.
 */
export async function getSystemSetting(key: string): Promise<number> {
  const all = await getAllSystemSettings()
  if (key in all) {
    return all[key]
  }
  return SYSTEM_SETTING_DEFINITIONS[key]?.defaultValue ?? 0
}

/**
 * Update system settings (Only Super Admin).
 * Updates database, clears cache, and records audit log.
 */
export async function updateSystemSettings(
  updates: Record<string, number>,
  actor: {
    id: string
    email: string
    role: string
    ip?: string | null
  }
): Promise<{ success: boolean; settings: Record<string, number>; changedCount: number }> {
  const current = await getAllSystemSettings()
  const changes: string[] = []
  let changedCount = 0

  for (const [key, rawValue] of Object.entries(updates)) {
    const def = SYSTEM_SETTING_DEFINITIONS[key]
    if (!def) continue

    let val = Number(rawValue)
    if (isNaN(val)) continue

    if (def.type === "boolean") {
      val = val ? 1 : 0
    } else {
      if (def.min !== undefined && val < def.min) val = def.min
      if (def.max !== undefined && val > def.max) val = def.max
    }

    const prev = current[key]
    if (prev !== val) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "system_settings" ("key", "value")
         VALUES ($1, $2)
         ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = CURRENT_TIMESTAMP`,
        key,
        val
      )

      const displayPrev = def.type === "boolean" ? (prev ? "Enabled" : "Disabled") : (def.key === "biometric_match_confidence" ? `${Math.round(prev * 100)}%` : `${prev} ${def.unitEn || ""}`)
      const displayNew = def.type === "boolean" ? (val ? "Enabled" : "Disabled") : (def.key === "biometric_match_confidence" ? `${Math.round(val * 100)}%` : `${val} ${def.unitEn || ""}`)
      changes.push(`${def.nameEn}: ${displayPrev} ➔ ${displayNew}`)
      current[key] = val
      changedCount++
    }
  }

  // Invalidate cache immediately
  cachedSettings = {
    values: current,
    timestamp: Date.now(),
  }

  if (changedCount > 0) {
    await recordAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: "SYSTEM_SETTINGS_UPDATE",
      category: "SECURITY",
      targetType: "SYSTEM",
      targetLabel: "System Settings",
      details: `Updated ${changedCount} setting(s):\n${changes.join("\n")}`,
      ipAddress: actor.ip,
    })
  }

  return {
    success: true,
    settings: current,
    changedCount,
  }
}

/**
 * Reset all system settings back to factory defaults.
 */
export async function resetSystemSettingsToDefaults(actor: {
  id: string
  email: string
  role: string
  ip?: string | null
}): Promise<{ success: boolean; settings: Record<string, number> }> {
  const defaults: Record<string, number> = {}
  for (const [key, def] of Object.entries(SYSTEM_SETTING_DEFINITIONS)) {
    defaults[key] = def.defaultValue
  }

  for (const [key, val] of Object.entries(defaults)) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "system_settings" ("key", "value")
       VALUES ($1, $2)
       ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = CURRENT_TIMESTAMP`,
      key,
      val
    )
  }

  cachedSettings = {
    values: defaults,
    timestamp: Date.now(),
  }

  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "SYSTEM_SETTINGS_RESET",
    category: "SECURITY",
    targetType: "SYSTEM",
    targetLabel: "System Settings",
    details: "Reset all system settings to default factory values.",
    ipAddress: actor.ip,
  })

  return {
    success: true,
    settings: defaults,
  }
}

// ==============================================================================
// 3. SECRETS HELPERS FOR SERVICES & SUPER ADMIN
// ==============================================================================

/**
 * Read a secret value for application services.
 * Checks in-memory cache, then database `system_secrets`, and falls back to `process.env`.
 */
export async function getSystemSecret(key: string): Promise<string | undefined> {
  const now = Date.now()
  if (cachedSecrets && now - cachedSecrets.timestamp < CACHE_TTL_MS) {
    if (key in cachedSecrets.values) {
      return cachedSecrets.values[key] || process.env[key]
    }
  }

  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ key: string; value: string }>>(
      `SELECT "key", "value" FROM "system_secrets"`
    )

    const map: Record<string, string> = {}
    for (const row of rows) {
      map[row.key] = row.value
    }

    cachedSecrets = {
      values: map,
      timestamp: now,
    }

    return map[key] || process.env[key]
  } catch (error) {
    console.error(`[SystemSecret] Failed to read secret ${key} from DB, fallback to process.env:`, error)
    return process.env[key]
  }
}

/**
 * Get safe metadata and masked values for the Super Admin UI.
 * Never leaks the actual plaintext secret to the frontend.
 */
export async function getSystemSecretsMetadata(): Promise<
  Array<
    SystemSecretDef & {
      isConfigured: boolean
      maskedValue: string
      source: "database" | "env" | "none"
      updatedAt: string | null
    }
  >
> {
  let dbSecrets: Record<string, { value: string; updatedAt: string }> = {}

  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ key: string; value: string; updatedAt: Date }>>(
      `SELECT "key", "value", "updatedAt" FROM "system_secrets"`
    )
    for (const r of rows) {
      dbSecrets[r.key] = {
        value: r.value,
        updatedAt: r.updatedAt.toISOString(),
      }
    }
  } catch (error) {
    console.error("[SystemSecret] Failed to fetch secrets metadata from DB:", error)
  }

  return Object.values(SYSTEM_SECRET_DEFINITIONS).map((def) => {
    const inDb = dbSecrets[def.key]
    const inEnv = process.env[def.key]

    if (inDb && inDb.value) {
      return {
        ...def,
        isConfigured: true,
        maskedValue: maskSecretValue(inDb.value),
        source: "database",
        updatedAt: inDb.updatedAt,
      }
    }

    if (inEnv) {
      return {
        ...def,
        isConfigured: true,
        maskedValue: maskSecretValue(inEnv),
        source: "env",
        updatedAt: null,
      }
    }

    return {
      ...def,
      isConfigured: false,
      maskedValue: "",
      source: "none",
      updatedAt: null,
    }
  })
}

/**
 * Update system secrets (Super Admin only).
 * Write-only updates with masking and audit logging.
 */
export async function updateSystemSecrets(
  updates: Record<string, string>,
  actor: {
    id: string
    email: string
    role: string
    ip?: string | null
  }
): Promise<{ success: boolean; changedCount: number }> {
  const changes: string[] = []
  let changedCount = 0

  for (const [key, rawValue] of Object.entries(updates)) {
    const def = SYSTEM_SECRET_DEFINITIONS[key]
    if (!def) continue

    const val = (rawValue || "").trim()

    // Skip if user sent masked representation
    if (val.includes("••••")) {
      continue
    }

    if (val === "__REMOVE__") {
      await prisma.$executeRawUnsafe(
        `DELETE FROM "system_secrets" WHERE "key" = $1`,
        key
      )
      changes.push(`Removed custom DB secret for ${def.nameEn} (reverted to environment variable)`)
      changedCount++
    } else if (val.length > 0) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "system_secrets" ("key", "value")
         VALUES ($1, $2)
         ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = CURRENT_TIMESTAMP`,
        key,
        val
      )
      changes.push(`Updated ${def.nameEn} (${maskSecretValue(val)})`)
      changedCount++
    }
  }

  // Bust cache immediately
  cachedSecrets = null

  if (changedCount > 0) {
    await recordAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: "SYSTEM_SECRETS_UPDATE",
      category: "SECURITY",
      targetType: "SYSTEM",
      targetLabel: "API Keys & Integrations",
      details: `Updated ${changedCount} secret(s):\n${changes.join("\n")}`,
      ipAddress: actor.ip,
    })
  }

  return {
    success: true,
    changedCount,
  }
}
