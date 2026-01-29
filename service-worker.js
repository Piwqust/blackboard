// Open editor page when extension icon is clicked
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: 'editor.html' });
});
