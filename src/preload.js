// Electron 主进程 与 渲染进程 交互的桥梁（仅新版 RM_IPC）
const { contextBridge, ipcRenderer } = require("electron");

/** 读取 webContentsId（与主进程保持一致），无法获取时兜底为 2；再参考 ipconly 的 URL 兜底 */
let webContentsId = 2;
try {
  const boot = ipcRenderer.sendSync("___!boot");
  if (boot && boot.webContentsId) webContentsId = boot.webContentsId;
} catch {}
// —— 参考你的 ipconly：URL 兜底 —— //
try {
  if (!webContentsId || webContentsId === 2) {
    const m = global.location?.search?.match(/webcontentsid=(\d+)/i);
    if (m) webContentsId = Number(m[1]);
  }
} catch {}

/** 新版 RM_IPC 上下行事件名（仅按 ipconly 思路：主通道 + 主窗口2 兜底，不建通道池） */
const UP_EVENT = `RM_IPCTO_MAIN${webContentsId}`;       // 渲染 -> 主进程
const DOWN_PRIMARY  = `RM_IPCFROM_MAIN${webContentsId}`; // 主进程 -> 渲染（当前窗口）
const DOWN_MAIN2    = `RM_IPCFROM_MAIN2`;                // 常见“主窗口=2”的兜底

// 暴露给 grabRedBag.js 做事件兜底缓存 self（可无）
try {
  globalThis.__GRAB_RM_UP__   = UP_EVENT;
  globalThis.__GRAB_RM_DOWN__ = DOWN_PRIMARY;
} catch {}

// ===== 对外 API：与旧版保持一致的调用面（但底层仅走 RM_IPC） =====
contextBridge.exposeInMainWorld("grab_redbag", {
  // 配置 & 菜单
  getMenuHTML: () => ipcRenderer.invoke("LiteLoader.grab_redbag.getMenuHTML"),
  getConfig:    () => ipcRenderer.invoke("LiteLoader.grab_redbag.getConfig"),
  setConfig:   (newConfig) => ipcRenderer.invoke("LiteLoader.grab_redbag.setConfig", newConfig),

  // 业务累计统计
  addTotalRedBagNum: (num)    => ipcRenderer.invoke("LiteLoader.grab_redbag.addTotalRedBagNum", num),
  addTotalAmount:    (amount) => ipcRenderer.invoke("LiteLoader.grab_redbag.addTotalAmount", amount),

  // 渲染层普通事件（设置页开关等）
  addEventListener: (channel, func) => ipcRenderer.on(channel, (_e, ...args) => func(...args)),

  // 广播消息到所有聊天窗口
  sendMsgToChatWindows: (message, arg) => {
    ipcRenderer.send("LiteLoader.grab_redbag.sendMsgToChatWindows", message, arg);
  },

  // QQ 内核：通用调用器 + 事件订阅
  invokeNative:     (eventName, cmdName, registered, ...args) => invokeNative(eventName, cmdName, registered, ...args),
  subscribeEvent:   (cmdName, handler) => subscribeEvent(cmdName, handler),
  unsubscribeEvent: (handler) => unsubscribeEvent(handler),
});

/**
 * 通用调用器（新版 RM_IPC）：按 ipconly 思路监听“当前通道 + MAIN2 兜底”
 */
function invokeNative(eventName, cmdName, registered, ...args) {
  return new Promise((resolve) => {
    const callbackId =
      (globalThis.crypto?.randomUUID && crypto.randomUUID()) ||
      `${Date.now()}_${Math.random().toString(16).slice(2)}`;

    const onReply = (_evt, ...argv) => {
      try {
        const body = argv?.[1]; // 新版：argv[1] 为主体
        if (body && body.callbackId === callbackId) {
          // 命中回包 -> 解绑两个通道
          try { ipcRenderer.off(DOWN_PRIMARY, onReply); } catch {}
          try { ipcRenderer.off(DOWN_MAIN2,   onReply); } catch {}
          resolve(Object.prototype.hasOwnProperty.call(body, "result") ? body.result : body);
        }
      } catch {
        try { ipcRenderer.off(DOWN_PRIMARY, onReply); } catch {}
        try { ipcRenderer.off(DOWN_MAIN2,   onReply); } catch {}
        resolve(undefined);
      }
    };

    // 绑定主通道 + MAIN2 兜底
    try { ipcRenderer.on(DOWN_PRIMARY, onReply); } catch {}
    try { ipcRenderer.on(DOWN_MAIN2,   onReply); } catch {}

    // 发送请求（仅新版 RM_IPC 上行）
    ipcRenderer.send(
      UP_EVENT,
      {
        type: "request",
        callbackId,
        eventName: `${eventName}-${webContentsId}${registered ? "-register" : ""}`,
      },
      [cmdName, ...args]
    );
  });
}

/**
 * 订阅 QQ 内核事件（仅新版 RM_IPC）：主通道 + MAIN2 兜底
 * 返回实际注册到 ipcRenderer 的 listener（用于取消订阅）
 */
function subscribeEvent(cmdName, handler) {
  const listener = (_event, ...args) => {
    const body = args?.[1]; // { cmdName, payload, ... }
    if (body && body.cmdName === cmdName) {
      try { handler(body.payload); } catch {}
    }
  };
  try { ipcRenderer.on(DOWN_PRIMARY, listener); } catch {}
  try { ipcRenderer.on(DOWN_MAIN2,   listener); } catch {}
  return listener;
}

/**
 * 取消订阅（仅新版 RM_IPC）：对两条通道解绑
 */
function unsubscribeEvent(handler) {
  try { ipcRenderer.off(DOWN_PRIMARY, handler); } catch {}
  try { ipcRenderer.off(DOWN_MAIN2,   handler); } catch {}
}
