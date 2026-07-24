export const safeFormatUrl = (url) => {
  if (!url) return null;
  try {
    return formatUrl ? formatUrl(url) : url;
  } catch (err) {
    return url;
  }
};
