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
    try {
      await this.checkService();
    } catch (_) {
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
  async Start(homeDir, configFile) {
    await this.checkInited();
    if (!path.isAbsolute(homeDir)) {
      homeDir = path.join(currentDir, homeDir);
    }
    if (!path.isAbsolute(configFile)) {
      configFile = path.join(currentDir, configFile);
    }
    await this.client.request({
      method: "POST",
      url: "/start",
      data: {
        homeDir,
        configFile,
      },
    });
  }
  async Stop() {
    await this.checkInited();
    await this.client.request({
      method: "POST",
      url: "/stop",
    });
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
  async checkService() {
    await this.client.request({
      method: "GET",
      url: "/version",
    });
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
  async installWindows() {}
  async uninstallWindows() {}
  async installDarwin() {
    const quotedPath = `"${this.serviceFile}"`;
    const shell = [
      `chmod +x ${quotedPath}`,
      `${quotedPath} install`,
      `${quotedPath} start`,
    ].join("\n");
    const script = `do shell script "${shell.replace(
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
    let ok = false;
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 500));
      try {
        await this.checkService();
        ok = true;
        break;
      } catch (_) {}
    }
    if (!ok) {
      throw new Error("socket failed");
    }
  }
  async uninstallDarwin() {
    const quotedPath = `"${this.serviceFile}"`;
    const shell = [`${quotedPath} uninstall`].join("\n");
    const script = `do shell script "${shell.replace(
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
  async installLinux() {}
  async uninstallLinux() {}
}

module.exports = { Manager };
