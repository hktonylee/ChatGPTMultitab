const CHAT_PAGE_CSS = 'div[popover="manual"] { left:anchor(right); }';

function installChatPageCss(
  webContents,
  onError = (error) => console.warn(`Failed to inject ChatGPT page CSS: ${error.message}`),
) {
  webContents.on("dom-ready", () => webContents.insertCSS(CHAT_PAGE_CSS).catch(onError));
}

module.exports = {
  CHAT_PAGE_CSS,
  installChatPageCss,
};
