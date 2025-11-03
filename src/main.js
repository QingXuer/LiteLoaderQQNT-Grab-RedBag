// 运行在 Electron 主进程 下的插件入口（新版 RM-IPC 兼容 / 无日志落盘）
const { ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

const { pluginLog } = require("./utils/logUtils");
const { Config } = require("./Config");

const pluginPath = path.join(LiteLoader.plugins.grab_redbag.path.plugin); // 插件目录
const configPath = path.join(LiteLoader.plugins.grab_redbag.path.data, "config.json");
const config = Config.config;

onLoad(); // 启动！

const chatWindows = []; // 收集聊天窗口（QQ 主窗口）

/**
 * 创建窗口时触发：仅保留 webContentsId 的同步提供，以及记录主窗口引用。
 * 不再修改任何私有 _events（旧版 ipc 拦截已删除）。
 */
module.exports.onBrowserWindowCreated = (window) => {
  // 供 preload 同步获取 webContentsId
  window.webContents.on("ipc-message-sync", (event, channel) => {
    if (channel === "___!boot") {
      event.returnValue = {
        enabled: true,
        webContentsId: String(window.webContents.id),
      };
    }
  });

  // 记录 QQ 主窗口（通常 id === 2），用于群发消息
  window.webContents.on("did-stop-loading", () => {
    if (window.id === 2 && chatWindows.length === 0) {
      chatWindows.push(window);
      pluginLog("已收集 QQ 主窗口引用（用于群发消息）");
    }
  });
};

/**
 * 主进程向所有渲染进程中的聊天窗口广播消息
 */
function sendMsgToChatWindows(message, args) {
  pluginLog("主进程广播消息到所有聊天窗口");
  for (const win of chatWindows) {
    if (win.isDestroyed()) continue;
    try {
      win.webContents.send(message, args);
    } catch (e) {
      // 静默失败，避免中断
    }
  }
}

function onLoad() {
  pluginLog("grab_redbag 插件启动");

  // 菜单 / 配置
  ipcMain.handle(
    "LiteLoader.grab_redbag.getMenuHTML",
    () => fs.readFileSync(path.join(pluginPath, "src/pluginMenu.html"), "utf-8")
  );
  ipcMain.handle("LiteLoader.grab_redbag.getConfig", () => Config.getConfig());
  ipcMain.handle("LiteLoader.grab_redbag.setConfig", async (_event, newConfig) => {
    return Config.setConfig(newConfig);
  });

  // 业务统计
  ipcMain.handle("LiteLoader.grab_redbag.addTotalRedBagNum", (_event, num) => {
    Config.setConfig({ totalRedBagNum: config.totalRedBagNum + num });
  });
  ipcMain.handle("LiteLoader.grab_redbag.addTotalAmount", (_event, amount) => {
    Config.setConfig({ totalAmount: config.totalAmount + amount });
  });

  // 群发消息到各聊天窗口（渲染层触发）
  ipcMain.on("LiteLoader.grab_redbag.sendMsgToChatWindows", (_event, message, args) => {
    pluginLog("主进程准备处理 sendMsgToChatWindows");
    sendMsgToChatWindows(message, args);
  });

  // 初始化配置
  Config.initConfig(pluginPath, configPath);
}
