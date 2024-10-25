const fs = require('fs');
const {pluginLog} = require("./utils/logUtils")

class Config {
    static config = {
        isActive: true,//是否开启抢红包功能
        useRandomDelay: false,//是否启用随机延迟
        delayLowerBound: 0,
        delayUpperBound: 500,
        avoidKeyWords: [],//屏蔽词
        isSendNotice: false,//抢到红包后是否给自己发送消息
    }

    static initConfig(pluginPath, configPath) {
        this.config.pluginPath = pluginPath
        this.config.configPath = configPath
        pluginLog('现在执行initConfig方法')
        if (!(fs.existsSync(this.config.configPath))) {//如果文件目录不存在，就创建文件
            pluginLog('第一次启动，准备创建配置文件')
            pluginLog('插件路径为' + this.config.pluginPath)
            fs.writeFileSync(this.config.configPath, JSON.stringify(this.config, null, 4), 'utf-8')
            pluginLog('配置文件创建成功')
        }
        Object.assign(this.config, JSON.parse(fs.readFileSync(this.config.configPath, 'utf-8')))
        pluginLog('当前的配置文件为')
        console.log(this.config)
        pluginLog('配置初始化完毕')
    }

    static async getConfig() {
        try {
            return this.config
        } catch (e) {
            pluginLog('读取配置文件失败')
        }
    }

    static async setConfig(newConfig) {
        try {
            // 使用 Object.assign() 更新 config 对象的属性
            Object.assign(this.config, newConfig);
            // 写入配置文件
            fs.writeFile(this.config.configPath, JSON.stringify(this.config, null, 4), 'utf-8', (err) => {
                if (err) {
                    pluginLog('修改配置文件失败')
                }
            })
            pluginLog('修改配置文件成功')
            return this.config
        } catch (e) {
            console.log(e)
        }
    }
}

module.exports = {Config}