import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createTestDb, type TestDb } from "@/lib/test-fixtures/pglite-db";
import {
  IDS,
  seedPeople,
  simulatePipelineDone,
  TEST_HMAC_KEY,
} from "@/lib/test-fixtures/question-sets";

const holder = vi.hoisted(() => ({
  db: null as unknown,
  session: null as null | { user: { id: string; role?: string } },
}));
vi.mock("@/lib/db", () => ({
  getDb: () => holder.db,
  requireDb: () => holder.db,
}));
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => holder.session) }));
vi.mock("@/lib/storage", () => ({
  storageGetSignedUrl: vi
    .fn()
    .mockResolvedValue(
      "https://signed.example/question-files/secret.png?sig=1"
    ),
}));

import {
  createQuestionSet,
  generateAccessCodes,
  publishQuestionSet,
  redeemAccessCode,
  revokeStudentAccess,
  listSetStudents,
} from "@/lib/db-question-sets";
import { GET } from "./route";

let test: TestDb;
let setId: string;
let imageId: string;
let otherImageId: string;

function get(set: string, image: string) {
  return GET(
    new Request(`http://localhost/api/question-sets/${set}/images/${image}`),
    {
      params: Promise.resolve({ setId: set, imageId: image }),
    }
  );
}

beforeAll(async () => {
  process.env.QUESTION_SET_CODE_HMAC_KEY = TEST_HMAC_KEY;
  test = await createTestDb();
  holder.db = test.db;
  await seedPeople(test.client);
  const set = await createQuestionSet(
    IDS.doctorA,
    { title: "Histology", visibility: "unlisted" },
    { fileName: "h.pdf", fileKey: "k" }
  );
  setId = set.id;
  imageId = (await simulatePipelineDone(test.client, set.bookId)).imageId;
  await publishQuestionSet(IDS.doctorA, set.id);
  const [code] = (await generateAccessCodes(IDS.doctorA, set.id, 1))!.codes;
  await redeemAccessCode(IDS.student1, code, null);

  // An image belonging to a different doctor's book.
  const other = await createQuestionSet(
    IDS.doctorB,
    { title: "Other", visibility: "unlisted" },
    { fileName: "o.pdf", fileKey: "k2" }
  );
  otherImageId = (await simulatePipelineDone(test.client, other.bookId))
    .imageId;
}, 60_000);

beforeEach(() => {
  process.env.DOCTOR_SETS_ENABLED = "true";
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response("PNG", {
          status: 200,
          headers: { "content-type": "image/png" },
        })
    )
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("GET /api/question-sets/[setId]/images/[imageId]", () => {
  it("streams the image to an entitled student, no-store, with no redirect or signed URL", async () => {
    holder.session = { user: { id: IDS.student1 } };
    const response = await get(setId, imageId);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("location")).toBeNull();
    expect(JSON.stringify([...response.headers])).not.toContain(
      "signed.example"
    );
    expect(await response.text()).toBe("PNG");
  });

  it("serves the owner and an admin", async () => {
    holder.session = { user: { id: IDS.doctorA } };
    expect((await get(setId, imageId)).status).toBe(200);
    holder.session = { user: { id: IDS.admin, role: "admin" } };
    expect((await get(setId, imageId)).status).toBe(200);
  });

  it("404s a user without an entitlement, and never fetches storage", async () => {
    holder.session = { user: { id: IDS.student2 } };
    const response = await get(setId, imageId);
    expect(response.status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("404s another book's image through this set's id", async () => {
    holder.session = { user: { id: IDS.student1 } };
    expect((await get(setId, otherImageId)).status).toBe(404);
  });

  it("401s without a session and 404s malformed ids", async () => {
    holder.session = null;
    expect((await get(setId, imageId)).status).toBe(401);
    holder.session = { user: { id: IDS.student1 } };
    expect((await get("../../etc", imageId)).status).toBe(404);
  });

  it("404s everything while the feature is off", async () => {
    process.env.DOCTOR_SETS_ENABLED = "false";
    holder.session = { user: { id: IDS.doctorA } };
    expect((await get(setId, imageId)).status).toBe(404);
  });

  it("stops at once when the student is revoked", async () => {
    holder.session = { user: { id: IDS.student1 } };
    expect((await get(setId, imageId)).status).toBe(200);
    const [row] = await listSetStudents(IDS.doctorA, setId);
    await revokeStudentAccess(
      { id: IDS.doctorA, role: "doctor" },
      row.entitlementId
    );
    expect((await get(setId, imageId)).status).toBe(404);
  });
});
