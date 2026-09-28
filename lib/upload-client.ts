"use client";

// plain fetch() gives no upload-progress events at all, so a large file on a
// slow connection just sits at a static spinner for however long the PUT
// takes — indistinguishable from a genuine hang. A real student hit exactly
// this (40MB, ~10 minutes, no visible movement) and navigated away thinking
// it had frozen, which killed the in-flight upload with no error ever shown
// (the component was already unmounted by then). XMLHttpRequest is the only
// browser API that exposes real upload-progress events for a PUT body.
export function putFileWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = event => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else
        reject(
          new Error("تعذر رفع الملف للتخزين. تحقق من الاتصال وحاول مرة أخرى.")
        );
    };
    xhr.onerror = () =>
      reject(
        new Error("تعذر رفع الملف للتخزين. تحقق من الاتصال وحاول مرة أخرى.")
      );
    xhr.send(file);
  });
}
