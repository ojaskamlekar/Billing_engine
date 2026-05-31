import React from "react";

function FileIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / 1024 ** i;
  return `${value.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

function parseUploadDate(value) {
  if (!value) return null;
  const date = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(iso) {
  const date = parseUploadDate(iso);
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function UsageLogsTab({ usage, loading }) {
  return (
    <div className="space-y-6">
      
      {/* Usage Logs Table */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm text-left">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Usage Logs</h2>
          <p className="text-sm text-slate-500">
            All uploaded objects and their metered storage details.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500"
                >
                  File Name
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500"
                >
                  File Size
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500"
                >
                  Plan
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500"
                >
                  Upload Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-12 text-center text-sm text-slate-500 animate-pulse"
                  >
                    Loading usage data…
                  </td>
                </tr>
              ) : usage.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-12 text-center text-sm text-slate-500"
                  >
                    No files uploaded yet.
                  </td>
                </tr>
              ) : (
                usage.map((file) => (
                  <tr
                    key={file.id}
                    className="transition-colors hover:bg-slate-50/80"
                  >
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                          <FileIcon />
                        </span>
                        <span className="max-w-xs truncate text-sm font-medium text-slate-900 sm:max-w-md">
                          {file.filename}
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                      {formatBytes(file.filesize)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                      {file.plan}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                      {formatDate(file.uploaded_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      
    </div>
  );
}
