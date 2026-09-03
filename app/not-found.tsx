"use client";

import { Button } from "@/components/ui/button";
import { AlertCircle, Home } from "lucide-react";
import { useRouter } from "next/navigation";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="flex justify-center mb-6">
          <AlertCircle className="h-16 w-16 text-destructive" />
        </div>

        <h1 className="text-4xl font-bold text-foreground mb-2">404</h1>
        <h2 className="text-xl font-semibold text-foreground mb-4">
          الصفحة غير موجودة
        </h2>
        <p className="text-muted-foreground mb-8 leading-relaxed">
          عذرًا، الصفحة التي تبحث عنها غير موجودة.
          <br />
          ربما تم نقلها أو حذفها.
        </p>

        <Button onClick={() => router.push("/")} className="px-6">
          <Home className="w-4 h-4 ml-2" />
          العودة للرئيسية
        </Button>
      </div>
    </div>
  );
}
