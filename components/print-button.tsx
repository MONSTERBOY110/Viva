"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print -my-2 py-2 underline decoration-rule underline-offset-4 transition-colors hover:text-quill"
    >
      print
    </button>
  );
}
