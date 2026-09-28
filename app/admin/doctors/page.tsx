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

type Status = "pending" | "approved" | "rejected" | "suspended";

const STATUS_LABELS: Record<Status, string> = {
  pending: "قيد المراجعة",
  approved: "معتمد",
  rejected: "مرفوض",
  suspended: "موقوف",
};

const FILTERS: { value: Status | "all"; label: string }[] = [
  { value: "pending", label: "قيد المراجعة" },
  { value: "approved", label: "معتمدون" },
  { value: "suspended", label: "موقوفون" },
  { value: "rejected", label: "مرفوضون" },
  { value: "all", label: "الكل" },
];

function formatDate(value: string | Date | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("ar-u-nu-latn", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Doctor applications (Protected Doctor Question Sets). Approving grants the
// doctor capability on the SAME account — nothing about the user's login or
// role changes. Suspension closes the doctor's sets for their students at
// once (lib/question-set-access.ts reads the doctor's status per request).
export default function AdminDoctorsPage() {
  const [filter, setFilter] = useState<Status | "all">("pending");
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const utils = trpc.useUtils();
  const doctors = trpc.adminDoctors.list.useQuery(
    filter === "all" ? undefined : { status: filter },
    { retry: false }
  );
  const review = trpc.adminDoctors.review.useMutation({
    onSuccess: () => {
      setRejecting(null);
      setReason("");
      void utils.adminDoctors.list.invalidate();
    },
  });

  if (doctors.error?.data?.code === "NOT_FOUND") {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">الدكاترة</h1>
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
        <h1 className="text-2xl font-bold">الدكاترة</h1>
        <p className="text-sm text-muted-foreground">
          طلبات حساب الدكتور ومراجعتها. الاعتماد يمنح صلاحية إنشاء مجموعات أسئلة
          محمية على نفس الحساب.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map(item => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              filter === item.value
                ? "border-foreground font-semibold"
                : "border-border text-muted-foreground"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {review.error ? (
        <p className="text-sm text-destructive" role="alert">
          {review.error.message}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الدكتور</TableHead>
              <TableHead>الجامعة / الكلية / القسم</TableHead>
              <TableHead>الحساب</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>المجموعات</TableHead>
              <TableHead>التاريخ</TableHead>
              <TableHead>إجراء</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(doctors.data ?? []).map(doctor => (
              <TableRow key={doctor.userId}>
                <TableCell>
                  <div className="font-medium">{doctor.fullName}</div>
                  {doctor.note ? (
                    <div className="max-w-xs text-xs text-muted-foreground">
                      {doctor.note}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell className="text-sm">
                  {doctor.university} / {doctor.faculty} / {doctor.department}
                  {doctor.universityEmail ? (
                    <div dir="ltr" className="text-xs text-muted-foreground">
                      {doctor.universityEmail}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell className="text-sm">
                  {doctor.accountName ?? "—"}
                  {doctor.accountUsername
                    ? ` · @${doctor.accountUsername}`
                    : ""}
                  <div dir="ltr" className="text-xs text-muted-foreground">
                    {doctor.accountEmail ?? ""}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {STATUS_LABELS[doctor.status as Status]}
                  </Badge>
                  {doctor.rejectionReason ? (
                    <div className="text-xs text-muted-foreground">
                      {doctor.rejectionReason}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell>{doctor.setCount}</TableCell>
                <TableCell className="text-sm">
                  {formatDate(doctor.createdAt)}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    {doctor.status === "pending" &&
                      (rejecting === doctor.userId ? (
                        <form
                          className="flex flex-wrap gap-2"
                          onSubmit={event => {
                            event.preventDefault();
                            review.mutate({
                              userId: doctor.userId,
                              action: "reject",
                              reason: reason.trim() || null,
                            });
                          }}
                        >
                          <input
                            aria-label="سبب الرفض"
                            placeholder="سبب الرفض (يظهر للمتقدم)"
                            className="rounded-md border border-border bg-transparent px-2 py-1 text-sm"
                            value={reason}
                            maxLength={500}
                            onChange={event => setReason(event.target.value)}
                          />
                          <button
                            type="submit"
                            className="rounded-md border border-destructive px-2 py-1 text-sm text-destructive"
                          >
                            تأكيد الرفض
                          </button>
                        </form>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={review.isPending}
                            className="rounded-md bg-foreground px-2 py-1 text-sm text-background"
                            onClick={() =>
                              review.mutate({
                                userId: doctor.userId,
                                action: "approve",
                              })
                            }
                          >
                            اعتماد
                          </button>
                          <button
                            type="button"
                            className="rounded-md border border-border px-2 py-1 text-sm"
                            onClick={() => setRejecting(doctor.userId)}
                          >
                            رفض
                          </button>
                        </>
                      ))}
                    {doctor.status === "approved" && (
                      <button
                        type="button"
                        disabled={review.isPending}
                        className="rounded-md border border-destructive px-2 py-1 text-sm text-destructive"
                        onClick={() =>
                          review.mutate({
                            userId: doctor.userId,
                            action: "suspend",
                          })
                        }
                      >
                        إيقاف
                      </button>
                    )}
                    {doctor.status === "suspended" && (
                      <button
                        type="button"
                        disabled={review.isPending}
                        className="rounded-md border border-border px-2 py-1 text-sm"
                        onClick={() =>
                          review.mutate({
                            userId: doctor.userId,
                            action: "reinstate",
                          })
                        }
                      >
                        إعادة التفعيل
                      </button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {doctors.data && !doctors.data.length ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-sm text-muted-foreground"
                >
                  لا توجد طلبات بهذه الحالة.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
