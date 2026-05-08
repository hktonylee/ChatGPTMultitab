const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("chatgptTabs", {
  getState: () => ipcRenderer.invoke("tabs:getState"),
  createTab: (url) => ipcRenderer.invoke("tabs:create", url),
  activateTab: (id) => ipcRenderer.invoke("tabs:activate", id),
  closeTab: (id) => ipcRenderer.invoke("tabs:close", id),
  restoreClosedTab: () => ipcRenderer.invoke("tabs:restoreClosed"),
  openExternal: () => ipcRenderer.invoke("tabs:openExternal"),
  onStateChange: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("tabs:state", listener);
    return () => ipcRenderer.removeListener("tabs:state", listener);
  },
});
