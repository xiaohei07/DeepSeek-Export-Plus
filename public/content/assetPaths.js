// The archive uses readable filenames; browser links use URI-encoded paths.
export function readableAssetPath(href) {
  if (typeof href !== "string") return "";
  try {
    const decoded = decodeURIComponent(href);
    return /^assets\/[^/\\\x00-\x1f]+$/.test(decoded) &&
      !/^assets\/(?:\.|\.\.)$/.test(decoded) &&
      !/[?#]/.test(href)
      ? decoded
      : href;
  } catch {
    return href;
  }
}

export function wordAttachmentTarget(href) {
  if (readableAssetPath(href) === href) return href;
  // Word cannot resolve UTF-8 percent escapes in local Unicode filenames.
  // Keep ASCII escapes: # is an anchor, and a literal % must remain %25.
  return href.replace(/(?:%[89a-f][0-9a-f])+/gi, (part) =>
    decodeURIComponent(part),
  );
}
