const { isChatGptUrl } = require("./session-state");

const CHAT_PAGE_CSS = 'div[popover="manual"] { left:anchor(right); }';

function installChatPageCss(
  webContents,
  onError = (error) => console.warn(`Failed to inject ChatGPT page CSS: ${error.message}`),
) {
  webContents.on("dom-ready", async () => {
    try {
      if (!isChatGptUrl(webContents.getURL())) {
        return;
      }

      await webContents.insertCSS(CHAT_PAGE_CSS);
    } catch (error) {
      onError(error);
    }
  });
}

module.exports = {
  CHAT_PAGE_CSS,
  installChatPageCss,
};
