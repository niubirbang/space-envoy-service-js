const os = require("os");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const AdmZip = require("adm-zip");
const { execSync } = require("child_process");

const currentDir = process.cwd();

const ModeGlobal = "global";
const ModeAbroad = "abroad";
const ModeReturning = "returning";

const UseFixed = "fixed";
const UseAuto = "auto";

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

class Service {
  constructor({ serverName = "space_envoy", serverDir }) {
    if (!path.isAbsolute(serverDir)) {
      serverDir = path.join(currentDir, serverDir);
    }
    this.ServerDir = serverDir;
    console.log("[space-envoy] server dir:", serverDir);

    this.ServerName = serverName;

    this.ServerInstaller = path.join(serverDir, "service.zip");
    this.ServerInstallerExists = fs.existsSync(this.ServerInstaller);

    this.ServerFile = path.join(serverDir, serverFileName);
    this.ServerFileExists = fs.existsSync(this.ServerFile);

    this.ServerIsRunning = false;
    this.StateListeners = [];

    this.initClient();
    this.intervalRefreshState();
    this.listenServerIsRunningByClient();
  }

  async Download(downloadFunc) {
    if (!downloadFunc || typeof downloadFunc !== "function") {
      throw new Error("download function is empty");
    }
    await downloadFunc(this.ServerInstaller);
  }
  async Install() {
    await this.installServer();
  }
  async Uninstall() {
    await this.uninstallServer();
  }
  async ListenState(callback) {
    if (!callback || typeof callback !== "function") return;
    this.StateListeners.push(callback);
  }
  async Version() {
    await this.check();
    const data = await this.client.request({
      method: "GET",
      url: "/version",
    });
    return data.data;
  }
  async Option() {
    await this.check();
    const data = await this.client.request({
      method: "GET",
      url: "/option",
    });
    return data.data;
  }
  async SetOption(opt) {
    await this.check();
    await this.client.request({
      method: "POST",
      url: "/option",
      data: opt,
    });
  }
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
  async Ping(target, port, timeout) {
    if (!timeout) {
      timeout = 2000;
    }
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
  async Status() {
    await this.check();
    const data = await this.client.request({
      method: "GET",
      url: "/status",
    });
    return data.data;
  }
  async Enable(param) {
    await this.check();
    await this.client.request({
      method: "POST",
      url: "/enable",
      data: param,
    });
  }
  async Disable() {
    await this.check();
    await this.client.request({
      method: "POST",
      url: "/disable",
    });
  }
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

  async notifyState() {
    for (let cb of this.StateListeners) {
      await cb?.({
        serverInstallerExists: this.ServerInstallerExists,
        serverFileExists: this.ServerFileExists,
        serverIsRunning: this.ServerIsRunning,
      });
    }
  }
  async refreshState() {
    const serverInstallerExists = fs.existsSync(this.ServerInstaller);
    const serverFileExists = fs.existsSync(this.ServerFile);
    const serverIsRunning = await this.getServerIsRunningByServer();
    let notify = false;
    if (this.ServerInstallerExists !== serverInstallerExists) {
      this.ServerInstallerExists = serverInstallerExists;
      notify = true;
    }
    if (this.ServerFileExists !== serverFileExists) {
      this.ServerFileExists = serverFileExists;
      notify = true;
    }
    if (this.ServerIsRunning !== serverIsRunning) {
      this.ServerIsRunning = serverIsRunning;
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
  initClient() {
    switch (process.platform) {
      case "win32":
        this.client = axios.create({
          baseURL: "http://pipe/",
          socketPath: `\\\\.\\pipe\\${this.ServerName}`,
          timeout: 30000,
        });
        break;
      case "darwin":
        this.client = axios.create({
          baseURL: "http://unix/",
          socketPath: `/tmp/${this.ServerName}.sock`,
          timeout: 30000,
        });
        break;
      case "linux":
        this.client = axios.create({
          baseURL: "http://unix/",
          socketPath: `/tmp/${this.ServerName}.sock`,
          timeout: 30000,
        });
        break;
    }
  }
  async check() {
    if (!this.ServerIsRunning) {
      throw new Error("server_not_run");
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
  async getServerIsRunningByServer() {
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
  async listenServerIsRunningByClient() {
    while (true) {
      this.ServerIsRunning = await this.getServerIsRunningByClient();
      await sleep(1000);
    }
  }
  async beforeInstallServer() {
    if (!this.ServerFileExists && !this.ServerInstallerExists) {
      throw new Error("server_not_found");
    }
    if (!this.ServerFileExists) {
      const installer = new AdmZip(this.ServerInstaller);
      installer.extractAllTo(this.ServerDir, true);
    }
  }
  async installServer() {
    await this.beforeInstallServer();
    switch (process.platform) {
      case "win32":
        await this.installServerWindows();
        break;
      case "darwin":
        await this.installServerDarwin();
        break;
      case "linux":
        await this.installServerLinux();
        break;
    }
  }
  async uninstallServer() {
    switch (process.platform) {
      case "win32":
        await this.uninstallServerWindows();
        break;
      case "darwin":
        await this.uninstallServerDarwin();
        break;
      case "linux":
        await this.uninstallServerLinux();
        break;
    }
  }
  async installServerAfterCheck() {
    let ok = false;
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const isRunningByServer = await this.getServerIsRunningByServer();
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
  async getServerIsRunningByServerWindows() {
    try {
      const output = execSync(`sc query ${this.ServerName}`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"],
      });
      return output.toLowerCase().includes("running");
    } catch {
      return false;
    }
  }
  async installServerWindows() {
    console.log("[space-envoy] installing");

    const ps1 = path.join(os.tmpdir(), "space_service_install.ps1");
    fs.writeFileSync(
      ps1,
      `Start-Process -FilePath "${this.ServerFile}" -ArgumentList "install" -Verb RunAs -Wait -WindowStyle Hidden`
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

    // const quotedPath = `"${this.ServerFile}"`;
    // const shells = [
    //   `${quotedPath} install`,
    //   // `${quotedPath} start`,
    // ];
    // for (const shell of shells) {
    //   const script = `Start-Process "cmd.exe" -ArgumentList '/c ${shell}' -Verb RunAs -WindowStyle Hidden`;
    //   try {
    //     execSync(`powershell -Command ${script}`, { encoding: "utf8" });
    //   } catch (err) {
    //     throw new Error(
    //       `failed to install: ${err?.message}\n${err?.stdout || ""}`
    //     );
    //   }
    // }

    await this.installServerAfterCheck();
  }
  async uninstallServerWindows() {
    console.log("[space-envoy] uninstalling");

    const ps1 = path.join(os.tmpdir(), "space_service_uninstall.ps1");
    fs.writeFileSync(
      ps1,
      `Start-Process -FilePath "${this.ServerFile}" -ArgumentList "uninstall" -Verb RunAs -Wait -WindowStyle Hidden`
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

    // const ps1Shells = [
    //   {filePath: installPs1}
    // ]
    // const quotedPath = `"${this.ServerFile}"`;
    // const shells = [
    //   // `${quotedPath} stop`,
    //   `${quotedPath} uninstall`,
    // ];
    // for (const shell of shells) {
    //   const script = `Start-Process "cmd.exe" -ArgumentList '/c ${shell}' -Verb RunAs -WindowStyle Hidden`;
    //   try {
    //     execSync(`powershell -Command ${script}`, { encoding: "utf8" });
    //   } catch (err) {
    //     throw new Error(
    //       `failed to install: ${err?.message}\n${err?.stdout || ""}`
    //     );
    //   }
    // }
  }
  async logWindows() {
    return execSync(
      `powershell -Command Get-EventLog -LogName Application -Source ${this.ServerName} -Newest 1000`,
      { encoding: "utf8" }
    );
  }
  async getServerIsRunningByServerDarwin() {
    try {
      const output = execSync(`launchctl print system/${this.ServerName}`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"],
      });
      const match = output.match(/pid = (\d+)/);
      return match && match[1] !== "0";
    } catch {
      return false;
    }
  }
  async installServerDarwin() {
    console.log("[space-envoy] installing");
    const quotedPath = `"${this.ServerFile}"`;
    const shells = [
      `chmod +x ${quotedPath}`,
      `${quotedPath} install`,
      // `${quotedPath} start`,
    ].join("\n");
    const script = `do shell script "${shells.replace(
      /"/g,
      '\\"'
    )}" with prompt "Kernel ${
      this.ServerName
    } requires authorization to use" with administrator privileges`;
    try {
      execSync(`osascript -e '${script}'`, { encoding: "utf8" });
    } catch (err) {
      throw new Error(
        `failed to install: ${err?.message}\n${err?.stdout || ""}`
      );
    }
    await this.installServerAfterCheck();
  }
  async uninstallServerDarwin() {
    console.log("[space-envoy] uninstalling");
    const quotedPath = `"${this.ServerFile}"`;
    const shells = [`${quotedPath} uninstall`].join("\n");
    const script = `do shell script "${shells.replace(
      /"/g,
      '\\"'
    )}" with prompt "Kernel ${
      this.ServerName
    } requires authorization to use" with administrator privileges`;
    try {
      execSync(`osascript -e '${script}'`, { encoding: "utf8" });
    } catch (err) {
      throw new Error(
        `failed to uninstall: ${err?.message}\n${err?.stdout || ""}`
      );
    }
  }
  async logDarwin() {
    return fs
      .readFileSync(`/var/log/${this.ServerName}.out.log`)
      .toString("utf-8");
  }
  async getServerIsRunningByServerLinux() {
    try {
      const output = execSync(`systemctl is-active ${this.ServerName}`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"],
      }).trim();
      return output === "active";
    } catch {
      return false;
    }
  }
  async installServerLinux() {
    console.log("[space-envoy] installing");
    const quotedPath = `"${this.ServerFile}"`;
    const shells = [
      `chmod +x ${quotedPath}`,
      `${quotedPath} install`,
      `${quotedPath} start`,
    ];
    for (const shell of shells) {
      try {
        execSync(`pkexec ${shell}`, { stdio: "inherit", encoding: "utf8" });
      } catch (err) {
        throw new Error(
          `failed to install: ${err?.message}\n${err?.stdout || ""}`
        );
      }
    }
    await this.installServerAfterCheck();
  }
  async uninstallServerLinux() {
    console.log("[space-envoy] uninstalling");
    const quotedPath = `"${this.ServerFile}"`;
    const shells = [`${quotedPath} uninstall`].join("\n");
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
  async logLinux() {
    return execSync(`journalctl -u ${this.ServerName} -n 1000`, {
      encoding: "utf8",
    });
  }

  mockServerIsRunning() {
    this.ServerIsRunning = true;
  }
}

module.exports = {
  Service,
  ModeGlobal,
  ModeAbroad,
  ModeReturning,
  UseFixed,
  UseAuto,
  LogLevelDebug,
  LogLevelInfo,
  LogLevelWarning,
  LogLevelError,
};
