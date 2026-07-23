const CHATGPT_HOSTNAMES = new Set(["chatgpt.com", "www.chatgpt.com"]);

function isSecureChatGptUrl(url) {
  try {
    const parsedUrl = new URL(url);

    return parsedUrl.protocol === "https:" && CHATGPT_HOSTNAMES.has(parsedUrl.hostname.toLowerCase());
  } catch (_error) {
    return false;
  }
}

function createPopupOpenHandler({ createTab, openExternal }) {
  return ({ url }) => {
    if (isSecureChatGptUrl(url)) {
      createTab(url);
    } else {
      openExternal(url);
    }

    return { action: "deny" };
  };
}

module.exports = {
  createPopupOpenHandler,
};
