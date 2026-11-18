"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useLanguage } from "@/lib/language-context";

declare global {
  interface Window {
    google?: any;
    __google_gsi_initialized?: boolean;
  }
}

export default function LoginPage() {
  const router = useRouter();
  const { lang, setLang, t } = useLanguage();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const buttonRef = useRef<HTMLDivElement>(null);

  const persistAndRouteUser = (access_token: string, user: any) => {
    localStorage.setItem("auth_token", access_token);
    localStorage.setItem("user_id", user.id);
    localStorage.setItem("user_data", JSON.stringify(user));
    localStorage.setItem("user_name", user.name);
    localStorage.setItem("user_email", user.email);
    localStorage.setItem("user_role", user.role.toLowerCase());

    if (user.role === "PHOTOGRAPHER") {
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_name");
      router.push("/photographer");
    } else if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
      localStorage.setItem("admin_token", access_token);
      localStorage.setItem("admin_name", user.name);
      router.push("/admin/dashboard");
    } else {
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_name");
      if (user.pdpaConsent) {
        router.push("/dashboard");
      } else {
        router.push("/consent");
      }
    }
  };

  const handleCredentialResponse = async (response: any) => {
    setError(null);
    setIsLoading(true);
    try {
      const token = response.credential;
      if (!token) {
        throw new Error(t("login.err_no_credential"));
      }

      const res = await apiClient.loginWithGoogle(token);

      if (res.error || !res.data) {
        const message = res.error || t("login.err_failed");
        setError(message);
        setIsLoading(false);
        return;
      }

      const { access_token, user } = res.data;
      persistAndRouteUser(access_token, user);
    } catch (err: any) {
      console.error(err);
      setError(err.message || t("login.err_google_failed"));
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const initGoogle = () => {
      if (window.google?.accounts?.id && buttonRef.current) {
        // Only initialize once globally to avoid [GSI_LOGGER] warning
        if (!window.__google_gsi_initialized) {
          window.google.accounts.id.initialize({
            client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
            callback: handleCredentialResponse,
            auto_select: false,
          });
          window.__google_gsi_initialized = true;
        }

        buttonRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: "outline",
          size: "large",
          text: "signin_with",
          shape: "rectangular",
          locale: lang === "th" ? "th" : "en",
          width: 320,
        });
      }
    };

    // If script is already loaded
    if (window.google) {
      initGoogle();
      return;
    }

    // Otherwise wait for it
    const interval = setInterval(() => {
      if (window.google) {
        clearInterval(interval);
        initGoogle();
      }
    }, 100);

    return () => clearInterval(interval);
  }, [lang]);

  return (
    <main
      className="relative min-h-dvh flex items-center justify-center px-4"
      style={{
        backgroundImage: 'url(/background.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <Card className="relative z-10 w-full max-w-md bg-white/10 dark:bg-black/10 border-white/20 text-white animate-in fade-in-0 zoom-in-95 duration-500 overflow-hidden">
        {/* Language Switcher */}
        <div className="absolute top-4 right-4 z-20">
          <div className="flex items-center overflow-hidden rounded-md border border-white/20 bg-black/40 shadow-xs backdrop-blur-sm">
            <button
              type="button"
              onClick={() => setLang("th")}
              className={`px-3 py-1 text-xs font-semibold transition-colors ${
                lang === "th"
                  ? "bg-primary text-white shadow-inner"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
              title="ภาษาไทย"
            >
              TH
            </button>
            <button
              type="button"
              onClick={() => setLang("en")}
              className={`px-3 py-1 text-xs font-semibold transition-colors ${
                lang === "en"
                  ? "bg-primary text-white shadow-inner"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
              title="English"
            >
              EN
            </button>
          </div>
        </div>

        <CardHeader className="text-center space-y-2 pt-10">
          <CardTitle className="text-3xl font-bold">{t("login.title")}</CardTitle>
          <CardDescription className="text-white/80">
            {t("login.desc_prefix")} <strong>@lamduan.mfu.ac.th</strong> {t("login.desc_suffix")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="flex gap-3 p-4 bg-red-500/20 border border-red-500/30 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <p className="text-[11px] leading-relaxed text-white/70">
              {t("login.restriction_text")}{" "}
              <span className="text-white font-semibold">{t("login.restriction_student")}</span>{" "}
              {t("login.restriction_and")}{" "}
              <span className="text-white font-semibold">{t("login.restriction_authorized")}</span>
            </p>
          </div>

          <div className="flex justify-center py-4 min-h-[60px]">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-white/80" />
                <span className="text-sm font-medium text-white/80">{t("login.signing_in")}</span>
              </div>
            ) : (
              <div ref={buttonRef} />
            )}
          </div>

          <p className="text-xs text-white/60 text-center">
            {t("login.first_time_notice")}
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
