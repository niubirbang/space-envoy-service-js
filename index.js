const path = require("path");
const axios = require("axios");
const { execSync } = require("child_process");

const currentDir = process.cwd();

class Manager {
  constructor(serviceName, serviceFile) {
    if (!serviceName) {
      serviceName = "space_envoy";
    }
    if (!serviceFile) {
      serviceFile = "space_envoy";
    }
    if (!path.isAbsolute(serviceFile)) {
      serviceFile = path.join(currentDir, serviceFile);
    }

    this.serviceName = serviceName;
    this.serviceFile = serviceFile;
    this.inited = false;
    this.initClient();
  }

  async Init() {
    if (this.inited) return;
    if (!(await this.isRunning())) {
      await this.install();
    }
    this.inited = true;
  }
  async Uninstall() {
    await this.uninstall();
  }
  async Version() {
    await this.checkInited();
    const data = await this.client.request({
      method: "GET",
      url: "/version",
    });
    return data.data;
  }
  async Status() {
    await this.checkInited();
    const data = await this.client.request({
      method: "GET",
      url: "/status",
    });
    return data.data;
  }
  async Up(homeDir, configFile) {
    await this.checkInited();
    if (!path.isAbsolute(homeDir)) {
      homeDir = path.join(currentDir, homeDir);
    }
    if (!path.isAbsolute(configFile)) {
      configFile = path.join(currentDir, configFile);
    }
    await this.client.request({
      method: "POST",
      url: "/up",
      data: {
        homeDir,
        configFile,
      },
    });
  }
  async Down() {
    await this.checkInited();
    await this.client.request({
      method: "POST",
      url: "/down",
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
  initClient() {
    switch (process.platform) {
      case "win32":
        this.client = axios.create({
          baseURL: "http://pipe/",
          socketPath: `\\\\.\\pipe\\${this.serviceName}`,
          timeout: 30000,
        });
        break;
      case "darwin":
        this.client = axios.create({
          baseURL: "http://unix/",
          socketPath: `/tmp/${this.serviceName}.sock`,
          timeout: 30000,
        });
        break;
      case "linux":
        this.client = axios.create({
          baseURL: "http://unix/",
          socketPath: `/tmp/${this.serviceName}.sock`,
          timeout: 30000,
        });
        break;
    }
  }
  async checkInited() {
    if (!this.inited) {
      throw new Error("uninit");
    }
  }
  async isRunning() {
    switch (process.platform) {
      case "win32":
        return await this.isRunningWindows();
      case "darwin":
        return await this.isRunningDarwin();
      case "linux":
        return await this.isRunningLinux();
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
  async installAfterCheck() {
    let ok = false;
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 500));
      if (await this.isRunning()) {
        ok = true;
        break;
      }
    }
    if (!ok) {
      throw new Error("socket failed");
    }
  }
  async isRunningWindows() {
    try {
      const output = execSync(`sc query ${this.serviceName}`, {
        encoding: "utf8",
      });
      return output.toLowerCase().includes("running");
    } catch {
      return false;
    }
  }
  async installWindows() {
    console.log("installing")
    const quotedPath = `"${this.serviceFile}"`;
    const shells = [
      `${quotedPath} install`, 
      // `${quotedPath} start`,
    ];
    for (const shell of shells) {
      const script = `Start-Process "cmd.exe" -ArgumentList '/c ${shell}' -Verb RunAs -WindowStyle Hidden`;
      try {
        execSync(`powershell -Command ${script}`, { encoding: "utf8" });
      } catch (err) {
        throw new Error(
          `failed to install: ${err?.message}\n${err?.stdout || ""}`
        );
      }
    }
    await this.installAfterCheck();
  }
  async uninstallWindows() {
    console.log("uninstalling")
    const quotedPath = `"${this.serviceFile}"`;
    const shells = [
      // `${quotedPath} stop`,
      `${quotedPath} uninstall`,
    ];
    for (const shell of shells) {
      const script = `Start-Process "cmd.exe" -ArgumentList '/c ${shell}' -Verb RunAs -WindowStyle Hidden`;
      try {
        execSync(`powershell -Command ${script}`, { encoding: "utf8" });
      } catch (err) {
        throw new Error(
          `failed to install: ${err?.message}\n${err?.stdout || ""}`
        );
      }
    }
  }
  async logWindows() {
    try {
      return execSync(`powershell -Command Get-EventLog -LogName Application -Source ${this.serviceName} -Newest 1000`, {
        encoding: "utf8",
      });
    } catch {
      return false;
    }
  }
  async isRunningDarwin() {
    try {
      const output = execSync(`launchctl print system/${this.serviceName}`, {
        encoding: "utf8",
      });
      const match = output.match(/pid = (\d+)/);
      return match && match[1] !== "0";
    } catch {
      return false;
    }
  }
  async installDarwin() {
    console.log("installing")
    const quotedPath = `"${this.serviceFile}"`;
    const shells = [
      `chmod +x ${quotedPath}`,
      `${quotedPath} install`,
      `${quotedPath} start`,
    ].join("\n");
    const script = `do shell script "${shells.replace(
      /"/g,
      '\\"'
    )}" with prompt "Kernel ${
      this.serviceName
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
  async uninstallDarwin() {
    console.log("uninstalling")
    const quotedPath = `"${this.serviceFile}"`;
    const shells = [`${quotedPath} uninstall`].join("\n");
    const script = `do shell script "${shells.replace(
      /"/g,
      '\\"'
    )}" with prompt "Kernel ${
      this.serviceName
    } requires authorization to use" with administrator privileges`;
    try {
      execSync(`osascript -e '${script}'`, { encoding: "utf8" });
    } catch (err) {
      throw new Error(
        `failed to uninstall: ${err?.message}\n${err?.stdout || ""}`
      );
    }
  }
  async logDarwin() {}
  async isRunningLinux() {
    return false;
  }
  async installLinux() {}
  async uninstallLinux() {}
  async logLinux() {}
}

module.exports = { Manager };
