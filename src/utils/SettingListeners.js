import {pluginLog} from "./frontLogUtils.js";

const grAPI = window.grab_redbag

export class SettingListeners {
    constructor(doc) {
        this.document = doc
    }

    async activeButtonListener() {
        const activeButton = this.document.querySelector('#gr-active-button')
        if ((await grAPI.getConfig()).isActive) activeButton.classList.toggle('is-active')

        activeButton.addEventListener('click', async () => {
            const isActive = (await grAPI.getConfig()).isActive
            activeButton.classList.toggle('is-active')

            if (isActive) {
                grAPI.sendMsgToChatWindows('LiteLoader.grab_redbag.unSubscribeListener')
                pluginLog("取消监听红包消息")
            } else {
                grAPI.sendMsgToChatWindows('LiteLoader.grab_redbag.subscribeListener')
                pluginLog("开始监听红包消息")
            }
            await grAPI.setConfig({isActive: !isActive})
        })
    }

    async activeAllGroupsButtonListener() {
        const button = this.document.querySelector('#gr-active-all-chat-button')
        if ((await grAPI.getConfig()).isActiveAllGroups) button.classList.toggle('is-active')

        button.addEventListener('click', async () => {
            const isActiveAllGroups = (await grAPI.getConfig()).isActiveAllGroups
            button.classList.toggle('is-active')
            await grAPI.setConfig({isActiveAllGroups: !isActiveAllGroups})
        })
    }

    async antiDetectBtnListener(){
        const btn=this.document.querySelector('#gr-anti-detect-button')
        if ((await grAPI.getConfig()).antiDetect) btn.classList.toggle('is-active')

        btn.addEventListener('click', async () => {
            const isAntiDetect = (await grAPI.getConfig()).antiDetect
            btn.classList.toggle('is-active')
            await grAPI.setConfig({antiDetect: !isAntiDetect})
        })
    }

    async antiMyselfButtonListener() {
        const button = this.document.querySelector('#gr-anti-myself-button')
        if (!button) return
        const config = await grAPI.getConfig()
        if (config.antiMyself) button.classList.toggle('is-active')

        button.addEventListener('click', async () => {
            const antiMyself = (await grAPI.getConfig()).antiMyself
            button.classList.toggle('is-active')
            await grAPI.setConfig({antiMyself: !antiMyself})
        })
    }

    async notifyOnBlockedBtnListener(){
        const btn=this.document.querySelector('#gr-notify-on-blocked-button')
        if ((await grAPI.getConfig()).notifyOnBlocked) btn.classList.toggle('is-active')

        btn.addEventListener('click', async () => {
            const notifyOnBlocked = (await grAPI.getConfig()).notifyOnBlocked
            btn.classList.toggle('is-active')
            await grAPI.setConfig({notifyOnBlocked: !notifyOnBlocked})
        })
    }

    async NotificationOnlyButtonListener() {
        const button = this.document.querySelector('#gr-notification-only-button')
        if ((await grAPI.getConfig()).notificationonly) button.classList.toggle('is-active')

        button.addEventListener('click', async () => {
            const notificationonly = (await grAPI.getConfig()).notificationonly
            button.classList.toggle('is-active')
            await grAPI.setConfig({notificationonly: !notificationonly})
        })
    }

    async randomDelayButtonListener() {
        const delayButton = this.document.querySelector('#gr-random-delay-button')
        if ((await grAPI.getConfig()).useRandomDelay) delayButton.classList.toggle('is-active')

        delayButton.addEventListener('click', async () => {
            const useRandomDelay = (await grAPI.getConfig()).useRandomDelay
            delayButton.classList.toggle('is-active')
            await grAPI.setConfig({useRandomDelay: !useRandomDelay})
        })
    }

    async randomDelaySendButtonListener() {
        const sendDelayButton = this.document.querySelector('#gr-random-delay-send-button')
        if (!sendDelayButton) return;
        const config = await grAPI.getConfig();
        if (config.useRandomDelayForSend) sendDelayButton.classList.toggle('is-active')

        sendDelayButton.addEventListener('click', async () => {
            const useRandomDelayForSend = (await grAPI.getConfig()).useRandomDelayForSend
            sendDelayButton.classList.toggle('is-active')
            await grAPI.setConfig({useRandomDelayForSend: !useRandomDelayForSend})
        })
    }

    async lowerBoundInputListener() {
        const input = this.document.querySelector('#gr-lower-bound-input')
        input.value = (await grAPI.getConfig()).delayLowerBound
        input.addEventListener('change', async event => {
            await grAPI.setConfig({delayLowerBound: event.target.value})
        })
    }

    async upperBoundInputListener() {
        const input = this.document.querySelector('#gr-upper-bound-input')
        input.value = (await grAPI.getConfig()).delayUpperBound
        input.addEventListener('change', async event => {
            await grAPI.setConfig({delayUpperBound: event.target.value})
        })
    }

    async lowerBoundSendInputListener() {
        const input = this.document.querySelector('#gr-lower-bound-send-input')
        const config = await grAPI.getConfig();
        input.value = config.delayLowerBoundForSend
        input.addEventListener('change', async event => {
            await grAPI.setConfig({delayLowerBoundForSend: event.target.value})
        })
    }

    async upperBoundSendInputListener() {
        const input = this.document.querySelector('#gr-upper-bound-send-input')
        const config = await grAPI.getConfig();
        input.value = config.delayUpperBoundForSend
        input.addEventListener('change', async event => {
            await grAPI.setConfig({delayUpperBoundForSend: event.target.value})
        })
    }

    async feedbackMsgButtonListener() {
        const button = this.document.querySelector('#gr-feedback-msg-button')
        if ((await grAPI.getConfig()).useSelfNotice) button.classList.toggle('is-active')

        button.addEventListener('click', async () => {
            const useSelfNotice = (await grAPI.getConfig()).useSelfNotice
            button.classList.toggle('is-active')
            await grAPI.setConfig({useSelfNotice: !useSelfNotice})
        })
    }

    async thanksMsgsInputListener() {
        const input = this.document.querySelector('#gr-thanks-msg-input')
        input.value = (await grAPI.getConfig()).thanksMsgs.join(",")
        input.addEventListener('change', async event => {
            await grAPI.setConfig({thanksMsgs: event.target.value.split(',').filter(item => item.trim() !== "")})
        })
    }

    async avoidWordsInputListener() {
        const input = this.document.querySelector('#gr-avoid-words-input')
        input.value = (await grAPI.getConfig()).avoidKeyWords.join(",")
        input.addEventListener('change', async event => {
            await grAPI.setConfig({avoidKeyWords: event.target.value.split(',').filter(item => item.trim() !== "")})
        })
    }

    async avoidGroupsInputListener() {
        const input = this.document.querySelector('#gr-avoid-groups-input')
        input.value = (await grAPI.getConfig()).avoidGroups.join(",")
        input.addEventListener('change', async event => {
            await grAPI.setConfig({avoidGroups: event.target.value.split(',').filter(item => item.trim() !== "")})
        })
    }

    async keyWordsInputListener() {
        const input = this.document.querySelector('#gr-key-words-input')
        input.value = (await grAPI.getConfig()).listenKeyWords.join(",")
        input.addEventListener('change', async event => {
            await grAPI.setConfig({listenKeyWords: event.target.value.split(',').filter(item => item.trim() !== "")})
        })
    }

    async QQNumberInputListener() {
        const typeSelector = this.document.querySelector('#gr-send2who-type-selector')
        const input = this.document.querySelector('#gr-Send2Who-input')
        const config = await grAPI.getConfig()

        typeSelector.value = config.Send2WhoType || "0"

        const updateInputState = (type) => {
            if (type === "0" || type === "1") {
                input.style.display = "none"
            } else {
                input.style.display = ""
                input.placeholder = type === "2" ? "输入QQ号" : "输入群号"
            }
        }
        updateInputState(typeSelector.value)
        input.value = config.Send2Who.join(",")

        typeSelector.addEventListener('change', async event => {
            const type = event.target.value
            updateInputState(type)
            await grAPI.setConfig({Send2WhoType: type})
            if (type === "0" || type === "1") {
                input.value = ""
                await grAPI.setConfig({Send2Who: []})
            }
        })

        input.addEventListener('change', async event => {
            await grAPI.setConfig({Send2Who: event.target.value.split(',').filter(item => item.trim() !== "")})
        })
    }

    async keyGroupsInputListener() {
        const input = this.document.querySelector('#gr-key-groups-input')
        input.value = (await grAPI.getConfig()).listenGroups.join(",")
        input.addEventListener('change', async event => {
            await grAPI.setConfig({listenGroups: event.target.value.split(',').filter(item => item.trim() !== "")})
        })
    }

    async keyQQsInputListener() {
        const input = this.document.querySelector('#gr-key-QQs-input')
        input.value = (await grAPI.getConfig()).listenQQs.join(",")
        input.addEventListener('change', async event => {
            await grAPI.setConfig({listenQQs: event.target.value.split(',').filter(item => item.trim() !== "")})
        })
    }

    async avoidQQsInputListener() {
        const input = this.document.querySelector('#gr-avoid-QQs-input')
        input.value = (await grAPI.getConfig()).avoidQQs.join(",")
        input.addEventListener('change', async event => {
            await grAPI.setConfig({avoidQQs: event.target.value.split(',').filter(item => item.trim() !== "")})
        })
    }

    async blockTypeListener() {
        let blockType = undefined
        const typeSelEl = this.document.querySelector('#gr-block-type-selector')
        typeSelEl.value = (await grAPI.getConfig()).blockType

        typeSelEl.addEventListener('change', async event => {
            blockType = event.target.value
            await grAPI.setConfig({blockType: blockType})
            console.log('[GR]名单设置为' + blockType)
        })
    }

    async showHistoryInfo() {
        const textNum = this.document.querySelector("#info-redbag-num")
        const textAmount = this.document.querySelector("#info-money-amount")
        const config = await grAPI.getConfig()
        textNum.innerText = config.totalRedBagNum
        textAmount.innerText = config.totalAmount.toFixed(2)
    }

    async StopGrabByTimeButtonListener() {
        const button = this.document.querySelector('#stop-grab-by-time-button')
        if ((await grAPI.getConfig()).stopGrabByTime) button.classList.toggle('is-active')

        button.addEventListener('click', async () => {
            const stopGrabByTime = (await grAPI.getConfig()).stopGrabByTime
            button.classList.toggle('is-active')
            await grAPI.setConfig({stopGrabByTime: !stopGrabByTime})
        })
    }

    async startTimeInputListener() {
        const startTimeInput = this.document.querySelector('#startTime')
        const Config = await grAPI.getConfig()
        startTimeInput.value = Config.stopGrabStartTime

        startTimeInput.addEventListener('change', event => {
            grAPI.setConfig({stopGrabStartTime: event.target.value})
        })
    }

    async endTimeInputListener() {
        const endTimeInput = this.document.querySelector('#endTime')
        const Config = await grAPI.getConfig()
        endTimeInput.value = Config.stopGrabEndTime

        endTimeInput.addEventListener('change', event => {
            grAPI.setConfig({stopGrabEndTime: event.target.value})
        })
    }

    async receiveMsgListener(){
        const input=this.document.querySelector("#gr-receive-msg-input")
        const Config = await grAPI.getConfig()
        input.value = Config.receiveMsg

        input.addEventListener('change',event=>{
            grAPI.setConfig({receiveMsg: event.target.value})
        })
    }

    async onLoad() {
        this.activeButtonListener()
        this.randomDelayButtonListener()
        this.lowerBoundInputListener()
        this.upperBoundInputListener()
        this.feedbackMsgButtonListener()
        this.thanksMsgsInputListener()
        this.avoidWordsInputListener()
        this.avoidGroupsInputListener()
        this.avoidQQsInputListener()
        this.activeAllGroupsButtonListener()
        this.blockTypeListener()
        this.keyGroupsInputListener()
        this.keyWordsInputListener()
        this.keyQQsInputListener()
        this.QQNumberInputListener()
        this.lowerBoundSendInputListener()
        this.upperBoundSendInputListener()
        this.NotificationOnlyButtonListener()
        this.showHistoryInfo()
        this.StopGrabByTimeButtonListener()
        this.startTimeInputListener()
        this.endTimeInputListener()
        this.receiveMsgListener()
        this.antiDetectBtnListener()
        this.notifyOnBlockedBtnListener()
        this.randomDelaySendButtonListener()
        this.antiMyselfButtonListener()
    }
}