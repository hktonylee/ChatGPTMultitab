function getBrowserUserAgent(userAgent, appName) {
  const appProduct = `${appName.replaceAll(" ", "")}/`;
  return userAgent.split(" ")
    .filter((product) => !product.startsWith(appProduct) && !product.startsWith("Electron/"))
    .join(" ");
}

module.exports = { getBrowserUserAgent };
