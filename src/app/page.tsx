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
const fileIsSupported = (file: File) => (allowedTypes.has(file.type) || /\\.(bmp|avif)$/i.test(file.name)) && file.size > 0 && file.size <= MAX_BYTES;

export default function HomePage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [notice, setNotice] = useState("");
  const [dragging, setDragging] = useState(false);
  const [working, setWorking] = useState(false);
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
    const remaining = Math.max(0, 20 - queueRef.current.length);
    const added = valid.slice(0, remaining).map((file): QueueItem => ({
      id: ++idRef.current, file, format: "image/webp", status: "ready", progress: 0,
    }));
    if (added.length) updateQueue((current) => [...current, ...added]);
    const invalid = incoming.length - valid.length;
    setNotice(invalid ? `${invalid} file(s) skipped. Supported: PNG, JPG, WebP, BMP, AVIF (20 MB max).` : valid.length > remaining ? "The queue supports up to 20 images." : "");
  }

  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      if (busyRef.current || !event.clipboardData) return;
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
          const base = item.file.name.replace(/\\.[^.]+$/, "") || "converted";
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

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="ConvertTrio home"><span className="brand-symbol" aria-hidden="true">↗</span> ConvertTrio</a>
        <div className="header-right"><span className="header-status"><span className="online-dot" /> Browser-based conversion</span><a href="#about" className="header-link">How it works</a></div>
      </header>
      <div className="workspace" id="converter">
        <div className="intro"><div className="intro-label">IMAGE CONVERTER <span> / 01</span></div><h1>Convert images.<br /><span>Keep it simple.</span></h1><p>Fast, private image conversion. No sign-up. No upload to a server.</p></div>
        <input ref={inputRef} className="sr-only" type="file" multiple accept="image/png,image/jpeg,image/webp,image/bmp,image/avif,.bmp,.avif" aria-label="Select images" onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.target.value = ""; }} />
        {queue.length === 0 ? (
          <section className={`dropzone ${dragging ? "dragging" : ""}`} aria-label="Upload images"
            onDragEnter={(event) => { event.preventDefault(); dragDepthRef.current++; setDragging(true); }}
            onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }}
            onDragLeave={(event) => { event.preventDefault(); dragDepthRef.current = Math.max(0, dragDepthRef.current - 1); if (dragDepthRef.current === 0) setDragging(false); }}
            onDrop={(event) => { event.preventDefault(); dragDepthRef.current = 0; setDragging(false); addFiles(event.dataTransfer.files); }}>
            <div className="drop-icon" aria-hidden="true"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V3m0 0-5 5m5-5 5 5M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg></div>
            <h2>Drop files here</h2>
            <p>Drag and drop images, or select them from your device.</p>
            <button type="button" className="primary-button select-button" onClick={() => inputRef.current?.click()}>Select files <span aria-hidden="true">↗</span></button>
            <div className="drop-hint">or paste an image with <kbd>Ctrl</kbd> + <kbd>V</kbd> / <kbd>⌘</kbd> + <kbd>V</kbd></div>
          </section>
        ) : (
          <section className="queue-panel" aria-label="Conversion queue">
            <div className="queue-header"><div><h2>Your files <span>{queue.length}</span></h2><p>Choose an output format for each image.</p></div><div className="queue-header-actions"><button type="button" className="secondary-button" disabled={working || queue.length >= 20} onClick={() => inputRef.current?.click()}>+ Add files</button><button type="button" className="ghost-button" disabled={working} onClick={clearAll}>Clear all</button></div></div>
            <div className="queue-table" role="list">
              {queue.map((item) => (
                <div className="queue-row" role="listitem" key={item.id}>
                  <div className="file-icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 15l3-3 2 2 2-2 2 3"/></svg></div>
                  <div className="file-main"><strong title={item.file.name}>{item.file.name}</strong><span>{formatBytes(item.file.size)} <span className="file-divider">·</span> {item.status === "done" ? "Converted" : item.status === "converting" ? "Processing…" : item.status === "error" ? "Failed" : "Ready"}</span>
                    {item.status === "converting" && <div className="row-progress" role="progressbar" aria-label={`Converting ${item.file.name}`} aria-valuenow={item.progress} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${item.progress}%` }} /></div>}
                    {item.status === "error" && <small className="row-error" role="status">{item.error}</small>}
                  </div>
                  <div className="row-actions"><label className="format-label" htmlFor={`format-${item.id}`}>TO</label><select id={`format-${item.id}`} value={item.format} disabled={working} onChange={(event) => changeFormat(item.id, event.target.value as OutputFormat)}>{formats.map((format) => <option key={format.value} value={format.value}>{format.label}</option>)}</select>
                    {item.status === "done" && item.output ? <a className="download-button" href={item.output.url} download={item.output.name}><span aria-hidden="true">↓</span> Download</a> : <span className={`row-state ${item.status === "error" ? "state-error" : ""}`}>{item.status === "converting" ? `${item.progress}%` : item.status === "error" ? "Error" : "Waiting"}</span>}
                    <button type="button" className="remove-button" aria-label={`Remove ${item.file.name}`} title="Remove" disabled={working} onClick={() => removeFile(item.id)}>×</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="queue-footer"><span>{finished} of {queue.length} converted</span><button type="button" className="primary-button" disabled={working || pending === 0} onClick={convert}>{working ? "Converting…" : pending > 0 && finished > 0 ? "Convert remaining" : "Convert files"} <span aria-hidden="true">→</span></button></div>
          </section>
        )}
        {notice && <div className="inline-notice" role="alert"><span aria-hidden="true">!</span>{notice}<button type="button" onClick={() => setNotice("")} aria-label="Dismiss notification">×</button></div>}
        <div className="workspace-foot"><span>PNG · JPG · WEBP · BMP · AVIF</span><span>20 files max · 20 MB each</span><span>Files stay on your device</span></div>
      </div>
      <section className="about" id="about"><div><span className="about-kicker">HOW IT WORKS</span><h2>Just your files.<br />Nothing else.</h2></div><p>Select images, choose PNG, JPG or WebP for each file, and download the results. Conversion runs in your browser using local image processing. BMP and AVIF input depends on your browser&apos;s decoding support.</p></section>
      <footer><span>© {new Date().getFullYear()} ConvertTrio</span><span>Built for quick, private conversions.</span></footer>
    </main>
  );
}
