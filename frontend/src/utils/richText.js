function extractText(node) {
  if (!node) return '';
  if (node.type === 'text') return node.text || '';
  if (!node.content) return '';
  return node.content.map(extractText).join(' ');
}

export function getPreviewText(raw, wordLimit = 20) {
  if (!raw) return { preview: '', truncated: false };

  let plainText = '';

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.type === 'doc') {
        plainText = extractText(parsed);
      } else {
        plainText = raw;
      }
    } catch {
      plainText = raw;
    }
  } else if (typeof raw === 'object') {
    plainText = extractText(raw);
  }

  const normalised = plainText.replace(/\s+/g, ' ').trim();
  const words = normalised.split(' ').filter(Boolean);

  if (words.length <= wordLimit) {
    return { preview: normalised, truncated: false };
  }

  return {
    preview: words.slice(0, wordLimit).join(' '),
    truncated: true,
  };
}

export function isRichContent(raw) {
  if (!raw || typeof raw !== 'string') return false;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && parsed.type === 'doc';
  } catch {
    return false;
  }
}