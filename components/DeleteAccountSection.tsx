"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { Loader2, Trash2, X } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import s from "./DeleteAccountSection.module.css";

// "حذف الحساب" — a quiet grey link at the bottom of حسابي ← الملف الدراسي
// (linked from the privacy policy and terms as /account#delete-account, and
// required by Google Play for apps with accounts). Permanent — the server
// deletes the account, every file and all study data (lib/db-account.ts).
// Tapping it opens a confirmation dialog; the student types «حذف» first.
export const DELETE_CONFIRM_WORD = "حذف";

export default function DeleteAccountSection() {
  const [open, setOpen] = useState(false);

  // The policy links here as /account#delete-account; this link renders
  // after the page loads, so the browser's own anchor jump misses it.
  const linkRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (window.location.hash === "#delete-account") {
      linkRef.current?.scrollIntoView({ block: "center" });
    }
  }, []);

  return (
    <>
      <button
        id="delete-account"
        ref={linkRef}
        type="button"
        className={s.link}
        onClick={() => setOpen(true)}
      >
        حذف الحساب
      </button>
      {open ? <DeleteAccountDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function DeleteAccountDialog({ onClose }: { onClose: () => void }) {
  const [typed, setTyped] = useState("");
  const remove = trpc.auth.deleteAccount.useMutation({
    onSuccess: () => signOut({ callbackUrl: "/login?deleted=1" }),
  });
  const matches = typed.trim() === DELETE_CONFIRM_WORD;
  const dialogRef = useRef<HTMLDivElement>(null);
  const close = () => {
    if (!remove.isPending) onClose();
  };

  // Esc closes; focus moves into the dialog and back out on close.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>("input")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={s.backdrop} onClick={close}>
      <div
        ref={dialogRef}
        className={s.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        aria-describedby="delete-account-body"
        onClick={event => event.stopPropagation()}
      >
        <button
          type="button"
          className={s.close}
          onClick={close}
          aria-label="إغلاق"
        >
          <X size={18} />
        </button>
        <h2 id="delete-account-title" className={s.title}>
          حذف الحساب نهائيًا؟
        </h2>
        <p id="delete-account-body" className={s.body}>
          يُحذف حسابك مع كل ملفاتك وصورها، والملخصات والبطاقات والأسئلة،
          وتقدّمك ومحادثاتك ومشاركاتك. لا يمكن التراجع عن ذلك.
        </p>
        <form
          onSubmit={event => {
            event.preventDefault();
            if (matches) remove.mutate({ confirm: DELETE_CONFIRM_WORD });
          }}
        >
          <label className={s.field}>
            للتأكيد اكتب كلمة «{DELETE_CONFIRM_WORD}»
            <input
              value={typed}
              onChange={event => setTyped(event.target.value)}
              autoComplete="off"
              placeholder={DELETE_CONFIRM_WORD}
            />
          </label>
          {remove.error ? (
            <p className={s.error} role="alert">
              {remove.error.message}
            </p>
          ) : null}
          <div className={s.actions}>
            <button
              type="submit"
              className={s.confirm}
              disabled={!matches || remove.isPending}
            >
              {remove.isPending ? (
                <Loader2 size={15} className="spin" />
              ) : (
                <Trash2 size={15} />
              )}
              حذف نهائي
            </button>
            <button
              type="button"
              className={s.cancel}
              disabled={remove.isPending}
              onClick={close}
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
