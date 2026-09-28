import Link from "next/link";
import { AlertCircle, Home } from "lucide-react";
import s from "./status.module.css";

export default function NotFound() {
  return (
    <main className={s.screen}>
      <div className={s.panel}>
        <span className={s.icon}>
          <AlertCircle size={28} aria-hidden="true" />
        </span>
        <h1 className={s.code}>404</h1>
        <h2 className={s.title}>الصفحة غير موجودة</h2>
        <p className={s.text}>
          عذرًا، الصفحة التي تبحث عنها غير موجودة.
          <br />
          ربما تم نقلها أو حذفها.
        </p>
        <Link href="/" className={s.action}>
          <Home size={16} aria-hidden="true" />
          العودة للرئيسية
        </Link>
      </div>
    </main>
  );
}
