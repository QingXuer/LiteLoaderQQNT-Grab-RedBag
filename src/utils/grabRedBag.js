import { pluginLog } from "./frontLogUtils.js";

const API = window.grab_redbag;

// ============= 小工具 =============
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const within = (ms, tag, p) =>
  Promise.race([p, new Promise((_,rej)=>setTimeout(()=>rej(new Error(`TIMEOUT:${tag}`)),ms))])
    .then(res => ({ok:true,res})).catch(err=>({ok:false,err}));

const toBytes = (obj) => {
  if (!obj) return null;
  if (typeof obj === "string") return obj;
  if (Array.isArray(obj)) return Uint8Array.from(obj);
  if (typeof obj === "object") {
    const ks = Object.keys(obj).filter(k=>/^\d+$/.test(k)).sort((a,b)=>a-b);
    if (!ks.length) return obj;
    return Uint8Array.from(ks.map(k=>obj[k]));
  }
  return obj;
};

const inMuteRange = (start, end) => {
  const now = new Date();
  const cur = now.getHours()*60 + now.getMinutes();
  const [sh,sm] = start.split(":").map(Number); const [eh,em] = end.split(":").map(Number);
  const s = sh*60+sm, e = eh*60+em;
  return s<e ? (cur>=s && cur<e) : (cur>=s || cur<e);
};

const looksLikeMsg = (m)=> m && typeof m==="object" && Array.isArray(m.elements) && ("msgSeq" in m) && ("peerUid" in m) && ("chatType" in m);

const DEFAULT_CFG = {
  blockType: "0",
  listenKeyWords: [], listenGroups: [], listenQQs: [],
  avoidKeyWords: [],  avoidGroups:  [], avoidQQs:  [],
  notificationonly: false,
  stopGrabByTime: false, stopGrabStartTime: "00:00", stopGrabEndTime: "00:00",
  antiDetect: false, useSelfNotice: false,
  useRandomDelay: false, delayLowerBound: 0, delayUpperBound: 0,
  delayLowerBoundForSend: 0, delayUpperBoundForSend: 0,
  thanksMsgs: [], Send2Who: [],
  receiveMsg: "[Grab RedBag]来自群\"%peerName%(%peerUid%)\"成员:\"%senderName%(%sendUin%)\" 收到金额 %amount% 元",
};

async function getConfigSafe() {
  const r = await within(800, "getConfig", Promise.resolve().then(()=>API.getConfig()));
  if (!r.ok) return {...DEFAULT_CFG};
  return {...DEFAULT_CFG, ...(r.res||{})};
}

// ====== 自 UIN：先读缓存；必要时快速预热一次 ======
//目前无法读取自己uin故失效
function readSelfCache() {
  const c = (typeof window !== "undefined" && window.__GRB_SELF__) || {};
  if (c?.uin && c.uin !== "0") return { uin: String(c.uin), uid: c.uid || "", nickName: c.nickName || "", from: c.from || "" };
  try {
    const auth = app?.__vue_app__?.config?.globalProperties?.$store?.state?.common_Auth?.authData;
    if (auth?.uin) return { uin:String(auth.uin), uid: auth.uid, nickName: auth.nickName, from:"vue-store-direct" };
  } catch {}
  return null;
}

async function warmUpSelfOnce() {
  if (!API || !API.invokeNative) return null;
  const calls = [
    ['nodeIKernelLoginService/getCurrentUin', {}],
    ['nodeIKernelLoginService/getLoginInfo', {}],
    ['nodeIKernelLoginService/getUinLoginInfo', {}],
    ['nodeIKernelProfileService/getSelfProfileSimple', {}],
    ['nodeIKernelProfileService/getSelfInfo', {}],
    ['nodeIKernelAccountService/getAccountInfo', {}],
    ['nodeIKernelFriendService/getSelfInfo', {}],
  ];
  for (const [fn, body] of calls) {
    const r = await within(900, fn, API.invokeNative('ns-ntApi', fn, false, body));
    if (r.ok) {
      const data = r.res || {};
      const cand = data.loginInfo || data.profile || data.accountInfo || data.selfInfo || data;
      const uin = cand?.uin && String(cand.uin);
      if (uin && uin !== "0") {
        window.__GRB_SELF__ = window.__GRB_SELF__ || {};
        window.__GRB_SELF__.uin = uin;
        window.__GRB_SELF__.uid = cand.uid || cand.tinyId || "";
        window.__GRB_SELF__.nickName = cand.nickName || cand.nickname || "";
        window.__GRB_SELF__.from = `warm:${fn}`;
        return { uin: window.__GRB_SELF__.uin, uid: window.__GRB_SELF__.uid, nickName: window.__GRB_SELF__.nickName };
      }
    }
  }
  return null;
}

// ====== 反检测状态 ======
const grabbedBills = new Set();
let antiDetectGroups = [];
const antiDetectTime = 300000;

// ============= 主入口 ============
export async function grabRedBag(payload) {
  try {
    const msg = await normalize(payload);
    if (!msg) return;

    const el = (msg.elements||[]).find(x => x && x.elementType===9 && x.walletElement);
    if (!el) return;

    const w = el.walletElement;
    pluginLog("收到了红包消息！！！");

    const billNo = w.billNo || `${msg.msgSeq}:${w.authkey||""}`; // 仍保留去重
    if (grabbedBills.has(billNo)) return;
    grabbedBills.add(billNo);

    const chatType  = msg.chatType;
    const peerUid   = msg.peerUid;
    const peerName  = msg.peerName || "";
    const msgSeq    = String(msg.msgSeq || "");
    const sendUin   = msg.senderUin || "";
    const senderName= msg.sendRemarkName || msg.sendMemberName || msg.sendNickName || "";

    const pcBody    = toBytes(w.pcBody);
    const index     = toBytes(w.stringIndex);
    const title     = (w.receiver?.title || w.title || "QQ红包").toString().trim() || "QQ红包";
    const redChannel= w.redChannel;

    const cfg = await getConfigSafe();
    if (cfg.stopGrabByTime && inMuteRange(cfg.stopGrabStartTime, cfg.stopGrabEndTime)) return;
    if (antiDetectGroups.includes(peerUid)) return;

    // 白/黑名单
    switch (cfg.blockType) {
      case "1": {
        const passKW = (cfg.listenKeyWords.length===0) || cfg.listenKeyWords.some(wd=>title.includes(wd));
        const passG  = (cfg.listenGroups.length===0)   || cfg.listenGroups.includes(peerUid);
        const passQ  = (cfg.listenQQs.length===0)      || cfg.listenQQs.includes(sendUin);
        if (!(passKW && passG && passQ)) return;
        break;
      }
      case "2": {
        const hit = cfg.avoidKeyWords.some(wd=>title.includes(wd)) || cfg.avoidGroups.includes(peerUid) || cfg.avoidQQs.includes(sendUin);
        if (hit) return;
        break;
      }
    }

    // ===== 只提醒不抢：提到最前，且优先使用 Send2Who，无需依赖 self =====
    //目前无法读取自己uin故失效
    //即使强制设定uin但无法发消息，故发消息实现已失效
    if (cfg.notificationonly) {
      let target = "";
      let ctype = 1; // 默认 1=私聊/好友

      if (Array.isArray(cfg.Send2Who) && cfg.Send2Who.length > 0) {
        // 有显式目标：1=私聊(8?2?) 兼容原逻辑
        target = cfg.Send2Who[0];
        ctype  = (cfg.Send2Who[0] === "1") ? 8 : 2; // 复用你原有的映射
      } else {
        // 无显式目标：需要 self 才能发给自己
        let self = readSelfCache();
        if (!self?.uin) self = await warmUpSelfOnce();
        if (!self?.uin) {
          pluginLog("只提醒模式：未配置 Send2Who，且自 UIN 未就绪，已跳过发送提醒");
          return;
        }
        target = self.uid || self.uin || "";
        ctype  = 1;
      }

      await within(1200, "notify", API.invokeNative('ns-ntApi','nodeIKernelMsgService/sendMsg',false,{
        msgId:"0",
        peer:{ chatType:ctype, peerUid:target, guildId:"" },
        msgElements:[{ elementType:1, elementId:"", textElement:{ content:`[Grab RedBag]发现群"${peerName}(${peerUid})"成员"${senderName}(${sendUin})"红包！`, atType:0, atUid:"", atTinyId:"", atNtUid:"" } } ],
        msgAttributeInfos:new Map()
      }));
      return;
    }

    // 随机延迟（抢包前）
    if (cfg.useRandomDelay) {
      const lb = parseInt(cfg.delayLowerBound)||0, ub = parseInt(cfg.delayUpperBound)||0;
      const d  = Math.max(0, Math.floor(Math.random()*(ub-lb+1))+lb);
      if (d) await sleep(d);
      pluginLog("延迟",d,"秒")
    }

    // 口令红包：先发口令
    //失效
    if (redChannel === 32) {
      await within(1500, "send command", API.invokeNative('ns-ntApi','nodeIKernelMsgService/sendMsg',false,{
        msgId:"0",
        peer:{ chatType, peerUid, guildId:"" },
        msgElements:[{ elementType:1, elementId:"", textElement:{ content:title, atType:0, atUid:"", atTinyId:"", atNtUid:"" } } ],
        msgAttributeInfos:new Map()
      }));
    }

    // === 抢包分支才强制确保 self ===
    let self = readSelfCache();
    if (!self?.uin) self = await warmUpSelfOnce();
    if (!self?.uin) {
      pluginLog("自 UIN 未就绪，已跳过一次抢包");
      return;
    }

    // === 发起抢包 ===
    //失效
    const req = {
      grabRedBagReq: {
        recvUin: String(self.uin),
        recvType: chatType,
        peerUid,
        name: self.nickName || "",
        pcBody,
        wishing: title || "QQ红包",
        msgSeq: String(msgSeq),
        index
      }
    };

    const grab = await within(5000, "grabRedBag",
      API.invokeNative('ns-ntApi', "nodeIKernelMsgService/grabRedBag", false, req, {timeout:6000})
    );
    if (!grab.ok) return;
    const rsp = grab.res?.grabRedBagRsp;

    // 自己通知
    //失效
    if (cfg.useSelfNotice) {
      const target = (cfg.Send2Who.length===0) ? (self.uid || self.uin || "") : cfg.Send2Who[0];
      const ctype  = (cfg.Send2Who.length===0) ? 1 : (cfg.Send2Who[0]==="1" ? 8 : 2);
      if (rsp?.recvdOrder?.amount === "0") {
        await within(1200,"selfNotice-fail", API.invokeNative('ns-ntApi','nodeIKernelMsgService/sendMsg',false,{
          msgId:"0",
          peer:{ chatType:ctype, peerUid:target, guildId:"" },
          msgElements:[{ elementType:1, elementId:"", textElement:{ content:`[Grab RedBag] 抢"${peerName}(${peerUid})"成员"${senderName}(${sendUin})"红包失败：已被领完`, atType:0, atUid:"", atTinyId:"", atNtUid:"" } } ],
          msgAttributeInfos:new Map()
        }));
      } else {
        const amount = (parseInt(rsp?.recvdOrder?.amount||"0")||0)/100;
        if (amount===0.01 && cfg.antiDetect) {
          antiDetectGroups.push(peerUid);
          setTimeout(()=>{
            antiDetectGroups = antiDetectGroups.filter(g=>g!==peerUid);
            pluginLog(`恢复监听群 ${peerName}(${peerUid})`);
          }, antiDetectTime);
        }
        const msgText = (cfg.receiveMsg||DEFAULT_CFG.receiveMsg)
          .replace("%peerName%",peerName).replace("%peerUid%",peerUid)
          .replace("%senderName%",senderName).replace("%sendUin%",sendUin||"")
          .replace("%amount%", amount.toFixed(2));
        await within(1200,"selfNotice-ok", API.invokeNative('ns-ntApi','nodeIKernelMsgService/sendMsg',false,{
          msgId:"0",
          peer:{ chatType:ctype, peerUid:target, guildId:"" },
          msgElements:[{ elementType:1, elementId:"", textElement:{ content: msgText, atType:0, atUid:"", atTinyId:"", atNtUid:"" } } ],
          msgAttributeInfos:new Map()
        }));
      }
    }

    if (rsp?.recvdOrder?.amount === "0") return;

    // 自动感谢
    //失效
    const cfgThanks = Array.isArray(cfg.thanksMsgs) && cfg.thanksMsgs.length>0;
    if (cfgThanks) {
      const selfUin = self?.uin && String(self.uin);
      if (sendUin && selfUin && sendUin !== selfUin) {
        if (cfg.useRandomDelay) {
          const lb2= parseInt(cfg.delayLowerBoundForSend)||0, ub2=parseInt(cfg.delayUpperBoundForSend)||0;
          const delaySend = Math.max(0, Math.floor(Math.random()*(ub2-lb2+1))+lb2);
          if (delaySend) await sleep(delaySend);
        }
        await within(1500,"sayThanks", API.invokeNative('ns-ntApi','nodeIKernelMsgService/sendMsg',false,{
          msgId:"0",
          peer:{ chatType, peerUid, guildId:"" },
          msgElements:[{ elementType:1, elementId:"", textElement:{ content: cfg.thanksMsgs[Math.floor(Math.random()*cfg.thanksMsgs.length)], atType:0, atUid:"", atTinyId:"", atNtUid:"" } } ],
          msgAttributeInfos:new Map()
        }));
      }
    }

    // 统计
    try { API.addTotalRedBagNum(1); } catch {}
    try { API.addTotalAmount((parseInt(rsp?.recvdOrder?.amount||"0")||0)/100); } catch {}

  } catch {}
}

// ============= 形状归一 =============
async function normalize(payload){
  if (looksLikeMsg(payload)) return payload;
  const msgs = (Array.isArray(payload?.msgList) && payload.msgList) || (Array.isArray(payload?.msgs) && payload.msgs);
  if (msgs && msgs.length){
    const withRed = msgs.find(m => Array.isArray(m.elements) && m.elements.some(e=>e && e.elementType===9 && e.walletElement));
    return withRed || msgs[0];
  }
  if (Array.isArray(payload?.changedRecentContactLists) && payload.changedRecentContactLists[0]?.changedList?.length){
    const c = payload.changedRecentContactLists[0].changedList[0];
    const shallow = { elements:null, msgSeq:c.msgSeq, peerUid:c.peerUid, chatType: c.chatType || c.sessionType, peerName:c.peerName,
                      senderUin:c.senderUin, sendRemarkName:c.sendRemarkName, sendMemberName:c.sendMemberName, sendNickName:c.sendNickName, peerUin:c.peerUin };
    try {
      const r = await within(1200,"getMsgs", API.invokeNative('ns-ntApi','nodeIKernelMsgService/getMsgs',false,{
        peer:{ chatType:shallow.chatType, peerUid:shallow.peerUid, guildId:"" },
        msgSeqRange:{ begin:String(shallow.msgSeq), end:String(shallow.msgSeq) }
      }));
      if (r.ok && Array.isArray(r.res?.msgs) && r.res.msgs[0]?.elements) shallow.elements = r.res.msgs[0].elements;
    } catch {}
    return shallow;
  }
  return null;
}
