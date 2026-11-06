"use client";

import { useEffect, useRef, useState } from "react";
import { transformImage, type ImageOptions } from "@/lib/image-transform";

type OutputFormat = "image/png" | "image/jpeg" | "image/webp";
type Result = { url: string; name: string; size: number; blob: Blob };
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
  const [progress, setProgress] = useState(0);
  const [maxDimension, setMaxDimension] = useState(0);
  const [cropAspect, setCropAspect] = useState<ImageOptions["cropAspect"]>("none");
  const [rotation, setRotation] = useState<ImageOptions["rotation"]>(0);
  const [flipHorizontal, setFlipHorizontal] = useState(false);
  const [flipVertical, setFlipVertical] = useState(false);
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
    const valid = incoming.filter((item) => (allowedTypes.has(item.type) || /\\.(bmp|avif)$/i.test(item.name)) && item.size > 0 && item.size <= MAX_BYTES);
    setFiles(valid.slice(0, 20));
    setError(incoming.length !== valid.length ? "Some files were skipped. Use PNG, JPG, WebP, BMP or AVIF images under 20 MB." : incoming.length > 20 ? "Only the first 20 images were added." : "");
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
          blob = await transformImage(file, { format, maxDimension, cropAspect, rotation, flipHorizontal, flipVertical });
        } catch (cause) {
          if (cause instanceof Error && (cause.name === "EncodingError" || cause.name === "NotSupportedError")) {
            throw new Error(`Your browser cannot open ${file.name}. Try another browser or image format.`);
          }
          throw cause;
        }
        const extension = formats.find((item) => item.value === format)!.extension;
        const base = file.name.replace(/\\.[^.]+$/, "") || "converted";
        let name = `${base}.${extension}`;
        let suffix = 2;
        while (usedNames.has(name.toLowerCase())) name = `${base}-${suffix++}.${extension}`;
        usedNames.add(name.toLowerCase());
        output.push({ url: URL.createObjectURL(blob), name, size: blob.size, blob });
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


  return (
    <main className="shell">
      <div className="utility-bar"><div className="utility-inner"><span>CONVERTTRIO</span></div></div>
      <header className="topbar">
        <a className="brand" href="/" aria-label="ConvertTrio home"><span className="brand-mark">C<span>↗</span></span>Convert<span>Trio</span></a>
        <nav className="main-nav" aria-label="Main navigation">
          <a href="#converter">Image converter</a>
          <a href="#how-it-works">How it works</a>
          <a href="#privacy">Privacy</a>
        </nav>
        <a className="nav-cta" href="#converter">Convert</a>
      </header>

      <section className="hero">
        <div className="eyebrow"><span className="eyebrow-dot" /> IMAGE CONVERTER</div>
        <h1>Convert your files.</h1>
        <p className="subtitle">Convert PNG, JPG, WebP, BMP and AVIF images directly in your browser.</p>
      </section>

      <section className="converter" id="converter" aria-label="Image converter">
        <div className="converter-heading">
          <div><p className="section-kicker">CONVERTER</p><h2>Upload images</h2><p className="panel-subtitle">Select images to convert.</p></div>
          <span className="converter-tag">PNG · JPG · WEBP · BMP · AVIF</span>
        </div>
        <input ref={inputRef} className="sr-only" type="file" multiple accept="image/png,image/jpeg,image/webp,image/bmp,image/avif,.bmp,.avif" aria-label="Choose images" onChange={(event) => { if (event.target.files) chooseFiles(event.target.files); event.target.value = ""; }} />
        <div className={`dropzone ${dragging ? "dragging" : ""}`} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { event.preventDefault(); setDragging(false); }} onDrop={(event) => { event.preventDefault(); setDragging(false); chooseFiles(event.dataTransfer.files); }}>
          <div className="empty-upload"><div className="upload-icon" aria-hidden="true">⇧</div><h3>Drag and drop images here</h3><p>or select files from your computer</p><button type="button" disabled={working} className="browse-button" onClick={() => inputRef.current?.click()}>Choose files <span aria-hidden="true">↗</span></button><small>PNG, JPG, WebP, BMP or AVIF · Up to 20 files · 20 MB each</small></div>
        </div>
        {files.length > 0 && <div className="batch-list"><div className="batch-heading"><strong>{files.length} image{files.length !== 1 ? "s" : ""} selected</strong><button className="text-button" disabled={working} onClick={() => { setFiles([]); clearResults(); }} type="button">Clear all</button></div>{files.map((file, index) => <div className="batch-item" key={index}><span className="batch-filename" title={file.name}>{file.name}</span><span>{formatBytes(file.size)}</span></div>)}</div>}
        <div className="converter-controls">
          <label htmlFor="output-format">Convert to</label>
          <select id="output-format" value={format} disabled={working} onChange={(event) => { setFormat(event.target.value as OutputFormat); clearResults(); setError(""); }}>
            {formats.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <button className="convert-button" type="button" disabled={!files.length || working} onClick={convert}>{working ? `Converting… ${progress}%` : `Convert ${files.length > 1 ? "images" : "image"}`} <span aria-hidden="true">→</span></button>
        </div>
        <div className="image-options" aria-label="Image adjustments">
          <label htmlFor="image-size">Max image size</label>
          <select id="image-size" value={maxDimension} disabled={working} onChange={(event) => { setMaxDimension(Number(event.target.value)); clearResults(); }}>
            <option value={0}>Original dimensions</option>
            <option value={3840}>3840 px (4K)</option>
            <option value={1920}>1920 px (Full HD)</option>
            <option value={1280}>1280 px</option>
            <option value={800}>800 px</option>
          </select>
          <label htmlFor="image-crop">Center crop</label>
          <select id="image-crop" value={cropAspect} disabled={working} onChange={(event) => { setCropAspect(event.target.value as ImageOptions["cropAspect"]); clearResults(); }}>
            <option value="none">No crop</option>
            <option value="1:1">Square (1:1)</option>
            <option value="4:3">Landscape (4:3)</option>
            <option value="16:9">Widescreen (16:9)</option>
            <option value="9:16">Portrait (9:16)</option>
          </select>
          <label htmlFor="image-rotation">Rotate</label>
          <select id="image-rotation" value={rotation} disabled={working} onChange={(event) => { setRotation(Number(event.target.value) as ImageOptions["rotation"]); clearResults(); }}>
            <option value={0}>None</option>
            <option value={90}>90° clockwise</option>
            <option value={180}>180°</option>
            <option value={270}>90° counterclockwise</option>
          </select>
          <label className="flip-option"><input type="checkbox" checked={flipHorizontal} disabled={working} onChange={(event) => { setFlipHorizontal(event.target.checked); clearResults(); }} /> Flip horizontally</label>
          <label className="flip-option"><input type="checkbox" checked={flipVertical} disabled={working} onChange={(event) => { setFlipVertical(event.target.checked); clearResults(); }} /> Flip vertically</label>
        </div>
        {working && <div className="progress-track" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Conversion progress"><div style={{ width: `${progress}%` }} /></div>}
        {error && <p className="message error" role="alert">{error}</p>}
        {results.length > 0 && <div className="message success" role="status"><div><strong>{results.length} image{results.length !== 1 ? "s" : ""} ready!</strong><span>Converted successfully</span></div></div>}
        {results.length > 0 && <div className="batch-list">{results.map((item) => <div className="batch-item" key={item.name}><span className="batch-filename">{item.name}</span><span>{formatBytes(item.size)}</span><a className="text-button" href={item.url} download={item.name}>Download ↓</a></div>)}</div>}
        <p className="privacy-note">🔒 Your images stay on your device. Conversion happens in your browser.</p>
      </section>

      <section className="benefits" id="how-it-works" aria-label="Benefits"><div><span className="benefit-icon">◇</span><h3>Made to be easy</h3><p>No complicated settings. Just choose your image and format.</p></div><div id="privacy"><span className="benefit-icon">◎</span><h3>Privacy comes first</h3><p>Images are processed locally, without being sent to a server.</p></div><div><span className="benefit-icon">↗</span><h3>Ready in seconds</h3><p>Get your converted image and download it right away.</p></div></section>
      <footer><span>© {new Date().getFullYear()} ConvertTrio</span><span>Made for simpler file conversions.</span></footer>
    </main>
  );
}
