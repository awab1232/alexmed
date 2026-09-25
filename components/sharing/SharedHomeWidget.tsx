"use client";

import Link from "next/link";
import { Bell, ChevronLeft, Inbox, Users } from "lucide-react";
import { trpc } from "@/lib/trpc-client";

// 📤 Home (/subjects) entry to sharing: pending requests first, then packs
// shared in the last two weeks, else a quiet "مشترك معي" row. Real counts
// from sharing.homeSummary — nothing shown that the server didn't return.
export function SharedHomeWidget() {
  const summary = trpc.sharing.homeSummary.useQuery();
  if (!summary.data) return null;
  const { pending, unread, recent } = summary.data;

  return (
    <div className="sh-home">
      {pending > 0 ? (
        <Link href="/shared" className="sh-home-row is-pending">
          <span className="sh-home-icon">
            <Inbox size={18} aria-hidden="true" />
          </span>
          <span className="sh-home-text">
            <strong>
              {pending === 1
                ? "لديك طلب مشاركة جديد"
                : `لديك ${pending} طلبات مشاركة جديدة`}
            </strong>
            <span>زميلك يريد مشاركة ملف دراسي جاهز معك</span>
          </span>
          <ChevronLeft size={18} aria-hidden="true" />
        </Link>
      ) : (
        <Link href="/shared" className="sh-home-row">
          <span className="sh-home-icon">
            <Users size={18} aria-hidden="true" />
          </span>
          <span className="sh-home-text">
            <strong>مشترك معي</strong>
            <span>ملفات شاركها معك زملاؤك</span>
          </span>
          {unread > 0 && (
            <span className="sh-count" aria-label={`${unread} إشعارات جديدة`}>
              <Bell size={11} aria-hidden="true" /> {unread}
            </span>
          )}
          <ChevronLeft size={18} aria-hidden="true" />
        </Link>
      )}
      {recent.map(pack => (
        <Link
          key={pack.bookId}
          href={`/books/${pack.bookId}`}
          className="sh-home-row is-recent"
        >
          <span className="sh-home-icon" aria-hidden="true">
            📘
          </span>
          <span className="sh-home-text">
            <strong dir="auto">{pack.bookTitle}</strong>
            <span>
              مشترك من{" "}
              <bdi>
                {pack.ownerName ||
                  (pack.ownerUsername ? `@${pack.ownerUsername}` : "زميل")}
              </bdi>
            </span>
          </span>
          <ChevronLeft size={18} aria-hidden="true" />
        </Link>
      ))}
    </div>
  );
}
