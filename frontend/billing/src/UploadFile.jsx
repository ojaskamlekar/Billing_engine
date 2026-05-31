import { useRef, useState } from "react";
import axios from "axios";

const API_BASE = "http://127.0.0.1:8000";

function UploadFile({ onUploaded }) {
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [plan, setPlan] = useState("Pro");
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("plan", plan);

      await axios.post(`${API_BASE}/upload`, formData);

      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onUploaded?.();
      alert("Uploaded successfully!");
    } catch (err) {
      console.error(err);
      alert("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="mt-6 flex flex-col gap-4 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/80 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 text-left sm:flex-row sm:items-center">
          <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50">
            Choose file
            <input
              ref={fileInputRef}
              type="file"
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <span className="truncate text-sm text-slate-500">
            {file ? file.name : "No file selected"}
          </span>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="text-left text-sm font-medium text-slate-700">
            Billing plan
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:w-40"
            >
              <option>Free</option>
              <option>Pro</option>
              <option>Enterprise</option>
            </select>
          </label>

          <button
            type="button"
            onClick={handleUpload}
            disabled={!file || isUploading}
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 sm:mt-6"
          >
            {isUploading ? "Uploading…" : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default UploadFile;
