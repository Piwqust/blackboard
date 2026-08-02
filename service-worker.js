// Chrome/Edge focus an existing options page when possible. This prevents the
// old last-write-wins failure caused by opening a fresh editor tab every time.
chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});
