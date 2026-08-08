"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print underline decoration-rule underline-offset-4 transition-colors hover:text-quill"
    >
      print
    </button>
  );
}
