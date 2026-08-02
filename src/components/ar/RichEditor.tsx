"use client";

import React, { useEffect, useRef, useCallback } from "react";
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link2,
  ImagePlus,
  Loader2,
} from "lucide-react";

interface RichEditorProps {
  value: string;
  onChange: (html: string) => void;
  /**
   * Upload an image and resolve to a URL to embed. Typically uploads to Convex
   * storage; callers may fall back to a data URL when offline.
   */
  onUploadImage: (file: File) => Promise<string>;
  placeholder?: string;
}

// A deliberately small contentEditable rich-text editor. No third-party
// dependency — it emits the limited HTML vocabulary that lib/sanitize.ts
// whitelists (headings, lists, quotes, links, inline images). Perfect for
// authoring blog-style target descriptions that must also work offline.
export function RichEditor({
  value,
  onChange,
  onUploadImage,
  placeholder = "Write the description… use the toolbar for headings, lists, and images.",
}: RichEditorProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = React.useState(false);
  // Track the selection range so an image inserts where the caret was, even
  // after focus moves to the (non-editable) toolbar/file picker.
  const savedRange = useRef<Range | null>(null);

  // Seed the editor once from `value`; afterwards the DOM is the source of
  // truth (re-writing innerHTML on every keystroke would reset the caret).
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = useCallback(() => {
    if (ref.current) onChange(ref.current.innerHTML);
  }, [onChange]);

  const saveSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && ref.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
  }, []);

  const restoreSelection = useCallback(() => {
    const sel = window.getSelection();
    if (savedRange.current && sel) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
  }, []);

  // execCommand is deprecated but remains the pragmatic, dependency-free way to
  // do WYSIWYG editing across browsers; the output HTML is sanitized on render.
  const exec = useCallback(
    (command: string, arg?: string) => {
      ref.current?.focus();
      restoreSelection();
      document.execCommand(command, false, arg);
      emit();
    },
    [emit, restoreSelection]
  );

  const addLink = useCallback(() => {
    saveSelection();
    const url = window.prompt("Link URL");
    if (url) exec("createLink", url);
  }, [exec, saveSelection]);

  const insertImage = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const url = await onUploadImage(file);
        ref.current?.focus();
        restoreSelection();
        document.execCommand("insertImage", false, url);
        emit();
      } catch (e) {
        console.error("Image insert failed", e);
        window.alert("Could not add image.");
      } finally {
        setUploading(false);
      }
    },
    [onUploadImage, emit, restoreSelection]
  );

  const btn =
    "p-2 rounded-lg text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors disabled:opacity-40";

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-800 overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-zinc-700 bg-zinc-800/80">
        <button type="button" title="Bold" className={btn} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("bold")}>
          <Bold className="w-4 h-4" />
        </button>
        <button type="button" title="Italic" className={btn} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("italic")}>
          <Italic className="w-4 h-4" />
        </button>
        <span className="w-px h-5 bg-zinc-700 mx-1" />
        <button type="button" title="Heading" className={btn} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("formatBlock", "H2")}>
          <Heading2 className="w-4 h-4" />
        </button>
        <button type="button" title="Subheading" className={btn} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("formatBlock", "H3")}>
          <Heading3 className="w-4 h-4" />
        </button>
        <span className="w-px h-5 bg-zinc-700 mx-1" />
        <button type="button" title="Bullet list" className={btn} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertUnorderedList")}>
          <List className="w-4 h-4" />
        </button>
        <button type="button" title="Numbered list" className={btn} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertOrderedList")}>
          <ListOrdered className="w-4 h-4" />
        </button>
        <button type="button" title="Quote" className={btn} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("formatBlock", "BLOCKQUOTE")}>
          <Quote className="w-4 h-4" />
        </button>
        <span className="w-px h-5 bg-zinc-700 mx-1" />
        <button type="button" title="Link" className={btn} onMouseDown={(e) => e.preventDefault()} onClick={addLink}>
          <Link2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          title="Insert image"
          className={btn}
          disabled={uploading}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            saveSelection();
            fileRef.current?.click();
          }}
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) insertImage(file);
            e.target.value = "";
          }}
        />
      </div>

      {/* Editable surface */}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        onKeyUp={saveSelection}
        onMouseUp={saveSelection}
        data-placeholder={placeholder}
        className="prose-guide min-h-[220px] max-h-[420px] overflow-y-auto px-4 py-3 text-sm text-zinc-100 focus:outline-none rich-editor"
      />
    </div>
  );
}
