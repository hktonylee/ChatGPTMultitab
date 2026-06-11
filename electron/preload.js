const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("chatgptTabs", {
  getState: () => ipcRenderer.invoke("tabs:getState"),
  createTab: (url) => ipcRenderer.invoke("tabs:create", url),
  activateTab: (id) => ipcRenderer.invoke("tabs:activate", id),
  closeTab: (id) => ipcRenderer.invoke("tabs:close", id),
  restoreClosedTab: () => ipcRenderer.invoke("tabs:restoreClosed"),
  showNewTabMenu: () => ipcRenderer.invoke("tabs:showNewTabMenu"),
  showTabContextMenu: (id) => ipcRenderer.send("tabs:showContextMenu", id),
  toggleSearch: () => ipcRenderer.invoke("tabs:toggleSearch"),
  openSearch: () => ipcRenderer.invoke("tabs:openSearch"),
  closeSearch: () => ipcRenderer.invoke("tabs:closeSearch"),
  onStateChange: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("tabs:state", listener);
    return () => ipcRenderer.removeListener("tabs:state", listener);
  },
  onSearchOpened: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("tabs:searchOpened", listener);
    return () => ipcRenderer.removeListener("tabs:searchOpened", listener);
  },
});
