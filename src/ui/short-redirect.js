// A real directory works on GitHub Pages project paths without server rewrites.
const id = location.hash.slice(1);
if (/^[A-Za-z0-9_-]{22}$/.test(id)) {
  const url = new URL('../read.html', location.href);
  url.searchParams.set('s', id);
  location.replace(url.href);
} else {
  document.getElementById('shortLinkMessage').textContent = 'This short link is incomplete. Copy the whole address, including the part after #.';
}
