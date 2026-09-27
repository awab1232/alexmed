// Storage keys for student uploads carry the uploader's id:
//   "{prefix}/{userId}/{uuid}-{safe file name}"
// The browser PUTs the file itself and then sends the key back to a
// processing route, so the key is client input. Binding it to the user who
// was issued it stops one student from submitting another student's key
// (e.g. one seen through a share) and so gaining lasting access to — or
// deleting — a file that isn't theirs.
import { randomUUID } from "node:crypto";

export const STUDENT_UPLOAD_PREFIXES = ["book-pdfs", "study-pdfs"] as const;
export type StudentUploadPrefix = (typeof STUDENT_UPLOAD_PREFIXES)[number];

export function newUploadKey(
  prefix: StudentUploadPrefix,
  userId: string,
  fileName: string
) {
  return `${prefix}/${userId}/${randomUUID()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const OWN_KEY = new RegExp(
  `^(${STUDENT_UPLOAD_PREFIXES.join("|")})/(${UUID})/${UUID}-[a-zA-Z0-9._-]+$`,
  "i"
);

// True only for a key issued to this user by newUploadKey. Keys from before
// this format (no user segment) are refused — they were only ever valid for
// the few minutes between upload and processing.
export function isOwnUploadKey(
  key: string,
  userId: string,
  prefix?: StudentUploadPrefix
) {
  const match = OWN_KEY.exec(key);
  if (!match) return false;
  if (prefix && match[1] !== prefix) return false;
  return match[2].toLowerCase() === userId.toLowerCase();
}
