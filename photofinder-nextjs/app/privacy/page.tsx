"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Trash2,
  Lock,
  Fingerprint,
  Database,
  ArrowLeft,
  Check,
  X,
  Settings,
  Download,
  HelpCircle,
  Mail,
  Building2,
  Cpu,
  Layers,
  Sparkles,
  Server,
  RefreshCw,
  UserCheck,
  FileCheck2,
  Timer,
  MapPin,
  ArrowRight,
  HardDriveDownload,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { useLanguage } from "@/lib/language-context"

export default function PrivacyPolicyPage() {
  const router = useRouter()
  const { lang, setLang, t } = useLanguage()
  const [backUrl, setBackUrl] = useState("/")
  const [userRole, setUserRole] = useState<string>("guest")
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [activeSection, setActiveSection] = useState<string>("lifecycle")

  useEffect(() => {
    setMounted(true)
    const adminToken = localStorage.getItem("admin_token")
    const authToken = localStorage.getItem("auth_token")
    const role = (localStorage.getItem("user_role") || "student").toLowerCase()

    if (adminToken) {
      setUserRole("admin")
      setIsLoggedIn(true)
      setBackUrl("/admin/dashboard")
    } else if (authToken) {
      setIsLoggedIn(true)
      setUserRole(role)
      if (role === "photographer") {
        setBackUrl("/photographer")
      } else {
        setBackUrl("/dashboard")
      }
    } else {
      setUserRole("guest")
      setIsLoggedIn(false)
      setBackUrl("/")
    }
  }, [])

  const formatDate = () => {
    if (!mounted) return ""
    const now = new Date()
    if (lang === "th") {
      return now.toLocaleDateString("th-TH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    }
    return now.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })
  }

  const scrollToSection = (id: string) => {
    setActiveSection(id)
    const el = document.getElementById(id)
    if (el) {
      const yOffset = -85
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset
      window.scrollTo({ top: y, behavior: "smooth" })
    }
  }

  return (
    <div className="min-h-screen bg-[#fcfdfe] text-slate-900 selection:bg-[#82181a]/15 selection:text-[#82181a]">
      {/* Top Multi-Tone Accent Line */}
      <div className="fixed top-0 left-0 right-0 z-50 h-[2.5px] bg-gradient-to-r from-[#82181a] via-[#9e1c1f] via-amber-500/80 to-[#82181a]" />

      {/* Compact Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/70 shadow-2xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <Link
              href={backUrl}
              className="flex items-center gap-2.5 transition-opacity hover:opacity-85 focus:outline-hidden"
              aria-label="PhotoFinder Home"
            >
              <img src="/Logo2.png" alt="Photo Finder" className="h-8.5 w-auto object-contain" />
            </Link>

            <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-slate-200 text-xs">
              <span className="font-bold tracking-wider uppercase text-[#82181a] bg-[#82181a]/10 px-2 py-0.5 rounded text-[10px]">
                PDPA & TRUST
              </span>
              <span className="text-slate-400 text-xs font-normal">Mae Fah Luang University</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* TH / EN Switcher */}
            <div className="flex items-center border border-slate-200 rounded-md p-0.5 bg-slate-50 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setLang("th")}
                className={`px-2.5 py-0.5 rounded transition-all cursor-pointer ${
                  lang === "th"
                    ? "bg-[#82181a] text-white shadow-2xs"
                    : "text-slate-500 hover:text-slate-900 hover:bg-white"
                }`}
              >
                TH
              </button>
              <button
                type="button"
                onClick={() => setLang("en")}
                className={`px-2.5 py-0.5 rounded transition-all cursor-pointer ${
                  lang === "en"
                    ? "bg-[#82181a] text-white shadow-2xs"
                    : "text-slate-500 hover:text-slate-900 hover:bg-white"
                }`}
              >
                EN
              </button>
            </div>

            {/* Settings shortcut if logged in */}
            {isLoggedIn && userRole !== "admin" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/settings")}
                className="hidden md:inline-flex items-center gap-1.5 border-slate-200 text-slate-600 hover:text-[#82181a] hover:bg-slate-50 text-xs h-7.5 px-2.5 rounded-md"
              >
                <Settings className="w-3.5 h-3.5 text-slate-400" />
                <span>{t("privacy.nav.settings")}</span>
              </Button>
            )}

            {/* Back Button */}
            <Button
              variant="default"
              size="sm"
              onClick={() => router.push(backUrl)}
              className="bg-[#82181a] hover:bg-[#6f1416] text-white text-xs h-7.5 px-3 rounded-md shadow-2xs gap-1 font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{t("privacy.nav.back")}</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative">
        {/* Subtle Ambient Background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.025]"
            style={{
              backgroundImage: "radial-gradient(#82181a 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-b from-[#82181a]/8 via-amber-500/5 to-transparent rounded-full blur-2xl" />
        </div>

        {/* COMPACT HERO SECTION */}
        <section className="relative pt-8 pb-7 sm:pt-10 sm:pb-8 px-4 sm:px-6 border-b border-slate-200/60 bg-gradient-to-b from-white/90 via-white/70 to-slate-50/30">
          <div className="max-w-3xl mx-auto text-center space-y-4">
            
            {/* Compact Shield Emblem & Pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#82181a]/8 text-[#82181a] border border-[#82181a]/15 shadow-2xs">
              <ShieldCheck className="w-3.5 h-3.5 text-[#82181a]" />
              <span>{t("privacy.badge")}</span>
            </div>

            {/* Title & Subtitle */}
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 leading-tight">
                {t("privacy.title")}
              </h1>
              <p className="max-w-xl mx-auto text-xs sm:text-sm text-slate-600 leading-relaxed">
                {t("privacy.subtitle")}
              </p>
            </div>

            {/* 4 Trust Feature Cards (Compact Row) */}
            <div className="pt-1 grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-2xl mx-auto">
              <div className="flex items-center gap-2 p-2 rounded-lg border border-slate-200/80 bg-white/90 shadow-2xs text-left">
                <div className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <Shield className="w-3.5 h-3.5" />
                </div>
                <div className="text-[11px] font-semibold text-slate-800 truncate">
                  {t("privacy.pill.pdpa")}
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 rounded-lg border border-slate-200/80 bg-white/90 shadow-2xs text-left">
                <div className="w-6 h-6 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <Clock className="w-3.5 h-3.5" />
                </div>
                <div className="text-[11px] font-semibold text-slate-800 truncate">
                  {t("privacy.pill.retention")}
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 rounded-lg border border-slate-200/80 bg-white/90 shadow-2xs text-left">
                <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Fingerprint className="w-3.5 h-3.5" />
                </div>
                <div className="text-[11px] font-semibold text-slate-800 truncate">
                  {t("privacy.pill.vector")}
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 rounded-lg border border-slate-200/80 bg-white/90 shadow-2xs text-left">
                <div className="w-6 h-6 rounded-md bg-[#82181a]/10 text-[#82181a] flex items-center justify-center shrink-0">
                  <UserCheck className="w-3.5 h-3.5" />
                </div>
                <div className="text-[11px] font-semibold text-slate-800 truncate">
                  {t("privacy.pill.control")}
                </div>
              </div>
            </div>

            {/* Last Updated Pill */}
            <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>{t("privacy.last_updated")} {formatDate()}</span>
            </div>

          </div>
        </section>

        {/* Section Jump Quick Bar (Compact Sticky) */}
        <nav
          aria-label="Section shortcuts"
          className="sticky top-14 z-30 bg-white/85 backdrop-blur-md border-b border-slate-200/80 py-2 px-4 shadow-2xs overflow-x-auto"
        >
          <div className="max-w-3xl mx-auto flex items-center justify-start sm:justify-center gap-1.5 text-[11px] font-semibold whitespace-nowrap min-w-max">
            {[
              { id: "lifecycle", label: t("privacy.jump.lifecycle"), icon: Cpu },
              { id: "guarantees", label: t("privacy.jump.guarantees"), icon: FileCheck2 },
              { id: "retention", label: t("privacy.jump.retention"), icon: Clock },
              { id: "rights", label: t("privacy.jump.rights"), icon: Shield },
              { id: "security", label: t("privacy.jump.security"), icon: Lock },
              { id: "faq", label: t("privacy.jump.faq"), icon: HelpCircle },
            ].map((tab) => {
              const Icon = tab.icon
              const isActive = activeSection === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => scrollToSection(tab.id)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full transition-all cursor-pointer ${
                    isActive
                      ? "bg-[#82181a] text-white shadow-2xs"
                      : "bg-slate-100 hover:bg-slate-200/80 text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>
        </nav>

        {/* CONTENT CONTAINER (Slimmer max-w & balanced spacing) */}
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-11 space-y-11 sm:space-y-13">

          {/* SECTION 1: AI Data Lifecycle */}
          <section id="lifecycle" className="scroll-mt-24 space-y-4">
            <div className="space-y-1 border-b border-slate-200/70 pb-3">
              <div className="flex items-center gap-1.5 text-[#82181a] font-bold text-[11px] uppercase tracking-wider">
                <Cpu className="w-3.5 h-3.5" />
                <span>AI Architecture</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                {t("privacy.lifecycle.title")}
              </h2>
              <p className="text-xs text-slate-600">{t("privacy.lifecycle.desc")}</p>
            </div>

            {/* 4-Step Pipeline */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {/* Step 1 */}
              <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs space-y-2 flex flex-col justify-between hover:border-blue-200 transition-colors">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100/70">
                      <Database className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                      Step 1
                    </span>
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">{t("privacy.step1.title")}</h3>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      {t("privacy.step1.desc")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs space-y-2 flex flex-col justify-between hover:border-purple-200 transition-colors">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100/70">
                      <Fingerprint className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700">
                      Step 2
                    </span>
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">{t("privacy.step2.title")}</h3>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      {t("privacy.step2.desc")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs space-y-2 flex flex-col justify-between hover:border-emerald-200 transition-colors">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100/70">
                      <Layers className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                      Step 3
                    </span>
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">{t("privacy.step3.title")}</h3>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      {t("privacy.step3.desc")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 4 */}
              <div className="rounded-xl border border-amber-200/80 bg-amber-50/30 p-3.5 shadow-2xs space-y-2 flex flex-col justify-between hover:border-amber-300 transition-colors">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center border border-amber-200">
                      <Clock className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-200/80 text-amber-900">
                      Step 4
                    </span>
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">{t("privacy.step4.title")}</h3>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      {t("privacy.step4.desc")}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Compact Technical Callout */}
            <div className="rounded-xl border border-[#82181a]/15 bg-[#82181a]/4 p-3.5 flex items-start gap-3">
              <ShieldCheck className="w-4 h-4 text-[#82181a] shrink-0 mt-0.5" />
              <div className="text-xs text-slate-700 leading-relaxed">
                <strong className="text-[#82181a] font-semibold">512-D Irreversible Embeddings: </strong>
                <span>
                  Our AI converts faces into encrypted mathematical numbers for in-memory cosine matching only. Raw face images are never stored as biometric surveillance templates.
                </span>
              </div>
            </div>
          </section>

          {/* SECTION 2: Guarantees & Prohibitions */}
          <section id="guarantees" className="scroll-mt-24 space-y-4">
            <div className="space-y-1 border-b border-slate-200/70 pb-3">
              <div className="flex items-center gap-1.5 text-[#82181a] font-bold text-[11px] uppercase tracking-wider">
                <FileCheck2 className="w-3.5 h-3.5" />
                <span>Policy Commitments</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                {t("privacy.do_dont.title")}
              </h2>
              <p className="text-xs text-slate-600">{t("privacy.do_dont.desc")}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Left Column: What We Do */}
              <div className="rounded-xl border border-emerald-200/70 bg-white shadow-2xs overflow-hidden flex flex-col justify-between">
                <div className="bg-emerald-50/60 px-4 py-2.5 border-b border-emerald-100 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-700 stroke-[3]" />
                  <h3 className="text-xs font-bold text-emerald-950">{t("privacy.dos.title")}</h3>
                </div>
                <div className="p-3.5 sm:p-4 space-y-2.5 text-xs text-slate-700">
                  {[
                    t("privacy.dos.item1"),
                    t("privacy.dos.item2"),
                    t("privacy.dos.item3"),
                    t("privacy.dos.item4"),
                    t("privacy.dos.item5"),
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5 stroke-[2.5]" />
                      <span className="leading-relaxed text-slate-800">{item}</span>
                    </div>
                  ))}
                </div>
                <div className="bg-emerald-50/30 px-4 py-2 border-t border-emerald-100 text-[10px] font-medium text-emerald-800 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  <span>Enforced under University PDPA Guidelines</span>
                </div>
              </div>

              {/* Right Column: What We NEVER Do */}
              <div className="rounded-xl border border-rose-200/70 bg-white shadow-2xs overflow-hidden flex flex-col justify-between">
                <div className="bg-rose-50/60 px-4 py-2.5 border-b border-rose-100 flex items-center gap-2">
                  <X className="w-4 h-4 text-rose-700 stroke-[3]" />
                  <h3 className="text-xs font-bold text-rose-950">{t("privacy.donts.title")}</h3>
                </div>
                <div className="p-3.5 sm:p-4 space-y-2.5 text-xs text-slate-700">
                  {[
                    t("privacy.donts.item1"),
                    t("privacy.donts.item2"),
                    t("privacy.donts.item3"),
                    t("privacy.donts.item4"),
                    t("privacy.donts.item5"),
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <X className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5 stroke-[2.5]" />
                      <span className="leading-relaxed text-slate-800">{item}</span>
                    </div>
                  ))}
                </div>
                <div className="bg-rose-50/30 px-4 py-2 border-t border-rose-100 text-[10px] font-medium text-rose-800 flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3 text-rose-600" />
                  <span>Zero Exceptions Allowed Under Any Circumstance</span>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 3: 30-Day Auto-Purge & Retention */}
          <section id="retention" className="scroll-mt-24 space-y-4">
            <div className="space-y-1 border-b border-slate-200/70 pb-3">
              <div className="flex items-center gap-1.5 text-[#82181a] font-bold text-[11px] uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5" />
                <span>Lifecycle & Retention</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                {t("privacy.retention.title")}
              </h2>
              <p className="text-xs text-slate-600">{t("privacy.retention.desc")}</p>
            </div>

            {/* Compact Timeline Bar */}
            <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Timer className="w-3.5 h-3.5 text-amber-600" />
                  Event Photos Retention Lifecycle
                </span>
                <Badge variant="outline" className="text-[10px] text-amber-800 border-amber-300 bg-amber-50">
                  Daily Cron Purge
                </Badge>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-500 via-amber-400 to-[#82181a] rounded-full w-full" />
              </div>
              <div className="flex justify-between text-[10px] font-medium text-slate-400">
                <span>Day 0 (Upload & Match)</span>
                <span className="text-amber-700 font-semibold">Days 1–29 (Active)</span>
                <span className="text-rose-700 font-bold">Day 30 (Permanent Delete)</span>
              </div>
            </div>

            <div className="grid gap-3">
              {/* Event Photos */}
              <div className="rounded-xl border border-amber-200/80 bg-amber-50/20 p-3.5 shadow-2xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    {t("privacy.retention.events_title")}
                  </h3>
                  <Badge className="bg-amber-600 text-white text-[10px] font-semibold h-5">
                    30-Day Limit
                  </Badge>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {t("privacy.retention.events_desc")}
                </p>
              </div>

              {/* Reference Selfie */}
              <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                    <Fingerprint className="w-3.5 h-3.5 text-blue-600" />
                    {t("privacy.retention.selfie_title")}
                  </h3>
                  <Badge variant="outline" className="text-blue-700 border-blue-200 text-[10px] font-medium h-5">
                    User Controlled
                  </Badge>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {t("privacy.retention.selfie_desc")}
                </p>
              </div>

              {/* Security Logs */}
              <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                    <Server className="w-3.5 h-3.5 text-slate-500" />
                    {t("privacy.retention.logs_title")}
                  </h3>
                  <Badge variant="outline" className="text-slate-500 border-slate-200 text-[10px] font-medium h-5">
                    90-Day Rotation
                  </Badge>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {t("privacy.retention.logs_desc")}
                </p>
              </div>
            </div>
          </section>

          {/* SECTION 4: Your Rights Under PDPA */}
          <section id="rights" className="scroll-mt-24 space-y-4">
            <div className="space-y-1 border-b border-slate-200/70 pb-3">
              <div className="flex items-center gap-1.5 text-[#82181a] font-bold text-[11px] uppercase tracking-wider">
                <Shield className="w-3.5 h-3.5" />
                <span>Data Subject Rights</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                {t("privacy.rights.title")}
              </h2>
              <p className="text-xs text-slate-600">{t("privacy.rights.desc")}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs space-y-1.5">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                  <Lock className="w-4 h-4 text-slate-600" />
                  <h4>{t("privacy.rights.withdraw_title")}</h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {t("privacy.rights.withdraw_desc")}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs space-y-1.5">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  <h4>{t("privacy.rights.erasure_title")}</h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {t("privacy.rights.erasure_desc")}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs space-y-1.5">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                  <HardDriveDownload className="w-4 h-4 text-blue-600" />
                  <h4>{t("privacy.rights.portability_title")}</h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {t("privacy.rights.portability_desc")}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs space-y-1.5">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                  <RefreshCw className="w-4 h-4 text-amber-600" />
                  <h4>{t("privacy.rights.wipe_title")}</h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {t("privacy.rights.wipe_desc")}
                </p>
              </div>
            </div>

            {/* Compact CTA to Settings */}
            <div className="rounded-xl border border-[#82181a]/20 bg-gradient-to-r from-[#82181a]/5 via-white to-amber-500/5 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
              <div className="text-center sm:text-left space-y-0.5">
                <h4 className="text-xs font-bold text-slate-900">
                  Ready to manage your privacy settings?
                </h4>
                <p className="text-[11px] text-slate-500">
                  Configure consent, download records, or wipe selfie data anytime.
                </p>
              </div>
              <Button
                onClick={() => router.push(isLoggedIn ? "/settings" : "/login")}
                className="bg-[#82181a] hover:bg-[#6f1416] text-white text-xs h-8 px-3.5 shrink-0 rounded-lg shadow-2xs font-medium"
              >
                <Settings className="w-3.5 h-3.5 mr-1.5" />
                <span>{t("privacy.rights.btn_settings")}</span>
              </Button>
            </div>
          </section>

          {/* SECTION 5: Security Architecture */}
          <section id="security" className="scroll-mt-24 space-y-4">
            <div className="space-y-1 border-b border-slate-200/70 pb-3">
              <div className="flex items-center gap-1.5 text-[#82181a] font-bold text-[11px] uppercase tracking-wider">
                <Lock className="w-3.5 h-3.5" />
                <span>Security Standards</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                {t("privacy.security.title")}
              </h2>
              <p className="text-xs text-slate-600">{t("privacy.security.desc")}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="p-3.5 rounded-xl border border-slate-200/80 bg-white shadow-2xs space-y-1">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                  <Lock className="w-3.5 h-3.5 text-emerald-600" />
                  <h4>{t("privacy.security.item1_title")}</h4>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {t("privacy.security.item1_desc")}
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200/80 bg-white shadow-2xs space-y-1">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                  <Database className="w-3.5 h-3.5 text-blue-600" />
                  <h4>{t("privacy.security.item2_title")}</h4>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {t("privacy.security.item2_desc")}
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200/80 bg-white shadow-2xs space-y-1">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                  <h4>{t("privacy.security.item3_title")}</h4>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {t("privacy.security.item3_desc")}
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200/80 bg-white shadow-2xs space-y-1">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                  <Cpu className="w-3.5 h-3.5 text-purple-600" />
                  <h4>{t("privacy.security.item4_title")}</h4>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {t("privacy.security.item4_desc")}
                </p>
              </div>
            </div>
          </section>

          {/* SECTION 6: FAQ Accordion */}
          <section id="faq" className="scroll-mt-24 space-y-4">
            <div className="space-y-1 border-b border-slate-200/70 pb-3">
              <div className="flex items-center gap-1.5 text-[#82181a] font-bold text-[11px] uppercase tracking-wider">
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Common Questions</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                {t("privacy.faq.title")}
              </h2>
              <p className="text-xs text-slate-600">{t("privacy.faq.desc")}</p>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white shadow-2xs px-3 sm:px-4">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="item-1" className="border-b border-slate-100">
                  <AccordionTrigger className="text-left text-xs sm:text-sm font-semibold text-slate-900 hover:text-[#82181a] transition-colors py-3">
                    {t("privacy.faq.q1")}
                  </AccordionTrigger>
                  <AccordionContent className="text-xs text-slate-600 leading-relaxed pb-3 pt-0">
                    {t("privacy.faq.a1")}
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-2" className="border-b border-slate-100">
                  <AccordionTrigger className="text-left text-xs sm:text-sm font-semibold text-slate-900 hover:text-[#82181a] transition-colors py-3">
                    {t("privacy.faq.q2")}
                  </AccordionTrigger>
                  <AccordionContent className="text-xs text-slate-600 leading-relaxed pb-3 pt-0">
                    {t("privacy.faq.a2")}
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-3" className="border-b border-slate-100">
                  <AccordionTrigger className="text-left text-xs sm:text-sm font-semibold text-slate-900 hover:text-[#82181a] transition-colors py-3">
                    {t("privacy.faq.q3")}
                  </AccordionTrigger>
                  <AccordionContent className="text-xs text-slate-600 leading-relaxed pb-3 pt-0">
                    {t("privacy.faq.a3")}
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-4" className="border-b border-slate-100">
                  <AccordionTrigger className="text-left text-xs sm:text-sm font-semibold text-slate-900 hover:text-[#82181a] transition-colors py-3">
                    {t("privacy.faq.q4")}
                  </AccordionTrigger>
                  <AccordionContent className="text-xs text-slate-600 leading-relaxed pb-3 pt-0">
                    {t("privacy.faq.a4")}
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-5" className="border-none">
                  <AccordionTrigger className="text-left text-xs sm:text-sm font-semibold text-slate-900 hover:text-[#82181a] transition-colors py-3">
                    {t("privacy.faq.q5")}
                  </AccordionTrigger>
                  <AccordionContent className="text-xs text-slate-600 leading-relaxed pb-3 pt-0">
                    {t("privacy.faq.a5")}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </section>

          {/* SECTION 7: Institutional Contact & DPO */}
          <section id="contact" className="scroll-mt-24">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-2xs relative overflow-hidden space-y-4">
              <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-[#82181a]" />

              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#82181a]/10 text-[#82181a] border border-[#82181a]/20 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">{t("privacy.contact.title")}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{t("privacy.contact.desc")}</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 text-xs text-slate-600 border-t border-slate-100 pt-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900">
                    <MapPin className="w-3.5 h-3.5 text-[#82181a]" />
                    <span>{t("privacy.contact.univ")}</span>
                  </div>
                  <p className="pl-5 text-slate-500 leading-relaxed text-[11px]">
                    {t("privacy.contact.addr")}
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-[#82181a]" />
                    <span className="font-bold text-slate-900">{t("privacy.contact.email_label")}</span>
                    <a
                      href="mailto:dpo@mfu.ac.th"
                      className="text-[#82181a] font-medium hover:underline text-[11px]"
                    >
                      dpo@mfu.ac.th
                    </a>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500 pl-5 text-[11px]">
                    <Clock className="w-3 h-3" />
                    <span>{t("privacy.contact.hours_val")}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 px-4 text-center text-[11px] text-slate-400">
        <div className="max-w-3xl mx-auto space-y-1.5">
          <div className="flex items-center justify-center gap-2">
            <img src="/Logo2.png" alt="Photo Finder" className="h-5.5 w-auto opacity-70" />
            <span className="text-slate-300">|</span>
            <span className="font-medium text-slate-600">Mae Fah Luang University</span>
          </div>
          <p>© {new Date().getFullYear()} Mae Fah Luang University. All rights reserved.</p>
          <p className="text-[10px] text-slate-400">
            PhotoFinder Campus Service · Personal Data Protection Act B.E. 2562
          </p>
        </div>
      </footer>
    </div>
  )
}
