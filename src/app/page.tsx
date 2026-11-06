"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
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

type HelpEntry = {
  category: string;
  question: string;
  answer: string;
};

const helpEntries: HelpEntry[] = [
  {
    category: "Getting started",
    question: "How do I add images?",
    answer: "Use Select files, drag files onto the upload area, or paste a copied image with Ctrl+V or Cmd+V.",
  },
  {
    category: "Getting started",
    question: "Can I add several images at once?",
    answer: "Yes. Select multiple images in the file picker or drop a group of files into the workspace.",
  },
  {
    category: "Getting started",
    question: "What is the maximum number of images?",
    answer: "The workspace holds up to 20 images at a time.",
  },
  {
    category: "Getting started",
    question: "What is the maximum file size?",
    answer: "Each input image must be 20 MB or smaller.",
  },
  {
    category: "Getting started",
    question: "Why is my image not accepted?",
    answer: "The file may be empty, too large, mislabeled, or an unsupported image format.",
  },
  {
    category: "Getting started",
    question: "Can I paste an image from the clipboard?",
    answer: "Yes, if your browser exposes the copied image as a clipboard file.",
  },
  {
    category: "Getting started",
    question: "Why did paste do nothing?",
    answer: "Some browsers or applications copy text or HTML rather than an image file. Try saving and selecting the image.",
  },
  {
    category: "Getting started",
    question: "Can I add more images after selecting the first ones?",
    answer: "Yes. Use Add files above the queue while no conversion is running.",
  },
  {
    category: "Getting started",
    question: "Can I remove one image?",
    answer: "Yes. Use the remove control beside its row before or after conversion.",
  },
  {
    category: "Getting started",
    question: "How do I clear the queue?",
    answer: "Use Clear all. This also releases generated download URLs.",
  },
  {
    category: "Formats",
    question: "Which output formats are available?",
    answer: "You can export PNG, JPEG, or WebP images.",
  },
  {
    category: "Formats",
    question: "Which input formats are supported?",
    answer: "PNG, JPEG, WebP, BMP, and AVIF inputs are accepted when your browser can decode them.",
  },
  {
    category: "Formats",
    question: "Why is AVIF support different across browsers?",
    answer: "AVIF decoding depends on the browser version and its supported image codecs.",
  },
  {
    category: "Formats",
    question: "Can I convert BMP images?",
    answer: "Yes, when your browser can decode the BMP file. The result can be PNG, JPEG, or WebP.",
  },
  {
    category: "Formats",
    question: "Can I export GIF files?",
    answer: "No. GIF export is not part of this version.",
  },
  {
    category: "Formats",
    question: "Does the app convert SVG files?",
    answer: "No. SVG is not accepted because this workspace is designed for raster image conversion.",
  },
  {
    category: "Formats",
    question: "What is PNG best for?",
    answer: "PNG is useful for graphics, sharp edges, and images that need transparency.",
  },
  {
    category: "Formats",
    question: "What is JPEG best for?",
    answer: "JPEG is commonly used for photos and does not preserve transparency.",
  },
  {
    category: "Formats",
    question: "What is WebP best for?",
    answer: "WebP often provides compact images with support for transparency.",
  },
  {
    category: "Formats",
    question: "Can I choose a different format for each image?",
    answer: "Yes. Each queue row has its own output format selector.",
  },
  {
    category: "Formats",
    question: "How do I set one format for new images?",
    answer: "Use the Default output selector in the session panel.",
  },
  {
    category: "Formats",
    question: "Does changing the default update completed images?",
    answer: "No. Completed images keep their existing result until you change that row's format.",
  },
  {
    category: "Formats",
    question: "Can I convert a PNG to PNG?",
    answer: "Yes. The browser decodes and re-encodes the image, which can change the output size.",
  },
  {
    category: "Formats",
    question: "Does conversion preserve transparency?",
    answer: "PNG and WebP can preserve transparency. JPEG uses a white background.",
  },
  {
    category: "Formats",
    question: "Will the output look exactly the same?",
    answer: "Not always. Different formats and browser encoders may affect colors, compression, or metadata.",
  },
  {
    category: "Processing",
    question: "Where does conversion happen?",
    answer: "Image decoding and encoding happen locally in your browser using the Canvas API.",
  },
  {
    category: "Processing",
    question: "Are my files uploaded to a server?",
    answer: "The conversion code processes images in your browser rather than uploading them for conversion.",
  },
  {
    category: "Processing",
    question: "Is an account required?",
    answer: "No. You can use the conversion workspace without creating an account.",
  },
  {
    category: "Processing",
    question: "Can I use the app offline?",
    answer: "Once the page and required assets are available, conversion itself does not require a server request.",
  },
  {
    category: "Processing",
    question: "Why does conversion take time?",
    answer: "Large images require decoding, canvas drawing, and encoding work on your device.",
  },
  {
    category: "Processing",
    question: "Can large images fail?",
    answer: "Yes. Browser memory limits and supported canvas sizes vary by device.",
  },
  {
    category: "Processing",
    question: "What is the maximum image resolution?",
    answer: "The converter enforces a 40-megapixel limit.",
  },
  {
    category: "Processing",
    question: "Can I process more than one image?",
    answer: "Yes. Pending images are converted one after another.",
  },
  {
    category: "Processing",
    question: "Why does progress jump from 12% to 100%?",
    answer: "The Canvas API does not expose precise encoding progress. The intermediate indicator is not a measured percentage.",
  },
  {
    category: "Processing",
    question: "Can I change a format while conversion runs?",
    answer: "Format controls are temporarily disabled during processing to keep the queue consistent.",
  },
  {
    category: "Processing",
    question: "What happens if one conversion fails?",
    answer: "The affected row displays an error and the converter continues with other queued images.",
  },
  {
    category: "Processing",
    question: "Can I retry a failed conversion?",
    answer: "Yes. Use Convert remaining to retry failed or pending rows.",
  },
  {
    category: "Processing",
    question: "Will the browser retain my files after closing the page?",
    answer: "No persistent image library is implemented. Reloading or closing the page clears the in-memory queue.",
  },
  {
    category: "Downloads",
    question: "How do I download a converted image?",
    answer: "Use Download on its completed queue row.",
  },
  {
    category: "Downloads",
    question: "Can I download all images as a ZIP?",
    answer: "ZIP export is not included in this version. Download completed images individually.",
  },
  {
    category: "Downloads",
    question: "Why is the downloaded file named differently?",
    answer: "The app changes the extension to match the output and sanitizes unsupported filename characters.",
  },
  {
    category: "Downloads",
    question: "What happens when filenames repeat?",
    answer: "The converter adds a numeric suffix to avoid duplicate output names in the same queue.",
  },
  {
    category: "Downloads",
    question: "Where are my downloaded files saved?",
    answer: "Your browser determines the download location according to its settings.",
  },
  {
    category: "Downloads",
    question: "Can I share a converted file?",
    answer: "Yes. Once downloaded, you can share the file using your device's normal sharing tools.",
  },
  {
    category: "Privacy",
    question: "Does the app keep a history of my images?",
    answer: "No conversion history or persistent image storage is implemented in this version.",
  },
  {
    category: "Privacy",
    question: "Can other people see the images in my queue?",
    answer: "The queue exists in your browser session. Avoid leaving sensitive images open on a shared device.",
  },
  {
    category: "Privacy",
    question: "Are generated download links permanent?",
    answer: "No. Temporary object URLs are revoked when their files are removed or the page is unloaded.",
  },
  {
    category: "Privacy",
    question: "Can I convert private images?",
    answer: "Conversion is local, but use a trusted device and browser for sensitive material.",
  },
  {
    category: "Troubleshooting",
    question: "Why did the browser say the format is unsupported?",
    answer: "Your browser may not support decoding that input or encoding the requested output.",
  },
  {
    category: "Troubleshooting",
    question: "What should I try after a conversion error?",
    answer: "Try a smaller image, another supported format, or an up-to-date browser.",
  },
  {
    category: "Troubleshooting",
    question: "Why is my image blank after conversion?",
    answer: "Some source images have unusual color profiles or decoding issues. Try opening the original in another image editor.",
  },
  {
    category: "Troubleshooting",
    question: "Why did my transparent image get a white background?",
    answer: "JPEG cannot represent transparency, so the converter fills the background with white.",
  },
  {
    category: "Troubleshooting",
    question: "Why is the output larger than the original?",
    answer: "Different encoders and image formats have different compression behavior.",
  },
  {
    category: "Troubleshooting",
    question: "Why did the same image get skipped?",
    answer: "The queue filters duplicate files using their name, size, and last-modified timestamp.",
  },
  {
    category: "Troubleshooting",
    question: "Can I use a keyboard to navigate the controls?",
    answer: "Yes. The workspace uses native buttons, inputs, links, and selectors with visible focus styles.",
  },
  {
    category: "Troubleshooting",
    question: "Is there a mobile layout?",
    answer: "Yes. The two panels stack vertically on narrow screens.",
  },
  {
    category: "Troubleshooting",
    question: "Can I drag files from another application?",
    answer: "Usually, if the application exposes them as actual files during drag and drop.",
  },
  {
    category: "Troubleshooting",
    question: "Does this app resize or crop images?",
    answer: "No. Conversion retains the original decoded image dimensions.",
  },
  {
    category: "Troubleshooting",
    question: "Does this app rotate images?",
    answer: "No explicit rotate tool is included. Browser image decoding may apply embedded orientation metadata.",
  },
  {
    category: "Troubleshooting",
    question: "Does it preserve EXIF metadata?",
    answer: "Canvas re-encoding generally does not retain the original file's EXIF metadata.",
  },
];

type ConversionRecipe = {
  title: string;
  formatLabel: string;
  output: OutputFormat;
  category: string;
  description: string;
  caveat: string;
};

const conversionRecipes: ConversionRecipe[] = [
  {
    title: "Photos for websites",
    formatLabel: "JPEG",
    output: "image/jpeg",
    category: "Photographs",
    description: "Use JPEG when transparency is not needed and broad compatibility matters.",
    caveat: "Lossy encoding may soften tiny text or sharp edges.",
  },
  {
    title: "Transparent logos",
    formatLabel: "PNG",
    output: "image/png",
    category: "Brand assets",
    description: "Choose PNG for crisp logos and transparent backgrounds.",
    caveat: "Output size may be larger than WebP.",
  },
  {
    title: "Web graphics",
    formatLabel: "WebP",
    output: "image/webp",
    category: "Websites",
    description: "Use WebP for modern web imagery with transparency support.",
    caveat: "Check support in older software before sharing.",
  },
  {
    title: "Product photos",
    formatLabel: "WebP",
    output: "image/webp",
    category: "E-commerce",
    description: "Create WebP product images for a modern website workflow.",
    caveat: "Inspect text and small product details after conversion.",
  },
  {
    title: "Screenshots",
    formatLabel: "PNG",
    output: "image/png",
    category: "Documentation",
    description: "PNG is well suited to interface screenshots and small typography.",
    caveat: "Photographic screenshots may become large.",
  },
  {
    title: "Social profile image",
    formatLabel: "JPEG",
    output: "image/jpeg",
    category: "Social",
    description: "JPEG is widely accepted for photographic profile pictures.",
    caveat: "A destination platform may recompress uploads.",
  },
  {
    title: "Presentation graphics",
    formatLabel: "PNG",
    output: "image/png",
    category: "Presentations",
    description: "PNG keeps diagrams and graphic edges clear.",
    caveat: "Large transparent images can increase presentation size.",
  },
  {
    title: "Email newsletter image",
    formatLabel: "JPEG",
    output: "image/jpeg",
    category: "Email",
    description: "JPEG is a practical choice for photographic email imagery.",
    caveat: "Some email services impose separate upload limits.",
  },
  {
    title: "Blog header",
    formatLabel: "WebP",
    output: "image/webp",
    category: "Publishing",
    description: "WebP can provide a compact blog banner on supported sites.",
    caveat: "Check the blog platform's accepted formats.",
  },
  {
    title: "Archival working copy",
    formatLabel: "PNG",
    output: "image/png",
    category: "Editing",
    description: "PNG avoids JPEG-style lossy recompression for later editing.",
    caveat: "Converting an already compressed source cannot restore detail.",
  },
  {
    title: "Simple icons",
    formatLabel: "PNG",
    output: "image/png",
    category: "UI",
    description: "PNG can preserve sharp icon silhouettes and transparency.",
    caveat: "For scalable icons, an original vector file is preferable.",
  },
  {
    title: "Photography portfolio",
    formatLabel: "JPEG",
    output: "image/jpeg",
    category: "Portfolio",
    description: "JPEG is a familiar format for sharing photo previews.",
    caveat: "Retain your original files separately.",
  },
  {
    title: "Landing page illustration",
    formatLabel: "WebP",
    output: "image/webp",
    category: "Design",
    description: "WebP is a modern choice for illustrated landing pages.",
    caveat: "Always inspect transparency and edges.",
  },
  {
    title: "Support ticket screenshot",
    formatLabel: "PNG",
    output: "image/png",
    category: "Support",
    description: "PNG keeps application labels and text legible.",
    caveat: "Remove sensitive information before sharing.",
  },
  {
    title: "Chat attachment",
    formatLabel: "JPEG",
    output: "image/jpeg",
    category: "Messaging",
    description: "JPEG is compatible with many messaging apps for photos.",
    caveat: "Messaging services may alter the image again.",
  },
  {
    title: "Transparent sticker",
    formatLabel: "WebP",
    output: "image/webp",
    category: "Messaging",
    description: "WebP supports transparency and can work well for sticker-like assets.",
    caveat: "The receiving application may require special sticker dimensions.",
  },
  {
    title: "Image for a report",
    formatLabel: "PNG",
    output: "image/png",
    category: "Documents",
    description: "PNG is useful for charts, screenshots, and line art in reports.",
    caveat: "Document editors may resize or recompress the image.",
  },
  {
    title: "Event photo",
    formatLabel: "JPEG",
    output: "image/jpeg",
    category: "Events",
    description: "JPEG is a convenient output for event photography.",
    caveat: "Keep the source image if you need future editing.",
  },
  {
    title: "Portfolio thumbnail",
    formatLabel: "WebP",
    output: "image/webp",
    category: "Portfolio",
    description: "WebP can work well for thumbnail grids on modern sites.",
    caveat: "This converter does not resize thumbnails.",
  },
  {
    title: "Printable diagram",
    formatLabel: "PNG",
    output: "image/png",
    category: "Print",
    description: "PNG is a sensible raster format for line diagrams.",
    caveat: "Print quality still depends on the source resolution.",
  },
  {
    title: "Class project image",
    formatLabel: "PNG",
    output: "image/png",
    category: "Education",
    description: "PNG is useful when a class project includes text or graphics.",
    caveat: "Your learning platform may have its own size limits.",
  },
  {
    title: "Website hero photo",
    formatLabel: "WebP",
    output: "image/webp",
    category: "Websites",
    description: "WebP can reduce image transfer sizes compared with some alternatives.",
    caveat: "Actual output size depends on source content and encoding.",
  },
  {
    title: "Online listing image",
    formatLabel: "JPEG",
    output: "image/jpeg",
    category: "Marketplaces",
    description: "JPEG is commonly supported for listing photos.",
    caveat: "Check marketplace-specific dimensions and format requirements.",
  },
  {
    title: "Transparent overlay",
    formatLabel: "PNG",
    output: "image/png",
    category: "Video",
    description: "PNG preserves alpha transparency for overlays in editing software.",
    caveat: "Video editors differ in how they handle alpha channels.",
  },
  {
    title: "Digital poster",
    formatLabel: "PNG",
    output: "image/png",
    category: "Graphics",
    description: "PNG helps preserve crisp lettering in a raster poster.",
    caveat: "For large prints, source resolution is crucial.",
  },
  {
    title: "App preview screenshot",
    formatLabel: "PNG",
    output: "image/png",
    category: "Apps",
    description: "PNG works well for crisp mobile app screenshots.",
    caveat: "App stores may have strict dimension requirements.",
  },
  {
    title: "Documentation diagram",
    formatLabel: "WebP",
    output: "image/webp",
    category: "Documentation",
    description: "WebP is a modern option for diagrams on web documentation.",
    caveat: "PNG may look better for some fine line art.",
  },
  {
    title: "Photo sharing",
    formatLabel: "JPEG",
    output: "image/jpeg",
    category: "Personal",
    description: "JPEG is a straightforward choice for sharing photographs.",
    caveat: "The converter does not preserve all original metadata.",
  },
];

export default function HomePage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [notice, setNotice] = useState("");
  const [queueSearch, setQueueSearch] = useState("");
  const [queueFilter, setQueueFilter] = useState<"all" | QueueStatus>("all");
  const [showAllHelp, setShowAllHelp] = useState(false);
  const [helpSearch, setHelpSearch] = useState("");
  const [showAllRecipes, setShowAllRecipes] = useState(false);
  const [recipeFilter, setRecipeFilter] = useState<OutputFormat | "all">("all");
  const [dragging, setDragging] = useState(false);
  const [working, setWorking] = useState(false);
  const [defaultFormat, setDefaultFormat] = useState<OutputFormat>("image/webp");
  const inputRef = useRef<HTMLInputElement>(null);
  const idRef = useRef(0);
  const queueRef = useRef<QueueItem[]>([]);
  const busyRef = useRef(false);
  const dragDepthRef = useRef(0);
  const addFilesRef = useRef<(selected: FileList | File[]) => void>(() => {});

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

  addFilesRef.current = addFiles;

  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      if (busyRef.current || !event.clipboardData) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      const files = Array.from(event.clipboardData.files);
      if (files.length) {
        event.preventDefault();
        addFilesRef.current(files);
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
  const visibleQueue = queue.filter((item) => {
    const matchesStatus = queueFilter === "all" || item.status === queueFilter;
    const matchesSearch = item.file.name.toLocaleLowerCase().includes(queueSearch.trim().toLocaleLowerCase());
    return matchesStatus && matchesSearch;
  });
  const matchingHelp = helpEntries.filter((entry) => `${entry.question} ${entry.answer} ${entry.category}`.toLowerCase().includes(helpSearch.trim().toLowerCase()));
  const visibleHelp = showAllHelp || helpSearch.trim() ? matchingHelp : matchingHelp.slice(0, 8);
  const matchingRecipes = conversionRecipes.filter((recipe) => recipeFilter === "all" || recipe.output === recipeFilter);
  const visibleRecipes = showAllRecipes ? matchingRecipes : matchingRecipes.slice(0, 6);

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
        <Link className="brand" href="/" aria-label="ConvertTrio home"><span className="brand-symbol" aria-hidden="true">↗</span> ConvertTrio</Link>
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
                <div className="queue-tools"><label htmlFor="queue-search">Find file</label><input id="queue-search" type="search" placeholder="Search filenames…" value={queueSearch} onChange={(event) => setQueueSearch(event.target.value)} /><label htmlFor="queue-filter">Status</label><select id="queue-filter" value={queueFilter} onChange={(event) => setQueueFilter(event.target.value as typeof queueFilter)}><option value="all">All</option><option value="ready">Ready</option><option value="converting">Converting</option><option value="done">Completed</option><option value="error">Errors</option></select></div>
                <div className="queue-table" role="list">
                  {visibleQueue.map((item) => (
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
                  {visibleQueue.length === 0 && <p className="queue-empty" role="status">No files match your search or status filter.</p>}
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
      <section className="recipe-center" id="format-guide" aria-labelledby="recipe-title">
        <div className="recipe-heading">
          <div>
            <span className="about-kicker">FORMAT PLAYBOOK</span>
            <h2 id="recipe-title">Choose the right output.</h2>
            <p>Practical presets for everyday image workflows. Each suggestion is a starting point, not a guarantee of smaller files.</p>
          </div>
          <div className="recipe-controls">
            <label htmlFor="recipe-filter">Filter by output</label>
            <select
              id="recipe-filter"
              value={recipeFilter}
              onChange={(event) => {
                setRecipeFilter(event.target.value as typeof recipeFilter);
                setShowAllRecipes(false);
              }}
            >
              <option value="all">All formats</option>
              {formats.map((format) => (
                <option key={format.value} value={format.value}>
                  {format.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="recipe-grid">
          {visibleRecipes.map((recipe) => (
            <article className="recipe-card" key={recipe.title}>
              <div className="recipe-card-top">
                <span className="recipe-category">{recipe.category}</span>
                <span className="recipe-format">{recipe.formatLabel}</span>
              </div>
              <h3>{recipe.title}</h3>
              <p>{recipe.description}</p>
              <div className="recipe-caveat">
                <strong>Keep in mind</strong>
                <span>{recipe.caveat}</span>
              </div>
              <button
                type="button"
                className="recipe-action"
                disabled={working}
                onClick={() => {
                  applyFormatToPending(recipe.output);
                  setNotice(`Default output set to ${recipe.formatLabel}. Existing completed files were not changed.`);
                }}
              >
                Use {recipe.formatLabel} for pending files
                <span aria-hidden="true">→</span>
              </button>
            </article>
          ))}
        </div>
        {matchingRecipes.length > 6 && (
          <button
            type="button"
            className="help-more"
            aria-expanded={showAllRecipes}
            onClick={() => setShowAllRecipes((value) => !value)}
          >
            {showAllRecipes ? "Show fewer suggestions" : `View all ${matchingRecipes.length} suggestions`}
          </button>
        )}
      </section>
      <section className="help-center" id="help-center" aria-labelledby="help-title">
        <div className="help-header">
          <div>
            <span className="about-kicker">CONVERSION KNOW-HOW</span>
            <h2 id="help-title">Your image toolkit, explained.</h2>
            <p>Find answers about formats, privacy, downloads, and troubleshooting.</p>
          </div>
          <label className="help-search">
            <span>Search help</span>
            <input
              type="search"
              value={helpSearch}
              onChange={(event) => setHelpSearch(event.target.value)}
              placeholder="Search a topic…"
            />
          </label>
        </div>
        <div className="help-list">
          {visibleHelp.map((entry) => (
            <details className="help-entry" key={entry.question}>
              <summary>
                <span className="help-category">{entry.category}</span>
                <span className="help-question">{entry.question}</span>
                <span className="help-expand" aria-hidden="true">+</span>
              </summary>
              <p>{entry.answer}</p>
            </details>
          ))}
          {visibleHelp.length === 0 && (
            <p className="help-empty" role="status">
              No matching help articles. Try a different search term.
            </p>
          )}
        </div>
        {!helpSearch.trim() && matchingHelp.length > 8 && (
          <button
            type="button"
            className="help-more"
            aria-expanded={showAllHelp}
            onClick={() => setShowAllHelp((current) => !current)}
          >
            {showAllHelp ? "Show fewer answers" : `Browse all ${matchingHelp.length} answers`}
          </button>
        )}
      </section>
      <footer><span>© {new Date().getFullYear()} ConvertTrio</span><span>Built for quick, private conversions.</span></footer>
    </main>
  );
}
