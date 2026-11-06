"use client";

import { useEffect, useRef, useState } from "react";
import { createZip } from "@/lib/zip";

type OutputFormat = "image/png" | "image/jpeg" | "image/webp";
type Result = { url: string; name: string; size: number; blob: Blob };
const formats: { value: OutputFormat; label: string; extension: string }[] = [
  { value: "image/png", label: "PNG", extension: "png" },
  { value: "image/jpeg", label: "JPG", extension: "jpg" },
  { value: "image/webp", label: "WebP", extension: "webp" },
];
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;
const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const formatBytes = (bytes: number) => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(2)} MB`;

export default function HomePage() {
  const [files, setFiles] = useState<File[]>([]);
  const [quality, setQuality] = useState(92);
  const [progress, setProgress] = useState(0);
  const [format, setFormat] = useState<OutputFormat>("image/webp");
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<Result[]>([]);
  const busyRef = useRef(false);

  useEffect(() => () => {
    for (const item of resultsRef.current) URL.revokeObjectURL(item.url);
  }, []);

  function clearResults() {
    for (const item of resultsRef.current) URL.revokeObjectURL(item.url);
    resultsRef.current = [];
    setResults([]);
    setProgress(0);
  }

  function chooseFiles(selected: FileList | File[]) {
    if (busyRef.current) return;
    clearResults();
    const incoming = Array.from(selected);
    const valid = incoming.filter((item) => allowedTypes.has(item.type) && item.size > 0 && item.size <= MAX_BYTES);
    setFiles(valid.slice(0, 20));
    setError(incoming.length !== valid.length ? "Some files were skipped. Use PNG, JPG or WebP images under 20 MB." : incoming.length > 20 ? "Only the first 20 images were added." : "");
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
        const source = URL.createObjectURL(file);
        try {
          const image = new Image();
          image.src = source;
          await image.decode();
          if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > MAX_PIXELS) {
            throw new Error(`Cannot convert ${file.name}: maximum image size is 40 megapixels.`);
          }
          const canvas = document.createElement("canvas");
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Your browser cannot process this image.");
          if (format === "image/jpeg") {
            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, canvas.width, canvas.height);
          }
          context.drawImage(image, 0, 0);
          const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, format, quality / 100));
          canvas.width = 0;
          canvas.height = 0;
          if (!blob || blob.type !== format) throw new Error("Your browser does not support this output format.");
          const extension = formats.find((item) => item.value === format)!.extension;
          const base = file.name.replace(/\\.[^.]+$/, "") || "converted";
          let name = `${base}.${extension}`;
          let suffix = 2;
          while (usedNames.has(name.toLowerCase())) name = `${base}-${suffix++}.${extension}`;
          usedNames.add(name.toLowerCase());
          output.push({ url: URL.createObjectURL(blob), name, size: blob.size, blob });
        } finally {
          URL.revokeObjectURL(source);
        }
        setProgress(Math.round(((index + 1) / files.length) * 100));
      }
      resultsRef.current = output;
      setResults(output);
    } catch (cause) {
      for (const item of output) URL.revokeObjectURL(item.url);
      setError(cause instanceof Error ? cause.message : "Conversion failed.");
      setProgress(0);
    } finally {
      busyRef.current = false;
      setWorking(false);
    }
  }

  async function downloadZip() {
    if (!results.length) return;
    try {
      const zip = await createZip(results.map(({ name, blob }) => ({ name, blob })));
      const url = URL.createObjectURL(zip);
      const link = document.createElement("a");
      link.href = url;
      link.download = "converttrio-images.zip";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      setError("Could not create ZIP archive. Download the images individually.");
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="ConvertTrio home"><span className="brand-mark">C<span>↗</span></span>Convert<span>Trio</span></a>
        <span className="header-label">Simple tools. Better files.</span>
      </header>

      <section className="hero">
        <div className="eyebrow"><span className="eyebrow-dot" /> FREE ONLINE IMAGE CONVERTER</div>
        <h1>Every format.<br /><em>One simple place.</em></h1>
        <p className="subtitle">Convert PNG, JPG, and WebP images in seconds. No account, no uploads, no fuss.</p>
        <div className="feature-pills"><span>✦ Private by design</span><span>✦ No sign-up</span><span>✦ Free to use</span></div>
      </section>

      <section className="converter" aria-label="Image converter">
        <div className="converter-heading"><div><p className="section-kicker">YOUR WORKSPACE</p><h2>Image converter</h2></div><span className="converter-tag">PNG · JPG · WEBP</span></div>
        <input ref={inputRef} className="sr-only" type="file" multiple accept="image/png,image/jpeg,image/webp" aria-label="Choose images" onChange={(event) => { if (event.target.files) chooseFiles(event.target.files); event.target.value = ""; }} />
        <div className={`dropzone ${dragging ? "dragging" : ""}`} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { event.preventDefault(); setDragging(false); }} onDrop={(event) => { event.preventDefault(); setDragging(false); chooseFiles(event.dataTransfer.files); }}>
          <div className="empty-upload"><div className="upload-icon" aria-hidden="true">↑</div><h3>Drop your images here</h3><p>or select up to 20 images from your device</p><button type="button" disabled={working} className="browse-button" onClick={() => inputRef.current?.click()}>Browse files <span aria-hidden="true">↗</span></button><small>PNG, JPG or WebP · 20 MB per file · 40 MP maximum</small></div>
        </div>
        {files.length > 0 && <div className="batch-list"><div className="batch-heading"><strong>{files.length} image{files.length !== 1 ? "s" : ""} selected</strong><button className="text-button" disabled={working} onClick={() => { setFiles([]); clearResults(); }} type="button">Clear all</button></div>{files.map((file, index) => <div className="batch-item" key={index}><span className="batch-filename" title={file.name}>{file.name}</span><span>{formatBytes(file.size)}</span></div>)}</div>}
        <div className="converter-controls">
          <label htmlFor="output-format">Convert to</label>
          <select id="output-format" value={format} disabled={working} onChange={(event) => { setFormat(event.target.value as OutputFormat); clearResults(); setError(""); }}>
            {formats.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <button className="convert-button" type="button" disabled={!files.length || working} onClick={convert}>{working ? `Converting… ${progress}%` : `Convert ${files.length > 1 ? "images" : "image"}`} <span aria-hidden="true">→</span></button>
        </div>
        {format !== "image/png" && <div className="quality-control"><label htmlFor="quality">Quality <strong>{quality}%</strong></label><input id="quality" type="range" min="10" max="100" step="1" value={quality} disabled={working} onChange={(event) => { setQuality(Number(event.target.value)); clearResults(); }} /><small>Higher quality usually means larger files.</small></div>}
        {working && <div className="progress-track" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Conversion progress"><div style={{ width: `${progress}%` }} /></div>}
        {error && <p className="message error" role="alert">{error}</p>}
        {results.length > 0 && <div className="message success" role="status"><div><strong>{results.length} image{results.length !== 1 ? "s" : ""} ready!</strong><span>Converted successfully</span></div>{results.length > 1 && <button className="download-button" type="button" onClick={downloadZip}>Download ZIP ↓</button>}</div>}
        {results.length > 0 && <div className="batch-list">{results.map((item) => <div className="batch-item" key={item.name}><span className="batch-filename">{item.name}</span><span>{formatBytes(item.size)}</span><a className="text-button" href={item.url} download={item.name}>Download ↓</a></div>)}</div>}
        <p className="privacy-note">🔒 Your images stay on your device. Conversion happens in your browser.</p>
      </section>

      <section className="benefits" aria-label="Benefits"><div><span className="benefit-icon">◇</span><h3>Made to be easy</h3><p>No complicated settings. Just choose your image and format.</p></div><div><span className="benefit-icon">◎</span><h3>Privacy comes first</h3><p>Images are processed locally, without being sent to a server.</p></div><div><span className="benefit-icon">↗</span><h3>Ready in seconds</h3><p>Get your converted image and download it right away.</p></div></section>
      <footer><span>© {new Date().getFullYear()} ConvertTrio</span><span>Made for simpler file conversions.</span></footer>
    </main>
  );
}
