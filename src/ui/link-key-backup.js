import { createShareStore } from "../core/share-store.js";
import { shortLinksEndpoint, shortLinkUrl } from "../core/short-links.js";
import { exportLinkKeys, importLinkKeys } from "../core/link-key-backup.js";
import { bindModalDialog } from "./dialogs.js";

export function setupLinkKeyBackup({ baseUrl, openSettings }) {
  const store = createShareStore(),
    button = document.createElement("button");
  button.type = "button";
  button.id = "linkKeyBackupBtn";
  button.className = "settings-action";
  button.textContent = "Link management backup…";
  document.getElementById("exportWorkspaceBtn").parentElement.after(button);
  const dialog = document.createElement("dialog");
  dialog.className = "backup-dialog";
  dialog.id = "linkKeyBackupDialog";
  dialog.setAttribute("aria-labelledby", "linkKeyBackupTitle");
  dialog.innerHTML =
    '<div class="backup-dialog-surface"><h2 id="linkKeyBackupTitle">Link management backup</h2><p class="dialog-note">This encrypted file contains private keys for disabling shared links. Keep it private and retain the passphrase. It contains no note text and is separate from your workspace backup.</p><label>Passphrase (at least 8 characters)<input id="linkKeyPassphrase" type="password" minlength="8" autocomplete="new-password"></label><div class="backup-dialog-actions"><button id="exportLinkKeysBtn" type="button">Export encrypted keys</button><label class="secondary-btn">Choose key backup<input id="importLinkKeysFile" type="file" accept=".json" hidden></label><button id="closeLinkKeysBtn" type="button">Close</button></div><p id="linkKeyBackupStatus" class="dialog-note" role="status"></p></div>';
  document.body.append(dialog);
  let launcher;
  const close = () => {
    dialog.querySelector("#linkKeyPassphrase").value = "";
    dialog.close();
    openSettings();
    launcher?.focus();
  };
  bindModalDialog(dialog, close);
  dialog.addEventListener("click", (event) => {
    event.stopPropagation();
    if (event.target === dialog) close();
  });
  dialog.querySelector("#closeLinkKeysBtn").addEventListener("click", close);
  button.addEventListener("click", () => {
    launcher = button;
    dialog.querySelector("#linkKeyPassphrase").value = "";
    dialog.querySelector("#linkKeyBackupStatus").textContent = "";
    dialog.showModal();
  });
  const passphrase = dialog.querySelector("#linkKeyPassphrase"),
    status = dialog.querySelector("#linkKeyBackupStatus");
  const exportButton = dialog.querySelector("#exportLinkKeysBtn");
  exportButton.addEventListener("click", async () => {
    exportButton.disabled = true;
    try {
      const text = await exportLinkKeys(await store.list(), passphrase.value),
        url = URL.createObjectURL(
          new Blob([text], { type: "application/json" }),
        ),
        link = document.createElement("a");
      link.href = url;
      link.download = "blackboard-link-management.blackboard-keys.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      status.textContent =
        "Encrypted key backup exported. Keep the file and passphrase private.";
    } catch (error) {
      status.textContent = error.message;
    } finally {
      exportButton.disabled = false;
    }
  });
  dialog
    .querySelector("#importLinkKeysFile")
    .addEventListener("change", async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      event.target.disabled = true;
      try {
        if (file.size > 3_000_000)
          throw new Error("This link-key backup is too large.");
        const records = await importLinkKeys(
          await file.text(),
          passphrase.value,
          shortLinksEndpoint(),
        );
        records.forEach((record) => {
          record.url = shortLinkUrl(baseUrl(), record.id);
        });
        await store.merge(records);
        status.textContent =
          records.length +
          " link controls restored. No copies were uploaded or changed.";
      } catch (error) {
        status.textContent = error.message;
      } finally {
        event.target.value = "";
        event.target.disabled = false;
      }
    });
}
