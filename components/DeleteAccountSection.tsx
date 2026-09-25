"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { Loader2, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc-client";

// "حذف حسابي" on /account (linked from the privacy policy as
// /account#delete-account, and required by Google Play for apps with
// accounts). Permanent — the server deletes the account, every file and all
// study data (lib/db-account.ts). The student re-types their email first.
export default function DeleteAccountSection({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const remove = trpc.auth.deleteAccount.useMutation({
    onSuccess: () => signOut({ callbackUrl: "/login?deleted=1" }),
  });
  const matches =
    !!email && confirm.trim().toLowerCase() === email.trim().toLowerCase();

  // The policy links here as /account#delete-account; this section renders
  // after the page loads, so the browser's own anchor jump misses it.
  const sectionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (window.location.hash === "#delete-account") {
      sectionRef.current?.scrollIntoView({ block: "center" });
    }
  }, []);

  return (
    <section id="delete-account" ref={sectionRef} className="account-danger">
      <h2>
        <Trash2 size={18} aria-hidden="true" /> حذف حسابي
      </h2>
      <p>
        يحذف حسابك نهائيًا مع كل ملفاتك وصورها، والملخصات والبطاقات والأسئلة،
        وتقدّمك ومحادثاتك ومشاركاتك. لا يمكن التراجع عن ذلك.
      </p>
      {!open ? (
        <button
          type="button"
          className="account-danger-button"
          onClick={() => setOpen(true)}
        >
          حذف حسابي
        </button>
      ) : (
        <form
          onSubmit={event => {
            event.preventDefault();
            if (matches) remove.mutate({ confirmEmail: confirm });
          }}
        >
          <label>
            للتأكيد اكتب بريدك الإلكتروني: <bdi dir="ltr">{email}</bdi>
            <input
              type="email"
              dir="ltr"
              value={confirm}
              onChange={event => setConfirm(event.target.value)}
              autoComplete="off"
              placeholder={email}
            />
          </label>
          {remove.error && (
            <p className="account-danger-error" role="alert">
              {remove.error.message}
            </p>
          )}
          <div className="account-danger-actions">
            <button
              type="submit"
              className="account-danger-button"
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
              className="secondary-button"
              disabled={remove.isPending}
              onClick={() => {
                setOpen(false);
                setConfirm("");
                remove.reset();
              }}
            >
              إلغاء
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
