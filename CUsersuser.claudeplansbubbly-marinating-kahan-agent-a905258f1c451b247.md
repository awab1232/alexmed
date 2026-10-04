# Robust Audience Check for Mobile Google Auth

## Objective
Enhance the security and robustness of the audience check in `app/api/mobile/auth/google/route.ts` to pass the `invalid audience → 401` test and ensure proper verification.

## Implementation Steps
1.  **Refactor Audience Verification**:
    -   Validate that `tokenData.aud` exists and is equal to `process.env.GOOGLE_CLIENT_ID`.
    -   Validate that `tokenData.iss` exists and is one of the expected Google issuer URLs (`https://accounts.google.com` or `accounts.google.com`).
    -   Return a 401 response if any verification fails.

2.  **Ensure Robustness**:
    -   Add strict type checking for `tokenData` to ensure `aud` and `iss` are strings.
    -   Handle missing `aud` or `iss` as an invalid token (401).

3.  **Testing**:
    -   Verify that `app/api/mobile/auth/google/route.test.ts` passes the updated implementation.
    -   Add a test case for invalid issuer `iss`.

## Critical Files
- C:\Users\user\Desktop\study-card-maker\app\api\mobile\auth\google\route.ts
- C:\Users\user\Desktop\study-card-maker\app\api\mobile\auth\google\route.test.ts
