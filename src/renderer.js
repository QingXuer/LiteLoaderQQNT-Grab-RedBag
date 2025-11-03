// 运行在 Electron 渲染进程 下的页面脚本（仅新版 RM_IPC）
import { pluginLog } from "./utils/frontLogUtils.js";
import { SettingListeners } from "./utils/SettingListeners.js";
import { grabRedBag } from "./utils/grabRedBag.js";

const grAPI = window.grab_redbag;

// ============ 新版 IPC 监听通道 ============
const CHANNEL_RECV   = "nodeIKernelMsgListener/onRecvMsg";                 // 主消息通道
const CHANNEL_RECENT = "nodeIKernelRecentContactListener/onRecentContactChanged"; // 最近会话通道（备用）
let listeners = [];
let hasActived = false;

await onLoad();

// ============ 打开设置界面时触发 ============
export const onSettingWindowCreated = async (view) => {
  try {
    const parser = new DOMParser();
    const settingHTML = parser
      .parseFromString(await grAPI.getMenuHTML(), "text/html")
      .querySelector(".config-menu");

    const myListener = new SettingListeners(settingHTML);
    await myListener.onLoad();
    view.appendChild(settingHTML);
  } catch (e) {
    console.error("[GrabRedBag] 设置界面加载错误:", e);
  }
};

// ============ 统一管理监听器 ============
function unsubscribeAll() {
  if (!listeners.length) return;
  for (const l of listeners) {
    try { grAPI.unsubscribeEvent(l); } catch {}
  }
  listeners = [];
}

const DEBUG = 0; // ← 调试开关：1=开启日志，0=关闭日志

function subscribeAll() {
  const recvListener = grAPI.subscribeEvent(CHANNEL_RECV, (payload) => {
    if (DEBUG) {
      try {
        console.log("[GRB:RECV][onRecvMsg] recv payload =", payload);
      } catch (e) {
        console.log("[GRB:RECV][onRecvMsg] recv payload (stringified failed)");
      }
      console.log("[GRB:RECV] -> call grabRedBag()");
    }
    grabRedBag(payload);
  });

  const recentListener = grAPI.subscribeEvent(CHANNEL_RECENT, (payload) => {
    if (DEBUG) {
      try {
        console.log("[GRB:RECV][onRecentContactChanged] payload =", payload);
      } catch (e) {
        console.log("[GRB:RECV][onRecentContactChanged] payload (stringified failed)");
      }
      console.log("[GRB:RECV] (recent) -> call grabRedBag()");
    }
    grabRedBag(payload);
  });

  listeners.push(recvListener, recentListener);
  if (DEBUG) console.log("[GrabRedBag] 已启动红包监听（onRecvMsg / onRecentContactChanged）");
}

// ============ 初始化加载 ============
async function onLoad() {
  if (location.hash === "#/blank") {
    navigation.addEventListener("navigatesuccess", onHashUpdate, { once: true });
  } else {
    await onHashUpdate();
  }
  pluginLog("[GrabRedBag] onLoad 完成");
}

async function onHashUpdate() {
  const hash = location.hash;
  // 你的环境条件若需要可保留；此处不做改动。
  // if ((window.webContentId ?? window.webContentsId) !== 2) return;
  if (hash === "#/blank") return;
  if (!(hash.includes("#/main/message") || hash.includes("#/chat"))) return;

  // 外部控制订阅开关
  grAPI.addEventListener("LiteLoader.grab_redbag.unSubscribeListener", () => {
    unsubscribeAll();
    pluginLog("[GrabRedBag] 收到指令 -> 已关闭红包监听");
  });

  grAPI.addEventListener("LiteLoader.grab_redbag.subscribeListener", () => {
    unsubscribeAll();
    subscribeAll();
    pluginLog("[GrabRedBag] 收到指令 -> 启用红包监听");
  });

  pluginLog("[GrabRedBag] onHashUpdate 执行");

  try {
    const cfg = await grAPI.getConfig();
    console.log("[GRB:RECV] current config =", cfg);

    if (!cfg.isActive) {
      pluginLog("[GrabRedBag] 功能未启用，不监听红包事件");
      unsubscribeAll();
      return;
    }

    unsubscribeAll();
    subscribeAll();

    // 加群事件：激活全部群聊
    grAPI.subscribeEvent("onGroupListUpdate", async (payload) => {
      if (hasActived) return;
      hasActived = true;
      const conf = await grAPI.getConfig();
      if (conf.isActiveAllGroups) {
        pluginLog("[GrabRedBag] 检测到新群列表，激活所有群聊");
        await activeAllGroups(payload.groupList);
      }
    });

    // 获取群列表
    const result = await grAPI.invokeNative("ns-NodeStoreApi", "getGroupList", false);
    console.log("[GRB:RECV] getGroupList =", result);

  } catch (e) {
    console.error("[GrabRedBag] onHashUpdate 错误:", e);
  }
}

// ============ 激活所有群聊 ============
async function activeAllGroups(groupList) {
  for (const group of groupList) {
    await grAPI.invokeNative(
      "ns-ntApi",
      "nodeIKernelMsgService/getAioFirstViewLatestMsgsAndAddActiveChat",
      false,
      { peer: { chatType: 2, peerUid: group.groupCode, guildId: "" }, cnt: 0 },
      null
    );
    pluginLog(`[GrabRedBag] 已激活群聊: ${group.groupName}(${group.groupCode})`);
  }
}
