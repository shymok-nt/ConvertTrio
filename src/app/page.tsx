"use client";

import { useEffect, useRef, useState } from "react";
import { transformImage, type OutputFormat } from "@/lib/image-transform";

type Result = { url: string; name: string; size: number };
const formats: { value: OutputFormat; label: string; extension: string }[] = [
  { value: "image/png", label: "PNG", extension: "png" },
  { value: "image/jpeg", label: "JPG", extension: "jpg" },
  { value: "image/webp", label: "WebP", extension: "webp" },
];
const MAX_BYTES = 20 * 1024 * 1024;
const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/bmp", "image/x-ms-bmp", "image/avif"]);
const formatBytes = (bytes: number) => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(2)} MB`;

export default function HomePage() {
  const [files, setFiles] = useState<File[]>([]);
  const [format, setFormat] = useState<OutputFormat>("image/webp");
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<Result[]>([]);
  const busyRef = useRef(false);

  useEffect(() => () => {
    for (const result of resultsRef.current) URL.revokeObjectURL(result.url);
  }, []);

  function clearResults() {
    for (const result of resultsRef.current) URL.revokeObjectURL(result.url);
    resultsRef.current = [];
    setResults([]);
    setProgress(0);
  }

  function chooseFiles(selected: FileList | File[]) {
    if (busyRef.current) return;
    clearResults();
    const incoming = Array.from(selected);
    const valid = incoming.filter((file) => (allowedTypes.has(file.type) || /\.(bmp|avif)$/i.test(file.name)) && file.size > 0 && file.size <= MAX_BYTES);
    setFiles(valid.slice(0, 20));
    setError(incoming.length !== valid.length ? "Some files were skipped. Supported: PNG, JPG, WebP, BMP and AVIF, up to 20 MB each." : incoming.length > 20 ? "Only the first 20 images were added." : "");
  }

  async function convert() {
    if (!files.length || busyRef.current) return;
    busyRef.current = true;
    setWorking(true);
    setError("");
    clearResults();
    const output: Result[] = [];
    const usedNames = new Set<string>();
    try {
      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        let blob: Blob;
        try {
          blob = await transformImage(file, format);
        } catch (cause) {
          if (cause instanceof Error && (cause.name === "EncodingError" || cause.name === "NotSupportedError")) {
            throw new Error(`Your browser cannot open ${file.name}. Try a different browser or format.`);
          }
          throw cause;
        }
        const extension = formats.find((item) => item.value === format)!.extension;
        const base = file.name.replace(/\.[^.]+$/, "") || "converted";
        let name = `${base}.${extension}`;
        let suffix = 2;
        while (usedNames.has(name.toLowerCase())) name = `${base}-${suffix++}.${extension}`;
        usedNames.add(name.toLowerCase());
        output.push({ url: URL.createObjectURL(blob), name, size: blob.size });
        setProgress(Math.round(((index + 1) / files.length) * 100));
      }
      resultsRef.current = output;
      setResults(output);
    } catch (cause) {
      for (const result of output) URL.revokeObjectURL(result.url);
      setError(cause instanceof Error ? cause.message : "Conversion failed.");
      setProgress(0);
    } finally {
      busyRef.current = false;
      setWorking(false);
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="ConvertTrio home"><span className="brand-symbol" aria-hidden="true">◈</span>ConvertTrio<span className="brand-period">.</span></a>
        <nav className="main-nav" aria-label="Main navigation">
          <a href="#converter">Converter</a>
          <a href="#how-it-works">How it works</a>
        </nav>
        <a className="nav-cta" href="#converter">Get started <span aria-hidden="true">↗</span></a>
      </header>

      <section className="hero">
        <p className="eyebrow"><span className="status-dot" /> FREE ONLINE IMAGE CONVERTER</p>
        <h1>Images, in the<br /><span>right format.</span></h1>
        <p className="subtitle">A simple way to convert your images. No accounts, no uploads, no unnecessary steps.</p>
      </section>

      <section className="converter" id="converter" aria-label="Image converter">
        <div className="converter-heading">
          <div><h2>Convert images</h2><p>Drop your files below to get started.</p></div>
          <span className="converter-tag">01 / CONVERT</span>
        </div>
        <input ref={inputRef} className="sr-only" type="file" multiple accept="image/png,image/jpeg,image/webp,image/bmp,image/avif,.bmp,.avif" aria-label="Choose images" onChange={(event) => { if (event.target.files) chooseFiles(event.target.files); event.target.value = ""; }} />
        <div className={`dropzone ${dragging ? "dragging" : ""}`} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { event.preventDefault(); setDragging(false); }} onDrop={(event) => { event.preventDefault(); setDragging(false); chooseFiles(event.dataTransfer.files); }}>
          <div className="upload-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="27" height="27" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4m0 0-4 4m4-4 4 4"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg></div>
          <h3>Drop your images here</h3>
          <p>or browse files from your device</p>
          <button type="button" disabled={working} className="browse-button" onClick={() => inputRef.current?.click()}>Choose files <span aria-hidden="true">↗</span></button>
          <small>PNG, JPG, WEBP, BMP, AVIF <span>·</span> MAX 20 FILES <span>·</span> 20 MB EACH</small>
        </div>

        {files.length > 0 && <div className="batch-list"><div className="batch-heading"><strong>{files.length} file{files.length !== 1 ? "s" : ""} selected</strong><button className="text-button" disabled={working} onClick={() => { setFiles([]); clearResults(); setError(""); }} type="button">Clear all</button></div>{files.map((file, index) => <div className="batch-item" key={index}><span className="batch-filename" title={file.name}>{file.name}</span><span className="file-size">{formatBytes(file.size)}</span></div>)}</div>}
        <div className="converter-controls">
          <div className="format-field"><label htmlFor="output-format">OUTPUT FORMAT</label><select id="output-format" value={format} disabled={working} onChange={(event) => { setFormat(event.target.value as OutputFormat); clearResults(); setError(""); }}>{formats.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
          <button className="convert-button" type="button" disabled={!files.length || working} onClick={convert}>{working ? `Converting… ${progress}%` : "Convert now"} <span aria-hidden="true">→</span></button>
        </div>
        {working && <div className="progress-track" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Conversion progress"><div style={{ width: `${progress}%` }} /></div>}
        {error && <p className="message error" role="alert">{error}</p>}
        {results.length > 0 && <div className="message success" role="status"><strong>Done. {results.length} image{results.length !== 1 ? "s" : ""} ready to download.</strong></div>}
        {results.length > 0 && <div className="batch-list result-list">{results.map((item) => <div className="batch-item" key={item.name}><span className="batch-filename">{item.name}</span><span className="file-size">{formatBytes(item.size)}</span><a className="download-link" href={item.url} download={item.name}>Download <span aria-hidden="true">↓</span></a></div>)}</div>}
        <div className="privacy-note"><span aria-hidden="true">◌</span> Your files never leave your device. Everything runs locally in your browser.</div>
      </section>

      <section className="benefits" id="how-it-works">
        <div><span className="benefit-number">01</span><h3>Choose your files</h3><p>Select one or multiple images from your device.</p></div>
        <div><span className="benefit-number">02</span><h3>Pick a format</h3><p>Convert to PNG, JPG, or WebP with a single click.</p></div>
        <div><span className="benefit-number">03</span><h3>Download</h3><p>Save each converted image instantly, with no account needed.</p></div>
      </section>
      <footer><span>© {new Date().getFullYear()} ConvertTrio</span><span>Made for the little things that should be easy.</span></footer>
    </main>
  );
}
