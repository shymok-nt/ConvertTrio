"use client";

import { useEffect, useRef, useState } from "react";
import { transformImage, type OutputFormat } from "@/lib/image-transform";

type QueueStatus = "ready" | "converting" | "done" | "error";
type QueueItem = { id: number; file: File; format: OutputFormat; status: QueueStatus; progress: number; output?: { url: string; name: string; size: number }; error?: string };
const formats: { value: OutputFormat; label: string; extension: string }[] = [
  { value: "image/png", label: "PNG", extension: "png" },
  { value: "image/jpeg", label: "JPG", extension: "jpg" },
  { value: "image/webp", label: "WebP", extension: "webp" },
];
const MAX_BYTES = 20 * 1024 * 1024;
const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/bmp", "image/x-ms-bmp", "image/avif"]);
const formatBytes = (bytes: number) => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(2)} MB`;
const fileIsSupported = (file: File) => (allowedTypes.has(file.type) || /\.(bmp|avif)$/i.test(file.name)) && file.size > 0 && file.size <= MAX_BYTES;

export default function HomePage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [notice, setNotice] = useState("");
  const [dragging, setDragging] = useState(false);
  const [working, setWorking] = useState(false);
  const [defaultFormat, setDefaultFormat] = useState<OutputFormat>("image/webp");
  const inputRef = useRef<HTMLInputElement>(null);
  const idRef = useRef(0);
  const queueRef = useRef<QueueItem[]>([]);
  const busyRef = useRef(false);
  const dragDepthRef = useRef(0);

  function updateQueue(next: QueueItem[] | ((current: QueueItem[]) => QueueItem[])) {
    const value = typeof next === "function" ? next(queueRef.current) : next;
    queueRef.current = value;
    setQueue(value);
  }

  useEffect(() => () => {
    for (const item of queueRef.current) if (item.output) URL.revokeObjectURL(item.output.url);
  }, []);

  function addFiles(selected: FileList | File[]) {
    if (busyRef.current) return;
    const incoming = Array.from(selected);
    if (!incoming.length) return;
    const valid = incoming.filter(fileIsSupported);
    const existingKeys = new Set(queueRef.current.map((item) => `${item.file.name}:${item.file.size}:${item.file.lastModified}`));
    const unique = valid.filter((file) => {
      const key = `${file.name}:${file.size}:${file.lastModified}`;
      if (existingKeys.has(key)) return false;
      existingKeys.add(key);
      return true;
    });
    const remaining = Math.max(0, 20 - queueRef.current.length);
    const added = unique.slice(0, remaining).map((file): QueueItem => ({
      id: ++idRef.current, file, format: defaultFormat, status: "ready", progress: 0,
    }));
    if (added.length) updateQueue((current) => [...current, ...added]);
    const invalid = incoming.length - valid.length;
    const duplicates = valid.length - unique.length;
    setNotice(invalid ? `${invalid} file(s) skipped. Supported: PNG, JPG, WebP, BMP, AVIF (20 MB max).` : unique.length > remaining ? "The queue supports up to 20 images." : duplicates ? `${duplicates} duplicate file(s) skipped.` : "");
  }

  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      if (busyRef.current || !event.clipboardData) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      const files = Array.from(event.clipboardData.files);
      if (files.length) {
        event.preventDefault();
        addFiles(files);
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  function changeFormat(id: number, format: OutputFormat) {
    if (busyRef.current) return;
    updateQueue((current) => current.map((item) => {
      if (item.id !== id) return item;
      if (item.output) URL.revokeObjectURL(item.output.url);
      return { ...item, format, output: undefined, status: "ready", progress: 0, error: undefined };
    }));
  }

  function removeFile(id: number) {
    if (busyRef.current) return;
    updateQueue((current) => {
      const item = current.find((entry) => entry.id === id);
      if (item?.output) URL.revokeObjectURL(item.output.url);
      return current.filter((entry) => entry.id !== id);
    });
    setNotice("");
  }

  function clearAll() {
    if (busyRef.current) return;
    for (const item of queueRef.current) if (item.output) URL.revokeObjectURL(item.output.url);
    updateQueue([]);
    setNotice("");
  }

  async function convert() {
    if (busyRef.current || !queueRef.current.some((item) => item.status === "ready" || item.status === "error")) return;
    busyRef.current = true;
    setWorking(true);
    setNotice("");
    try {
      const pending = queueRef.current.filter((item) => item.status === "ready" || item.status === "error");
      const usedNames = new Set(queueRef.current.filter((item) => item.status === "done").map((item) => item.output?.name.toLowerCase()).filter((name): name is string => Boolean(name)));
      for (const item of pending) {
        updateQueue((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: "converting", progress: 12, error: undefined } : entry));
        // Yield to the browser so the active row can render before decoding.
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        try {
          const blob = await transformImage(item.file, item.format);
          const extension = formats.find((format) => format.value === item.format)!.extension;
          const base = item.file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9 _().-]/g, "_").slice(0, 120).trim() || "converted";
          let name = `${base}.${extension}`;
          let suffix = 2;
          while (usedNames.has(name.toLowerCase())) name = `${base}-${suffix++}.${extension}`;
          usedNames.add(name.toLowerCase());
          const output = { url: URL.createObjectURL(blob), name, size: blob.size };
          updateQueue((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: "done", progress: 100, output, error: undefined } : entry));
        } catch (error) {
          const message = error instanceof Error ? error.message : "Conversion failed.";
          updateQueue((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: "error", progress: 0, error: message } : entry));
        }
      }
    } finally {
      busyRef.current = false;
      setWorking(false);
    }
  }

  const finished = queue.filter((item) => item.status === "done").length;
  const pending = queue.filter((item) => item.status === "ready" || item.status === "error").length;
  const totalBytes = queue.reduce((sum, item) => sum + item.file.size, 0);
  const errors = queue.filter((item) => item.status === "error").length;
  const conversionProgress = queue.length ? Math.round((finished / queue.length) * 100) : 0;
  const readyForDownload = queue.filter((item) => item.status === "done" && item.output);

  function applyFormatToPending(format: OutputFormat) {
    if (busyRef.current) return;
    setDefaultFormat(format);
    updateQueue((current) => current.map((item) => {
      if (item.status === "done" || item.status === "converting") return item;
      return { ...item, format, status: "ready", error: undefined, progress: 0 };
    }));
  }

  function downloadCompleted() {
    // A single ZIP is intentionally not generated: browser-only downloads require
    // user gestures and multiple automatic downloads may be blocked by browsers.
    // Offer the per-file links as the reliable default instead.
    const first = readyForDownload[0]?.output;
    if (!first) return;
    const link = document.createElement("a");
    link.href = first.url;
    link.download = first.name;
    link.click();
    if (readyForDownload.length > 1) setNotice("Downloaded the first image. Use each Download button for the remaining files.");
  }

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="ConvertTrio home"><span className="brand-symbol" aria-hidden="true">↗</span> ConvertTrio</a>
        <div className="header-right"><span className="header-status"><span className="online-dot" /> Browser-based conversion</span><a href="#about" className="header-link">How it works</a></div>
      </header>
      <div className="workspace" id="converter">
        <div className="workspace-heading">
          <div className="intro-label">WORKSPACE <span>/ IMAGE CONVERSION</span></div>
          <span className="workspace-version">PRIVATE BY DESIGN · V1</span>
        </div>
        <input ref={inputRef} className="sr-only" type="file" multiple accept="image/png,image/jpeg,image/webp,image/bmp,image/avif,.bmp,.avif" aria-label="Select images" onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.target.value = ""; }} />
        <div className="studio-layout">
          <section className="studio-main" aria-label="Image workspace">
            <div className="studio-title">
              <span className="section-overline">01 / SOURCE</span>
              <h1>Drop it.<br /><span>Convert it.</span></h1>
              <p>One workspace. Every format you need.</p>
            </div>
            {queue.length === 0 ? (
              <div className={`dropzone ${dragging ? "dragging" : ""}`} aria-label="Upload images"
                onDragEnter={(event) => { event.preventDefault(); dragDepthRef.current++; setDragging(true); }}
                onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }}
                onDragLeave={(event) => { event.preventDefault(); dragDepthRef.current = Math.max(0, dragDepthRef.current - 1); if (dragDepthRef.current === 0) setDragging(false); }}
                onDrop={(event) => { event.preventDefault(); dragDepthRef.current = 0; setDragging(false); addFiles(event.dataTransfer.files); }}>
                <div className="drop-illustration" aria-hidden="true">
                  <div className="illustration-sheet illustration-sheet-back" />
                  <div className="illustration-sheet illustration-sheet-front"><span>PNG</span><span>↗</span></div>
                </div>
                <h2>Drop your files anywhere.</h2>
                <p>Or choose images from your device to begin.</p>
                <button type="button" className="primary-button select-button" onClick={() => inputRef.current?.click()}>Select files <span aria-hidden="true">↗</span></button>
                <div className="drop-hint">TIP: PASTE IMAGES WITH <kbd>CTRL</kbd> + <kbd>V</kbd></div>
              </div>
            ) : (
              <div className="queue-panel" aria-label="Conversion queue">
                <div className="queue-header">
                  <div><span className="section-overline">YOUR QUEUE</span><h2>{queue.length} image{queue.length !== 1 ? "s" : ""} ready</h2></div>
                  <div className="queue-header-actions">
                    <button type="button" className="secondary-button" disabled={working || queue.length >= 20} onClick={() => inputRef.current?.click()}>+ Add files</button>
                    <button type="button" className="ghost-button" disabled={working} onClick={clearAll}>Clear all</button>
                  </div>
                </div>
                <div className="queue-table" role="list">
                  {queue.map((item) => (
                    <div className="queue-row" role="listitem" key={item.id}>
                      <div className="file-icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 15l3-3 2 2 2-2 2 3"/></svg></div>
                      <div className="file-main">
                        <strong title={item.file.name}>{item.file.name}</strong>
                        <span>{formatBytes(item.file.size)} <span className="file-divider">·</span> {item.status === "done" ? "Converted" : item.status === "converting" ? "Processing…" : item.status === "error" ? "Failed" : "Ready"}</span>
                        {item.status === "converting" && <div className="row-progress" role="progressbar" aria-label={`Converting ${item.file.name}`} aria-valuenow={item.progress} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${item.progress}%` }} /></div>}
                        {item.status === "error" && <small className="row-error" role="status">{item.error}</small>}
                      </div>
                      <div className="row-actions">
                        <label className="format-label" htmlFor={`format-${item.id}`}>TO</label>
                        <select id={`format-${item.id}`} value={item.format} disabled={working} onChange={(event) => changeFormat(item.id, event.target.value as OutputFormat)}>{formats.map((format) => <option key={format.value} value={format.value}>{format.label}</option>)}</select>
                        {item.status === "done" && item.output ? <a className="download-button" href={item.output.url} download={item.output.name}><span aria-hidden="true">↓</span> Download</a> : <span className={`row-state ${item.status === "error" ? "state-error" : ""}`}>{item.status === "converting" ? `${item.progress}%` : item.status === "error" ? "Error" : "Waiting"}</span>}
                        <button type="button" className="remove-button" aria-label={`Remove ${item.file.name}`} title="Remove" disabled={working} onClick={() => removeFile(item.id)}>×</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="queue-footer">
                  <span>{finished} / {queue.length} converted</span>
                  <button type="button" className="primary-button" disabled={working || pending === 0} onClick={convert}>{working ? "Converting…" : pending > 0 && finished > 0 ? "Convert remaining" : "Convert files"} <span aria-hidden="true">→</span></button>
                </div>
              </div>
            )}
            {notice && <div className="inline-notice" role="alert"><span aria-hidden="true">!</span>{notice}<button type="button" onClick={() => setNotice("")} aria-label="Dismiss notification">×</button></div>}
            <div className="workspace-foot"><span>PNG · JPG · WEBP · BMP · AVIF</span><span>20 FILES / 20 MB EACH</span></div>
          </section>
          <aside className="studio-sidebar" aria-label="Workspace information">
            <div className="sidebar-top">
              <span className="section-overline">02 / SESSION</span>
              <h2>Everything<br />in one place.</h2>
              <p>Your files stay right here, in your browser. No accounts, no uploads, no detours.</p>
              <div className="sidebar-format"><label htmlFor="default-format">DEFAULT OUTPUT</label><select id="default-format" disabled={working} value={defaultFormat} onChange={(event) => applyFormatToPending(event.target.value as OutputFormat)}>{formats.map((format) => <option key={format.value} value={format.value}>{format.label}</option>)}</select><small>Applies to new files and files not yet converted.</small></div>
            </div>
            <div className="session-metrics" aria-live="polite">
              <div className="metric"><span>FILES IN QUEUE</span><strong>{String(queue.length).padStart(2, "0")}</strong></div>
              <div className="metric"><span>ORIGINAL SIZE</span><strong>{queue.length ? formatBytes(totalBytes) : "—"}</strong></div>
              <div className="metric"><span>COMPLETED</span><strong>{String(finished).padStart(2, "0")}</strong></div>
              {readyForDownload.length > 0 && <div className="metric"><span>READY TO SAVE</span><strong>{String(readyForDownload.length).padStart(2, "0")}</strong></div>}
              {errors > 0 && <div className="metric metric-error"><span>NEEDS ATTENTION</span><strong>{String(errors).padStart(2, "0")}</strong></div>}
            </div>
            <div className="sidebar-progress">
              <div className="sidebar-progress-label"><span>SESSION PROGRESS</span><strong>{conversionProgress}%</strong></div>
              <div className="sidebar-progress-track" role="progressbar" aria-label="Completed files" aria-valuenow={conversionProgress} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${conversionProgress}%` }} /></div>
            </div>
            {readyForDownload.length === 1 && <button type="button" className="sidebar-download" onClick={downloadCompleted}>Download converted image ↓</button>}
            <div className="sidebar-note"><span className="online-dot" /> LOCAL PROCESSING <p>Nothing leaves this device. All conversion happens in your browser.</p></div>
          </aside>
        </div>
      </div>
      <section className="about" id="about"><div><span className="about-kicker">HOW IT WORKS</span><h2>Just your files.<br />Nothing else.</h2></div><p>Select images, choose PNG, JPG or WebP for each file, and download the results. Conversion runs in your browser using local image processing. BMP and AVIF input depends on your browser&apos;s decoding support.</p></section>
      <footer><span>© {new Date().getFullYear()} ConvertTrio</span><span>Built for quick, private conversions.</span></footer>
    </main>
  );
}
