import { useState, useEffect } from "react";
import { 
  FileText, 
  FileSpreadsheet, 
  FileImage, 
  FileVideo, 
  FileArchive, 
  FileCode, 
  File, 
  Binary, 
  FolderOpen, 
  Upload 
} from "lucide-react";
import { API_BASE } from "./api";

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
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getFileTypeIcon(filename) {
  if (!filename) return <File className="h-5 w-5 text-slate-400 shrink-0" />;
  const ext = filename.split(".").pop().toLowerCase();
  if (ext === "pdf") return <FileText className="h-5 w-5 text-red-500 shrink-0" />;
  if (["xls", "xlsx", "csv"].includes(ext)) {
    return <FileSpreadsheet className="h-5 w-5 text-emerald-500 shrink-0" />;
  }
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) {
    return <FileImage className="h-5 w-5 text-blue-500 shrink-0" />;
  }
  if (["mp4", "mkv", "avi", "mov"].includes(ext)) {
    return <FileVideo className="h-5 w-5 text-amber-500 shrink-0" />;
  }
  if (["zip", "rar", "tar", "gz", "7z"].includes(ext)) {
    return <FileArchive className="h-5 w-5 text-purple-500 shrink-0" />;
  }
  if (["js", "ts", "jsx", "tsx", "py", "java", "cpp", "html", "css", "json"].includes(ext)) {
    return <FileCode className="h-5 w-5 text-indigo-500 shrink-0" />;
  }
  if (["exe", "dmg", "iso", "bin"].includes(ext)) {
    return <Binary className="h-5 w-5 text-pink-500 shrink-0" />;
  }
  return <File className="h-5 w-5 text-slate-400 shrink-0" />;
}

function FileIconComponent({ filename }) {
  return getFileTypeIcon(filename);
}

export default function UsageLogsTab({ usage, loading, filters, onFiltersChange, onUploadClick, onDelete }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [completedDownloadId, setCompletedDownloadId] = useState(null);
  const [toast, setToast] = useState(null);

  // Destructure lifted filters
  const { searchQuery, fileType, planFilter, fromDate, toDate, sortBy, currentPage } = filters;
  const pageSize = 10;

  // Local state for debouncing the search input
  const [tempSearch, setTempSearch] = useState(searchQuery);
  const [isSearching, setIsSearching] = useState(false);

  // Synchronize tempSearch if searchQuery is reset from parent
  useEffect(() => {
    setTempSearch(searchQuery);
  }, [searchQuery]);

  // Debounce logic for search
  useEffect(() => {
    if (tempSearch === searchQuery) {
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const handler = setTimeout(() => {
      updateFilters({ searchQuery: tempSearch, currentPage: 1 });
      setIsSearching(false);
    }, 500);

    return () => clearTimeout(handler);
  }, [tempSearch]);

  // Helper to update filters state in parent
  const updateFilters = (updates) => {
    onFiltersChange((prev) => ({ ...prev, ...updates }));
  };

  // Auto-dismiss toast after 4 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const confirmDelete = (file) => {
    setFileToDelete(file);
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    if (!fileToDelete) return;
    const targetId = fileToDelete.id;
    setDeletingId(targetId);
    setShowConfirm(false);

    const result = await onDelete(targetId);

    setDeletingId(null);
    if (result && result.success) {
      setToast({ message: "File deleted successfully.", type: "success" });
    } else {
      setToast({ message: "Unable to delete file.", type: "error" });
    }
    setFileToDelete(null);
  };

  // Trigger file download
  const handleDownload = async (file, isRetry = false) => {
    if (downloadingId !== null && !isRetry) return;

    setDownloadingId(file.id);
    setDownloadProgress({
      filename: file.filename,
      percent: 0,
      loaded: 0,
      total: file.filesize || 0,
      speed: 0,
      eta: null,
      status: "downloading"
    });

    const token = localStorage.getItem("access_token");
    const headers = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const url = `${API_BASE}/download/${file.id}`;
      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const contentLengthHeader = response.headers.get("content-length");
      const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : (file.filesize || 0);

      const reader = response.body.getReader();
      const chunks = [];
      let loadedBytes = 0;
      const startTime = Date.now();
      let lastUpdate = Date.now();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        loadedBytes += value.length;

        const now = Date.now();
        if (now - lastUpdate > 100 || loadedBytes === totalBytes) {
          const elapsed = (now - startTime) / 1000;
          const speed = elapsed > 0 ? (loadedBytes / elapsed) : 0;
          const percent = totalBytes > 0 ? Math.min((loadedBytes / totalBytes) * 100, 100) : 0;
          const remainingBytes = totalBytes - loadedBytes;
          const eta = (speed > 0 && remainingBytes > 0) ? Math.ceil(remainingBytes / speed) : null;

          setDownloadProgress({
            filename: file.filename,
            percent,
            loaded: loadedBytes,
            total: totalBytes,
            speed,
            eta,
            status: "downloading"
          });
          lastUpdate = now;
        }
      }

      const blob = new Blob(chunks, { type: response.headers.get("content-type") || "application/octet-stream" });
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = blobUrl;
      link.setAttribute("download", file.filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      setCompletedDownloadId(file.id);
      setDownloadProgress({
        filename: file.filename,
        percent: 100,
        loaded: totalBytes,
        total: totalBytes,
        speed: 0,
        eta: 0,
        status: "complete"
      });

      setToast({ message: "✓ Download Complete", type: "success" });

      setTimeout(() => {
        setDownloadingId(null);
        setDownloadProgress(null);
        setCompletedDownloadId(null);
      }, 2000);

    } catch (err) {
      console.error("Failed to download file:", err);
      
      setDownloadProgress({
        filename: file.filename,
        percent: 0,
        loaded: 0,
        total: file.filesize || 0,
        speed: 0,
        eta: null,
        status: "failed"
      });

      setToast({
        message: (
          <div className="flex items-center justify-between gap-3 w-full">
            <span>Failed to download file.</span>
            <button
              onClick={() => handleDownload(file, true)}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs px-2.5 py-1 rounded transition cursor-pointer"
            >
              Retry
            </button>
          </div>
        ),
        type: "error"
      });
      
      setDownloadingId(null);
    }
  };

  // Helper: check file type category
  const getFileTypeCategory = (filename) => {
    if (!filename) return "Others";
    const ext = filename.split('.').pop().toLowerCase();
    if (ext === "pdf") return "PDF";
    if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return "Images";
    if (["doc", "docx", "txt", "ppt", "pptx", "xls", "xlsx"].includes(ext)) return "Documents";
    if (["zip", "rar", "7z"].includes(ext)) return "Archives";
    return "Others";
  };

  // Reset all filters
  const resetFilters = () => {
    setTempSearch("");
    updateFilters({
      searchQuery: "",
      fileType: "All",
      planFilter: "All",
      fromDate: "",
      toDate: "",
      sortBy: "Newest",
      currentPage: 1
    });
  };

  // Highlight search text match helper
  const highlightText = (text, highlight) => {
    if (!highlight || !highlight.trim()) {
      return <span>{text}</span>;
    }
    const regex = new RegExp(`(${highlight.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')})`, "gi");
    const parts = text.split(regex);
    return (
      <span>
        {parts.map((part, index) =>
          regex.test(part) ? (
            <mark key={index} className="bg-amber-100 text-amber-900 rounded-[2px] px-0.5 font-bold transition-all duration-300">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  // Perform client-side filtering
  const filteredUsage = usage.filter((file) => {
    // 1. Search Query
    if (searchQuery && !file.filename.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    // 2. File Type Dropdown
    if (fileType !== "All") {
      const category = getFileTypeCategory(file.filename);
      if (category !== fileType) {
        return false;
      }
    }
    // 3. Plan Dropdown
    if (planFilter !== "All") {
      if (file.plan?.toLowerCase() !== planFilter.toLowerCase()) {
        return false;
      }
    }
    // 4. Date Range
    const uploadDate = parseUploadDate(file.uploaded_at);
    if (uploadDate) {
      if (fromDate) {
        const start = new Date(fromDate + "T00:00:00");
        if (uploadDate < start) return false;
      }
      if (toDate) {
        const end = new Date(toDate + "T23:59:59");
        if (uploadDate > end) return false;
      }
    }
    return true;
  });

  // Perform client-side sorting
  const sortedUsage = [...filteredUsage].sort((a, b) => {
    switch (sortBy) {
      case "Newest": {
        const dA = parseUploadDate(a.uploaded_at) || new Date(0);
        const dB = parseUploadDate(b.uploaded_at) || new Date(0);
        return dB - dA;
      }
      case "Oldest": {
        const dA = parseUploadDate(a.uploaded_at) || new Date(0);
        const dB = parseUploadDate(b.uploaded_at) || new Date(0);
        return dA - dB;
      }
      case "Largest":
        return b.filesize - a.filesize;
      case "Smallest":
        return a.filesize - b.filesize;
      case "A-Z":
        return a.filename.localeCompare(b.filename);
      case "Z-A":
        return b.filename.localeCompare(a.filename);
      default:
        return 0;
    }
  });

  // Client-side pagination calculations
  const totalItems = sortedUsage.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedUsage = sortedUsage.slice(startIndex, endIndex);

  // Check if any filter is active (to show Reset button)
  const isFilterActive = searchQuery !== "" || fileType !== "All" || planFilter !== "All" || fromDate !== "" || toDate !== "" || sortBy !== "Newest";

  const showEmpty = (usage.length === 0 || totalItems === 0) && !loading;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      
      {/* Storage Explorer Card */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm text-left">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Storage Explorer</h2>
          <p className="text-sm text-slate-500">
            Browse, search, filter, and manage all uploaded objects in your storage bucket.
          </p>
        </div>

        {/* Professional Filter Toolbar */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4 items-end">
            
            {/* Search Bar (50% wider, primary focus element) */}
            <div className="lg:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 text-left">Search</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search files by name..."
                  value={tempSearch}
                  onChange={(e) => setTempSearch(e.target.value)}
                  autoFocus={true}
                  className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-4 py-2.5 text-sm text-slate-800 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600 outline-none transition focus:shadow-sm focus:scale-[1.01]"
                />
                {isSearching ? (
                  <svg className="absolute left-3 top-3.5 h-4 w-4 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                )}
              </div>
            </div>

            {/* File Type Dropdown */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 text-left">File Type</label>
              <select
                value={fileType}
                onChange={(e) => updateFilters({ fileType: e.target.value, currentPage: 1 })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600 outline-none transition cursor-pointer"
              >
                <option value="All">All Types</option>
                <option value="PDF">PDF</option>
                <option value="Images">Images</option>
                <option value="Documents">Documents</option>
                <option value="Archives">Archives</option>
                <option value="Others">Others</option>
              </select>
            </div>

            {/* Plan Dropdown */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 text-left">Plan</label>
              <select
                value={planFilter}
                onChange={(e) => updateFilters({ planFilter: e.target.value, currentPage: 1 })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600 outline-none transition cursor-pointer"
              >
                <option value="All">All Plans</option>
                <option value="Free">Free</option>
                <option value="Pro">Pro</option>
                <option value="Enterprise">Enterprise</option>
              </select>
            </div>

            {/* From Date */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 text-left">From</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => updateFilters({ fromDate: e.target.value, currentPage: 1 })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600 outline-none transition cursor-pointer"
              />
            </div>

            {/* To Date */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 text-left">To</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => updateFilters({ toDate: e.target.value, currentPage: 1 })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600 outline-none transition cursor-pointer"
              />
            </div>

            {/* Sort Dropdown */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 text-left">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => updateFilters({ sortBy: e.target.value, currentPage: 1 })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600 outline-none transition cursor-pointer"
              >
                <option value="Newest">Newest</option>
                <option value="Oldest">Oldest</option>
                <option value="Largest">Largest</option>
                <option value="Smallest">Smallest</option>
                <option value="A-Z">A-Z</option>
                <option value="Z-A">Z-A</option>
              </select>
            </div>

          </div>

          {/* Reset Filters Button */}
          {isFilterActive && (
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition cursor-pointer"
              >
                <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3-3 3 3m-3-3v12" />
                </svg>
                Reset Filters
              </button>
            </div>
          )}
        </div>

        {/* Main Content Area */}
        {showEmpty ? (
          /* Better Empty State: No uploaded files OR filters returned zero results */
          <div className="py-20 text-center text-slate-500 bg-white flex flex-col items-center justify-center animate-in fade-in duration-300">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-50 text-slate-400 mb-5 shadow-inner animate-pulse">
              <FolderOpen className="h-12 w-12 text-slate-300" />
            </div>
            <p className="text-lg font-bold text-slate-900">No files found</p>
            <p className="text-sm text-slate-500 mt-1 max-w-sm">
              Upload your first file or change your filters.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={onUploadClick}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 transition cursor-pointer transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <Upload className="h-4 w-4" />
                Upload File
              </button>
              {isFilterActive && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-955 transition cursor-pointer"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Usage logs list table */
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 text-left"
                  >
                    File Name
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 text-left"
                  >
                    File Size
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 text-left"
                  >
                    Plan
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 text-left"
                  >
                    Upload Date
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 text-right"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className={`divide-y divide-slate-100 bg-white transition-opacity duration-300 ${isSearching ? "opacity-60" : "opacity-100"}`}>
                {loading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-12 text-center text-sm text-slate-500 animate-pulse"
                    >
                      Loading usage data…
                    </td>
                  </tr>
                ) : (
                  paginatedUsage.map((file) => (
                    <tr
                      key={file.id}
                      className={`transition-all duration-200 ease-out hover:bg-slate-50/70 hover:shadow-xs border-l-2 border-transparent hover:border-indigo-500 ${
                        deletingId === file.id ? "animate-row-delete" : ""
                      }`}
                    >
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50 border border-slate-100">
                            <FileIconComponent filename={file.filename} />
                          </span>
                          <span 
                            onClick={() => handleDownload(file)}
                            className="max-w-xs truncate text-sm font-semibold text-slate-900 hover:underline cursor-pointer block text-left sm:max-w-md transition-colors hover:text-indigo-600"
                          >
                            {highlightText(file.filename, searchQuery)}
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600 font-medium">
                        {formatBytes(file.filesize)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                        {file.plan}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                        {formatDate(file.uploaded_at)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Download Button */}
                          <button
                            disabled={(downloadingId !== null && downloadingId !== file.id) || completedDownloadId === file.id || deletingId !== null}
                            onClick={() => handleDownload(file)}
                            className={`inline-flex items-center justify-center p-2 rounded-lg transition-colors cursor-pointer ${
                              downloadingId === file.id
                                ? "text-purple-600 cursor-not-allowed bg-slate-50 animate-pulse"
                                : completedDownloadId === file.id
                                ? "text-emerald-600 bg-emerald-50 cursor-default"
                                : (downloadingId !== null || deletingId !== null)
                                ? "text-slate-300 cursor-not-allowed"
                                : "text-slate-500 hover:text-purple-600 hover:bg-purple-50"
                            }`}
                            title={completedDownloadId === file.id ? "✓ Download Complete" : "Download File"}
                            aria-label={`Download ${file.filename}`}
                          >
                            {downloadingId === file.id ? (
                              <svg className="animate-spin h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                            ) : completedDownloadId === file.id ? (
                              <svg className="h-5 w-5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                            )}
                          </button>

                          {/* Delete Button */}
                          {onDelete && (
                            <button
                              disabled={deletingId !== null || downloadingId !== null}
                              onClick={() => confirmDelete(file)}
                              className={`inline-flex items-center justify-center p-2 rounded-lg transition-colors cursor-pointer ${
                                deletingId === file.id
                                  ? "text-red-500 cursor-not-allowed bg-slate-50"
                                  : deletingId !== null || downloadingId !== null
                                  ? "text-slate-300 cursor-not-allowed"
                                  : "text-slate-500 hover:text-red-600 hover:bg-red-50"
                              }`}
                              title="Delete File"
                              aria-label={`Delete ${file.filename}`}
                            >
                              {deletingId === file.id ? (
                                <svg className="animate-spin h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                              ) : (
                                <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {usage.length > 0 && totalItems > 0 && (
          <div className="px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/30">
            <div className="text-xs text-slate-500">
              Showing <span className="font-semibold text-slate-800">{startIndex + 1}</span> to{" "}
              <span className="font-semibold text-slate-800">{endIndex}</span> of{" "}
              <span className="font-semibold text-slate-800">{totalItems}</span> files
              {isFilterActive && " (filtered)"}
            </div>
            
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => updateFilters({ currentPage: Math.max(1, currentPage - 1) })}
                className={`rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition cursor-pointer select-none ${
                  currentPage === 1 ? "opacity-50 cursor-not-allowed bg-slate-50" : "hover:bg-slate-50 hover:text-slate-955"
                }`}
              >
                Previous
              </button>
              
              <span className="text-xs text-slate-500 font-medium px-2">
                Page <span className="font-semibold text-slate-800">{currentPage}</span> of{" "}
                <span className="font-semibold text-slate-800">{totalPages}</span>
              </span>

              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => updateFilters({ currentPage: Math.min(totalPages, currentPage + 1) })}
                className={`rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition cursor-pointer select-none ${
                  currentPage === totalPages ? "opacity-50 cursor-not-allowed bg-slate-50" : "hover:bg-slate-50 hover:text-slate-955"
                }`}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 text-left">
            <h3 className="text-lg font-semibold text-slate-900">Delete File</h3>
            <p className="mt-2 text-sm text-slate-500">
              Are you sure you want to permanently delete this file?
            </p>
            {fileToDelete && (
              <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs font-medium text-slate-700 truncate">
                Filename: {fileToDelete.filename}
              </div>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowConfirm(false);
                  setFileToDelete(null);
                }}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Real-time Download Progress Dialog Overlay */}
      {downloadProgress && (
        <div className="fixed bottom-6 left-6 z-50 flex w-full max-w-sm flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl ring-1 ring-black/5 animate-in slide-in-from-left-5 duration-300 text-left">
          <div className="flex items-start justify-between mb-3">
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-bold text-slate-800 truncate">
                {downloadProgress.status === "complete" ? "✓ Download Complete" : "Downloading file..."}
              </h4>
              <p className="text-xs text-slate-400 truncate mt-0.5 font-mono">{downloadProgress.filename}</p>
            </div>
            {downloadProgress.status === "downloading" && (
              <span className="text-xs font-bold text-purple-600 bg-purple-50 border border-purple-100 rounded px-1.5 py-0.5 animate-pulse">
                Active
              </span>
            )}
          </div>

          {/* Progress Bar Container */}
          <div className="space-y-2">
            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden relative">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  downloadProgress.status === "complete" ? "bg-emerald-500" : "bg-purple-600"
                }`}
                style={{ width: `${downloadProgress.percent}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-xs text-slate-500 font-semibold">
              <span>{downloadProgress.percent.toFixed(0)}%</span>
              <span>{formatBytes(downloadProgress.loaded)} / {formatBytes(downloadProgress.total)}</span>
            </div>
          </div>

          {/* Transfer stats: Speed & ETA */}
          {downloadProgress.status === "downloading" && (
            <div className="mt-3.5 pt-3 border-t border-slate-100 flex justify-between text-[11px] text-slate-400 font-semibold">
              <div className="flex items-center gap-1">
                <span>Speed:</span>
                <span className="text-slate-600 font-bold font-mono">
                  {downloadProgress.speed > 0 ? `${(downloadProgress.speed / (1024 * 1024)).toFixed(1)} MB/s` : "Calculating..."}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span>ETA:</span>
                <span className="text-slate-600 font-bold">
                  {downloadProgress.eta !== null ? `${downloadProgress.eta}s remaining` : "Calculating..."}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-xl ring-1 ring-black/5 animate-in slide-in-from-bottom-5 duration-300">
          <div className="flex items-center gap-3">
            {toast.type === "success" ? (
              <svg className="h-5 w-5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="h-5 w-5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <p className="text-sm font-medium text-slate-800">{toast.message}</p>
          </div>
          <button
            onClick={() => setToast(null)}
            className="ml-auto pl-3 text-slate-400 hover:text-slate-600 transition cursor-pointer"
            aria-label="Close toast"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      
    </div>
  );
}
