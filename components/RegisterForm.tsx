"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import NiroAuthScene from "@/components/niro/NiroAuthScene";
import { GoogleIcon, PasswordInput } from "@/components/AuthFields";
import { niroLine } from "@/lib/niro";

export default function RegisterForm({
  googleEnabled,
}: {
  googleEnabled: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "تعذر إنشاء الحساب.");
        setLoading(false);
        return;
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      setLoading(false);

      if (result?.error) {
        router.push("/login");
        return;
      }

      router.push("/subjects");
      router.refresh();
    } catch {
      setError("حدث خطأ غير متوقع.");
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    await signIn("google", { callbackUrl: "/subjects" });
  }

  return (
    <NiroAuthScene
      expression={error ? "shocked" : loading ? "explaining" : "victory"}
      line={error ? niroLine("oops") : niroLine("join")}
    >
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">إنشاء حساب</h1>
        <p className="text-sm text-muted-foreground mb-6">
          انضم إلى NiroLearn لحفظ مذاكرتك
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">الاسم (اختياري)</Label>
            <Input
              id="name"
              value={name}
              onChange={e => setName(e.target.value)}
              autoComplete="name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">البريد الإلكتروني</Label>
            <Input
              id="email"
              type="email"
              required
              dir="ltr"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">كلمة المرور</Label>
            <PasswordInput
              id="password"
              minLength={8}
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "جاري الإنشاء..." : "إنشاء حساب"}
          </Button>
        </form>

        {googleEnabled && (
          <>
            <div className="flex items-center gap-3 my-5">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">أو</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full niro-auth-google"
              disabled={googleLoading}
              onClick={handleGoogle}
            >
              <GoogleIcon />
              {googleLoading ? "جاري التحويل..." : "التسجيل عبر Google"}
            </Button>
          </>
        )}

        <p className="mt-5 text-center text-xs text-muted-foreground leading-6">
          بإنشاء حساب فإنك توافق على{" "}
          <a href="/terms" className="text-primary underline">
            سياسة الاستخدام
          </a>{" "}
          و
          <a href="/privacy" className="text-primary underline">
            سياسة الخصوصية
          </a>
          .
        </p>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          لديك حساب؟{" "}
          <a href="/login" className="text-primary underline">
            سجّل الدخول
          </a>
        </p>
      </div>
    </NiroAuthScene>
  );
}
