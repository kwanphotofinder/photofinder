"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Upload, Users, BarChart3, Heart, Camera, Settings } from "lucide-react"
import { useLanguage } from "@/lib/language-context"

interface NavigationProps {
  userRole?: "student" | "photographer" | "admin"
}

export function Navigation({ userRole = "student" }: NavigationProps) {
  const pathname = usePathname()
  const { t } = useLanguage()

  const getNavItems = () => {
    const baseItems = [
      { href: "/dashboard", label: t("nav.my_photos"), icon: Users },
      { href: "/favorites", label: t("nav.favorites"), icon: Heart },
    ]

    if (userRole === "photographer") {
      return [
        { href: "/photographer", label: t("nav.workspace"), icon: Camera },
        { href: "/photographer/profile", label: t("nav.settings"), icon: Settings },
      ]
    }

    if (userRole === "admin") {
      return [
        { href: "/admin/dashboard", label: t("nav.dashboard"), icon: BarChart3 },
        { href: "/admin/events/create", label: t("breadcrumb.create_event"), icon: Upload },
      ]
    }

    return baseItems
  }

  const navItems = getNavItems()

  return (
    <nav className="flex items-center gap-1.5">
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors",
              isActive
                ? "bg-[#82181a] text-white shadow-2xs"
                : "text-slate-600 hover:text-[#82181a] hover:bg-slate-100",
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
