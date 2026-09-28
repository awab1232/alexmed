"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc-client";
import {
  AUDIT_EVENT_LABELS,
  formatDateTime,
  setStatusLabel,
} from "@/components/doctor-sets/labels";

// Protected question sets across all doctors: inspect, disable / enable,
// archive, and each set's audit trail. Admin actions go through the same
// data functions and access rule as the doctor's, and are audited.
export default function AdminQuestionSetsPage() {
  const utils = trpc.useUtils();
  const sets = trpc.adminQuestionSets.list.useQuery(undefined, {
    retry: false,
  });
  const [openAudit, setOpenAudit] = useState<string | null>(null);
  const audit = trpc.adminQuestionSets.audit.useQuery(
    { setId: openAudit ?? "" },
    { enabled: !!openAudit }
  );
  const refresh = () => utils.adminQuestionSets.list.invalidate();
  const disable = trpc.adminQuestionSets.disable.useMutation({
    onSuccess: refresh,
  });
  const enable = trpc.adminQuestionSets.enable.useMutation({
    onSuccess: refresh,
  });
  const archive = trpc.adminQuestionSets.archive.useMutation({
    onSuccess: refresh,
  });
  const error = disable.error ?? enable.error ?? archive.error;

  if (sets.error?.data?.code === "NOT_FOUND") {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">المجموعات المحمية</h1>
        <p className="text-sm text-muted-foreground">
          ميزة مجموعات الدكاترة المحمية غير مفعّلة على الخادم
          (DOCTOR_SETS_ENABLED).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">المجموعات المحمية</h1>
        <p className="text-sm text-muted-foreground">
          مجموعات أسئلة الدكاترة. التعطيل من هنا يوقف وصول كل الطلاب فورًا، ولا
          يستطيع الدكتور رفعه.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error.message}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>المجموعة</TableHead>
              <TableHead>الدكتور</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>أسئلة</TableHead>
              <TableHead>أكواد</TableHead>
              <TableHead>طلاب</TableHead>
              <TableHead>إجراء</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(sets.data ?? []).map(set => (
              <TableRow key={set.id}>
                <TableCell>
                  <div className="font-medium">{set.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {set.visibility === "listed" ? "مدرجة" : "غير مدرجة"} ·{" "}
                    {formatDateTime(set.createdAt)}
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  {set.doctorName ?? "—"}
                  {set.doctorStatus && set.doctorStatus !== "approved" ? (
                    <div className="text-xs text-destructive">
                      الدكتور: {set.doctorStatus}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{setStatusLabel(set).label}</Badge>
                  {set.disabledByRole === "admin" ? (
                    <div className="text-xs text-muted-foreground">
                      معطّلة من الإدارة
                    </div>
                  ) : null}
                </TableCell>
                <TableCell>
                  {set.status === "draft"
                    ? set.extractedQuestions
                    : set.questionCount}
                </TableCell>
                <TableCell>
                  {set.codesClaimed}/{set.codesTotal}
                </TableCell>
                <TableCell>{set.activeStudents}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    {set.status === "published" && (
                      <button
                        type="button"
                        className="rounded-md border border-destructive px-2 py-1 text-sm text-destructive"
                        onClick={() => disable.mutate({ setId: set.id })}
                      >
                        تعطيل
                      </button>
                    )}
                    {set.status === "disabled" && (
                      <button
                        type="button"
                        className="rounded-md border border-border px-2 py-1 text-sm"
                        onClick={() => enable.mutate({ setId: set.id })}
                      >
                        تفعيل
                      </button>
                    )}
                    {set.status !== "archived" && (
                      <button
                        type="button"
                        className="rounded-md border border-border px-2 py-1 text-sm"
                        onClick={() => archive.mutate({ setId: set.id })}
                      >
                        أرشفة
                      </button>
                    )}
                    <button
                      type="button"
                      className="rounded-md border border-border px-2 py-1 text-sm"
                      onClick={() =>
                        setOpenAudit(openAudit === set.id ? null : set.id)
                      }
                    >
                      السجل
                    </button>
                  </div>
                  {openAudit === set.id && (
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {(audit.data ?? []).map(event => (
                        <li key={event.id}>
                          {AUDIT_EVENT_LABELS[event.event] ?? event.event} ·{" "}
                          {event.actorUsername
                            ? `@${event.actorUsername}`
                            : (event.actorName ?? "—")}{" "}
                          · {formatDateTime(event.createdAt)}
                        </li>
                      ))}
                    </ul>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {sets.data && !sets.data.length ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-sm text-muted-foreground"
                >
                  لا توجد مجموعات بعد.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
