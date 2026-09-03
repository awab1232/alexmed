// Direct S3-compatible storage (MinIO locally, any real S3-compatible bucket in
// production), replacing the Manus Forge presign proxy. Uploads go straight to
// the bucket from the server; downloads are served via a short-lived signed URL
// through /api/files/[...key] (redirect), mirroring the old /manus-storage/* path.
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function getS3Client() {
  const endpoint = process.env.STORAGE_ENDPOINT;
  const region = process.env.STORAGE_REGION || "us-east-1";
  const accessKeyId = process.env.STORAGE_ACCESS_KEY;
  const secretAccessKey = process.env.STORAGE_SECRET_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Storage config missing: set STORAGE_ENDPOINT, STORAGE_ACCESS_KEY and STORAGE_SECRET_KEY"
    );
  }

  return new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true, // required for MinIO / most non-AWS S3-compatible endpoints
  });
}

function getBucket() {
  const bucket = process.env.STORAGE_BUCKET;
  if (!bucket) throw new Error("Storage config missing: set STORAGE_BUCKET");
  return bucket;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const client = getS3Client();
  const bucket = getBucket();
  const key = appendHashSuffix(normalizeKey(relKey));

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: data,
      ContentType: contentType,
    })
  );

  return { key, url: `/api/files/${key}` };
}

export async function storageGet(
  relKey: string
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/api/files/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const client = getS3Client();
  const bucket = getBucket();
  const key = normalizeKey(relKey);

  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    {
      expiresIn: 300,
    }
  );
}

// Lets the browser PUT the raw file straight to the bucket, bypassing our
// server entirely for the large-bytes part — needed because Vercel Serverless
// Functions reject request bodies over ~4.5MB before our code ever runs, so a
// large PDF can never reach a route handler as multipart form data the way it
// could reach the old Express server. The key is decided up front (by the
// caller, e.g. the /api/pdf/upload-url route) rather than hashed post-hoc like
// storagePut() does, since the browser needs to know the exact key before it
// uploads.
export async function storageGetUploadUrl(
  relKey: string,
  contentType = "application/octet-stream"
): Promise<string> {
  const client = getS3Client();
  const bucket = getBucket();
  const key = normalizeKey(relKey);

  return getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
    { expiresIn: 900 }
  );
}
