"use client";

import { useRef } from "react";

export function ImageSearchInput({
  disabled,
  onSelect,
}: {
  disabled: boolean;
  onSelect(file: File): void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="image-search-input">
      <label htmlFor="global-image-search-file">Job poster image</label>
      <input
        ref={input}
        id="global-image-search-file"
        type="file"
        accept="image/png,image/jpeg,.png,.jpg,.jpeg"
        disabled={disabled}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) onSelect(file);
          event.currentTarget.value = "";
        }}
      />
      <p>One static PNG or JPEG, up to 5 MB and 20 megapixels.</p>
    </div>
  );
}
