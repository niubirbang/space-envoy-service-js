const os = require("os");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const AdmZip = require("adm-zip");
const { execSync } = require("child_process");

/**
 * 状态
 * `"enable"`: 开启
 * `"disable"`: 关闭
 * @typedef {"enable" | "disable"} Status
 */

/**
 * 使用类型
 * `"fixed"`: 固定
 * `"auto"`: 自动
 * @typedef {"fixed" | "auto"} Use
 */

/**
 * 模式
 * `"global"`: 全局
 * `"abroad"`: 出国
 * `"returning"`: 回国
 * @typedef {"global" | "abroad" | "returning"} Mode
 */

/** @type {Status} */
const StatusEnable = "enable";
/** @type {Status} */
const StatusDisable = "disable";

/** @type {Use} */
const UseFixed = "fixed";
/** @type {Use} */
const UseAuto = "auto";

/** @type {Mode} */
const ModeGlobal = "global";
/** @type {Mode} */
const ModeAbroad = "abroad";
/** @type {Mode} */
const ModeReturning = "returning";

const LogLevelDebug = "debug";
const LogLevelInfo = "info";
const LogLevelWarning = "warning";
const LogLevelError = "error";

const serverFileName = {
  win32: "service.exe",
  darwin: "service",
  linux: "service",
}[process.platform];

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

class Manager {
  /**
   * @typedef {Object} ManagerOptions
   * @property {string} [serverName="space_envoy"] 服务名称，默认值为 "space_envoy"
   * @property {string} serverDir 服务所在的目录路径（必填）
   */
  /**
   * @typedef {Object} State
   * @property {boolean} serverInstallerExists 安装器是否存在
   * @property {boolean} serverFileExists 执行文件是否存在
   * @property {boolean} serverIsRunning 服务是否运行
   */
  /**
   * @callback StateListener
   * @param {State} data 当前服务状态
   */
  /**
   * @callback DownloadFunc
   * @param {string} serverInstaller 安装器目录
   */
  /**
   * @typedef {Object} Option
   * @property {string} dir 内核运行目录
   * @property {string} logLevel 内核日志等级
   * @property {number} mixedPort mixed端口
   * @property {number} controllerPort ctrl端口
   * @property {number} dnsPort dns端口
   */
  /**
   * @typedef {Object} SetOptionParam
   * @property {string} logLevel 内核日志等级
   */
  /**
   * @typedef {Object} URIInfo
   * @property {string} name
   * @property {string} type
   * @property {string} server
   * @property {number} port
   */
  /**
   * @typedef {Object} EnableParam
   * @property {Mode} mode 模式
   * @property {Use} use 使用类型
   * @property {string[]} directRules 直接规则集合
   * @property {string[]} proxyRules 代理规则集合
   * @property {string[]} rejectRules 拒绝规则集合
   * @property {string[]} proxies 节点
   */

  /**
   * @param {ManagerOptions} options 初始化参数
   */
  constructor(options) {
    this.serverName = options.serverName;
    this.serverDir = options.serverDir;
    this.serverInstaller = path.join(options.serverDir, "service.zip");
    this.serverFile = path.join(options.serverDir, serverFileName);

    this.serverInstallerExists = fs.existsSync(this.serverInstaller);
    this.serverFileExists = fs.existsSync(this.serverFile);

    this.serverIsRunning = false;
    this.stateListeners = [];

    this.initClient();
    this.intervalRefreshState();
    this.listenServerIsRunningByClient();
  }

  /**
   * 获取服务是否运行
   * @return {Promise<bool>}
   * 服务是否运行
   */
  async GetServerIsRunningByServer() {
    try {
      switch (process.platform) {
        case "win32":
          return await this.getServerIsRunningByServerWindows();
        case "darwin":
          return await this.getServerIsRunningByServerDarwin();
        case "linux":
          return await this.getServerIsRunningByServerLinux();
        default:
          throw new Error(`${process.platform} not support`);
      }
    } catch (err) {
      console.warn(
        "[space-envoy] get server is running by server failed:",
        err
      );
    }
    return false;
  }
  /**
   * 获取安装器是否存在
   * @return {bool}
   * 安装器是否存在
   */
  GetServerInstallerExists() {
    return this.serverInstallerExists;
  }
  /**
   * 获取执行文件是否存在
   * @return {bool}
   * 执行文件是否存在
   */
  GetServerFileExists() {
    return this.serverFileExists;
  }
  /**
   * 获取服务是否运行
   * @return {bool}
   * 服务是否运行
   */
  GetServerIsRunning() {
    return this.serverIsRunning;
  }
  /**
   * 解压安装器
   */
  Unzip() {
    if (!this.serverFileExists && !this.serverInstallerExists) {
      throw new Error("server_not_found");
    }
    if (!this.serverFileExists) {
      const installer = new AdmZip(this.serverInstaller);
      installer.extractAllTo(this.serverDir, true);
    }
  }
  /**
   * 下载服务
   * @param {DownloadFunc} fn 下载函数
   */
  async Download(fn) {
    if (!fn || typeof fn !== "function") {
      throw new Error("download function is empty");
    }
    await fn(this.serverInstaller);
  }
  /**
   * 安装服务
   */
  async Install() {
    await this.install();
  }
  /**
   * 卸载服务
   */
  async Uninstall() {
    await this.uninstall();
  }
  /**
   * 注册服务状态监听
   * @param {StateListener} cb 监听函数
   */
  async ListenState(cb) {
    if (!cb || typeof cb !== "function") return;
    this.stateListeners.push(cb);
  }
  /**
   * 获取内核版本
   * @return {Promise<string>}
   * 版本号
   */
  async Version() {
    await this.check();
    const data = await this.client.request({
      method: "GET",
      url: "/version",
    });
    return data.data;
  }
  /**
   * 获取内核配置
   * @return {Promise<Option>}
   * 配置
   */
  async Option() {
    await this.check();
    const data = await this.client.request({
      method: "GET",
      url: "/option",
    });
    return data.data;
  }
  /**
   * 设置内核配置
   * @param {SetOptionParam} opt 配置
   */
  async SetOption(opt) {
    await this.check();
    await this.client.request({
      method: "POST",
      url: "/option",
      data: opt,
    });
  }
  /**
   * 解析URI
   * @param {string} uri uri
   * @return {Promise<URIInfo>}
   * URI信息
   */
  async ParseURI(uri) {
    await this.check();
    const data = await this.client.request({
      method: "POST",
      url: "/parseuri",
      data: {
        uri,
      },
    });
    return data.data;
  }
  /**
   * 测延迟
   * @param {string} target 目标地址
   * @param {number} port 目标端口
   * @param {number} [timeout=2000] 超时(ms)
   * @return {Promise<number>}
   * 延迟(ms)
   */
  async Ping(target, port, timeout = 2000) {
    await this.check();
    const data = await this.client.request({
      method: "POST",
      url: "/ping",
      data: {
        target: target,
        port: port,
        timeout: timeout,
      },
    });
    return data.data;
  }
  /**
   * 获取状态
   * @return {Promise<Status>}
   * 状态
   */
  async Status() {
    await this.check();
    const data = await this.client.request({
      method: "GET",
      url: "/status",
    });
    return data.data;
  }
  /**
   * 启用
   * @param {EnableParam} param 参数
   */
  async Enable(param) {
    await this.check();
    await this.client.request({
      method: "POST",
      url: "/enable",
      data: param,
    });
  }
  /**
   * 停用
   */
  async Disable() {
    await this.check();
    await this.client.request({
      method: "POST",
      url: "/disable",
    });
  }
  /**
   * 日志
   * @return {Promise<string>}
   * 日志信息
   */
  async Log() {
    switch (process.platform) {
      case "win32":
        return await this.logWindows();
      case "darwin":
        return await this.logDarwin();
      case "linux":
        return await this.logLinux();
    }
  }

  async getServerIsRunningByServerWindows() {
    try {
      const output = execSync(`sc query ${this.serverName}`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"],
      });
      return output.toLowerCase().includes("running");
    } catch {
      return false;
    }
  }
  async getServerIsRunningByServerDarwin() {
    try {
      const output = execSync(`launchctl print system/${this.serverName}`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"],
      });
      const match = output.match(/pid = (\d+)/);
      return match && match[1] !== "0";
    } catch {
      return false;
    }
  }
  async getServerIsRunningByServerLinux() {
    try {
      const output = execSync(`systemctl is-active ${this.serverName}`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"],
      }).trim();
      return output === "active";
    } catch {
      return false;
    }
  }
  initClient() {
    switch (process.platform) {
      case "win32":
        this.client = axios.create({
          baseURL: "http://pipe/",
          socketPath: `\\\\.\\pipe\\${this.serverName}`,
          timeout: 30000,
        });
        break;
      case "darwin":
        this.client = axios.create({
          baseURL: "http://unix/",
          socketPath: `/tmp/${this.serverName}.sock`,
          timeout: 30000,
        });
        break;
      case "linux":
        this.client = axios.create({
          baseURL: "http://unix/",
          socketPath: `/tmp/${this.serverName}.sock`,
          timeout: 30000,
        });
        break;
    }
  }
  async notifyState() {
    for (let cb of this.stateListeners) {
      await cb?.({
        serverInstallerExists: this.serverInstallerExists,
        serverFileExists: this.serverFileExists,
        serverIsRunning: this.serverIsRunning,
      });
    }
  }
  async refreshState() {
    const serverInstallerExists = fs.existsSync(this.serverInstaller);
    const serverFileExists = fs.existsSync(this.serverFile);
    const serverIsRunning = await this.GetServerIsRunningByServer();
    let notify = false;
    if (this.serverInstallerExists !== serverInstallerExists) {
      this.serverInstallerExists = serverInstallerExists;
      notify = true;
    }
    if (this.serverFileExists !== serverFileExists) {
      this.serverFileExists = serverFileExists;
      notify = true;
    }
    if (this.serverIsRunning !== serverIsRunning) {
      this.serverIsRunning = serverIsRunning;
      notify = true;
    }
    if (notify) {
      await this.notifyState();
    }
  }
  async intervalRefreshState() {
    while (true) {
      await this.refreshState();
      await sleep(200);
    }
  }
  async getServerIsRunningByClient() {
    if (!this.client) {
      return false;
    }
    try {
      await this.client.request({
        method: "GET",
        url: "",
      });
      return true;
    } catch (err) {
      return false;
    }
  }
  async listenServerIsRunningByClient() {
    while (true) {
      this.serverIsRunning = await this.getServerIsRunningByClient();
      await sleep(1000);
    }
  }
  async check() {
    if (!this.serverIsRunning) {
      throw new Error("server_not_run");
    }
  }
  async install() {
    switch (process.platform) {
      case "win32":
        await this.installWindows();
        break;
      case "darwin":
        await this.installDarwin();
        break;
      case "linux":
        await this.installLinux();
        break;
    }
  }
  async installAfterCheck() {
    let ok = false;
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const isRunningByServer = await this.GetServerIsRunningByServer();
      const isRunningByClient = await this.getServerIsRunningByClient();
      if (isRunningByServer && isRunningByClient) {
        ok = true;
        break;
      }
    }
    if (!ok) {
      throw new Error("server_not_run");
    } else {
      await this.refreshState();
    }
  }
  async installWindows() {
    console.log("[space-envoy] installing");

    const ps1 = path.join(os.tmpdir(), "space_service_install.ps1");
    fs.writeFileSync(
      ps1,
      `Start-Process -FilePath "${this.serverFile}" -ArgumentList "install" -Verb RunAs -Wait -WindowStyle Hidden`
    );
    try {
      execSync(`powershell -ExecutionPolicy Bypass -File "${ps1}"`, {
        encoding: "utf8",
      });
    } catch (err) {
      throw new Error(
        `failed to install: ${err?.message}\n${err?.stdout || ""}`
      );
    }
    await this.installAfterCheck();
  }
  async installDarwin() {
    console.log("[space-envoy] installing");

    const quotedPath = `"${this.serverFile}"`;
    const shell = [`chmod +x ${quotedPath}`, `${quotedPath} install`].join(
      "\n"
    );
    const script = `do shell script "${shell.replace(
      /"/g,
      '\\"'
    )}" with prompt "Kernel ${
      this.serverName
    } requires authorization to use" with administrator privileges`;
    try {
      execSync(`osascript -e '${script}'`, { encoding: "utf8" });
    } catch (err) {
      throw new Error(
        `failed to install: ${err?.message}\n${err?.stdout || ""}`
      );
    }
    await this.installAfterCheck();
  }
  async installLinux() {
    console.log("[space-envoy] installing");

    const quotedPath = `"${this.serverFile}"`;
    const shells = [`chmod +x ${quotedPath}`, `${quotedPath} install`];
    for (const shell of shells) {
      try {
        execSync(`pkexec ${shell}`, { stdio: "inherit", encoding: "utf8" });
      } catch (err) {
        throw new Error(
          `failed to install: ${err?.message}\n${err?.stdout || ""}`
        );
      }
    }
    await this.installAfterCheck();
  }
  async uninstall() {
    switch (process.platform) {
      case "win32":
        await this.uninstallWindows();
        break;
      case "darwin":
        await this.uninstallDarwin();
        break;
      case "linux":
        await this.uninstallLinux();
        break;
    }
  }
  async uninstallWindows() {
    console.log("[space-envoy] uninstalling");

    const ps1 = path.join(os.tmpdir(), "space_service_uninstall.ps1");
    fs.writeFileSync(
      ps1,
      `Start-Process -FilePath "${this.serverFile}" -ArgumentList "uninstall" -Verb RunAs -Wait -WindowStyle Hidden`
    );
    try {
      execSync(`powershell -ExecutionPolicy Bypass -File "${ps1}"`, {
        encoding: "utf8",
      });
    } catch (err) {
      throw new Error(
        `failed to uninstall: ${err?.message}\n${err?.stdout || ""}`
      );
    }
  }
  async uninstallDarwin() {
    console.log("[space-envoy] uninstalling");

    const quotedPath = `"${this.serverFile}"`;
    const shell = [`${quotedPath} uninstall`].join("\n");
    const script = `do shell script "${shell.replace(
      /"/g,
      '\\"'
    )}" with prompt "Kernel ${
      this.serverName
    } requires authorization to uninstall" with administrator privileges`;
    try {
      execSync(`osascript -e '${script}'`, { encoding: "utf8" });
    } catch (err) {
      throw new Error(
        `failed to uninstall: ${err?.message}\n${err?.stdout || ""}`
      );
    }
  }
  async uninstallLinux() {
    console.log("[space-envoy] uninstalling");

    const quotedPath = `"${this.serverFile}"`;
    const shells = [`${quotedPath} uninstall`];
    for (const shell of shells) {
      try {
        execSync(`pkexec ${shell}`, { stdio: "inherit", encoding: "utf8" });
      } catch (err) {
        throw new Error(
          `failed to uninstall: ${err?.message}\n${err?.stdout || ""}`
        );
      }
    }
  }
  async logWindows() {
    return execSync(
      `powershell -Command Get-EventLog -LogName Application -Source ${this.serverName} -Newest 1000`,
      { encoding: "utf8" }
    );
  }
  async logDarwin() {
    return fs
      .readFileSync(`/var/log/${this.serverName}.out.log`)
      .toString("utf-8");
  }
  async logLinux() {
    return execSync(`journalctl -u ${this.serverName} -n 1000`, {
      encoding: "utf8",
    });
  }
}

module.exports = {
  StatusEnable,
  StatusDisable,
  UseFixed,
  UseAuto,
  ModeGlobal,
  ModeAbroad,
  ModeReturning,
  LogLevelDebug,
  LogLevelInfo,
  LogLevelWarning,
  LogLevelError,
  Manager,
};
