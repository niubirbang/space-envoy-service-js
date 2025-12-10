import os from "os";
import path from "path";
import fs from "fs";
import axios, { AxiosInstance } from "axios";
import AdmZip from "adm-zip";
import { execSync } from "child_process";

export enum Status {
  Enable = "enable",
  Disable = "disable",
}

export enum Use {
  Fixed = "fixed",
  Auto = "auto",
}

export enum Mode {
  Global = "global",
  Abroad = "abroad",
  Returning = "returning",
}

export enum LogLevel {
  Debug = "debug",
  Info = "info",
  Warning = "warning",
  Error = "error",
}

export interface State {
  serverInstallerExists: boolean;
  serverFileExists: boolean;
  serverIsRunning: boolean;
}

export interface Option {
  dir: string;
  logLevel: string;
  mixedPort: number;
  controllerPort: number;
  dnsPort: number;
}

export interface URIInfo {
  name: string;
  type: string;
  server: string;
  port: number;
}

export interface Param {
  mode: Mode;
  use: Use;
  directRules: string[];
  proxyRules: string[];
  rejectRules: string[];
  proxies: string[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class Manager {
  platform: string = process.platform;
  serverInstaller: string;
  serverInstallerExists: boolean;
  serverFileName: string = (() => {
    switch (process.platform) {
      case "win32":
        return "service.exe";
      case "darwin":
        return "service";
      case "linux":
        return "service";
      default:
        return "";
    }
  })();
  serverFile: string;
  serverFileExists: boolean;
  serverIsRunning: boolean = false;
  stateListeners: ((state: State) => void)[] = [];
  client!: AxiosInstance;

  private initClient(): void {
    switch (this.platform) {
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
      default:
        throw new Error(`${this.platform} unsupport client`);
    }
  }

  private async getServerIsRunningByServerWindows(): Promise<boolean> {
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
  private async getServerIsRunningByServerDarwin(): Promise<boolean> {
    try {
      const output = execSync(`launchctl print system/${this.serverName}`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"],
      });
      const match = output.match(/pid = (\d+)/);
      return !!match && match[1] !== "0";
    } catch {
      return false;
    }
  }
  private async getServerIsRunningByServerLinux(): Promise<boolean> {
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

  private async notifyState(): Promise<void> {
    this.stateListeners.forEach((cb) => {
      cb({
        serverInstallerExists: this.serverInstallerExists,
        serverFileExists: this.serverFileExists,
        serverIsRunning: this.serverIsRunning,
      });
    });
  }
  private async refreshState(): Promise<void> {
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
  private async intervalRefreshState(): Promise<void> {
    while (true) {
      await this.refreshState();
      await sleep(200);
    }
  }

  private async getServerIsRunningByClient(): Promise<boolean> {
    try {
      await this.client.get("");
      return true;
    } catch (err) {
      return false;
    }
  }
  private async listenServerIsRunningByClient(): Promise<void> {
    while (true) {
      this.serverIsRunning = await this.getServerIsRunningByClient();
      await sleep(1000);
    }
  }

  private async install(): Promise<void> {
    switch (this.platform) {
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
  private async installAfterCheck(): Promise<void> {
    let ok = false;
    for (let i = 0; i < 60; i++) {
      await sleep(500);
      const isRunningByServer = await this.GetServerIsRunningByServer();
      const isRunningByClient = await this.getServerIsRunningByClient();
      if (isRunningByServer && isRunningByClient) {
        ok = true;
        break;
      }
    }
    if (!ok) {
      throw new Error("server not run");
    } else {
      await this.refreshState();
    }
  }
  private async installWindows(): Promise<void> {
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
    } catch (err: any) {
      throw new Error(
        `failed to install: ${err?.message}\n${err?.stdout || ""}`
      );
    }
    await this.installAfterCheck();
  }
  private async installDarwin(): Promise<void> {
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
    } catch (err: any) {
      throw new Error(
        `failed to install: ${err?.message}\n${err?.stdout || ""}`
      );
    }
    await this.installAfterCheck();
  }
  private async installLinux(): Promise<void> {
    console.log("[space-envoy] installing");

    const quotedPath = `"${this.serverFile}"`;
    const shells = [`chmod +x ${quotedPath}`, `${quotedPath} install`];
    for (const shell of shells) {
      try {
        execSync(`pkexec ${shell}`, { stdio: "inherit", encoding: "utf8" });
      } catch (err: any) {
        throw new Error(
          `failed to install: ${err?.message}\n${err?.stdout || ""}`
        );
      }
    }
    await this.installAfterCheck();
  }

  private async uninstall(): Promise<void> {
    switch (this.platform) {
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
  private async uninstallWindows(): Promise<void> {
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
    } catch (err: any) {
      throw new Error(
        `failed to uninstall: ${err?.message}\n${err?.stdout || ""}`
      );
    }
  }
  private async uninstallDarwin(): Promise<void> {
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
    } catch (err: any) {
      throw new Error(
        `failed to uninstall: ${err?.message}\n${err?.stdout || ""}`
      );
    }
  }
  private async uninstallLinux(): Promise<void> {
    console.log("[space-envoy] uninstalling");

    const quotedPath = `"${this.serverFile}"`;
    const shells = [`${quotedPath} uninstall`];
    for (const shell of shells) {
      try {
        execSync(`pkexec ${shell}`, { stdio: "inherit", encoding: "utf8" });
      } catch (err: any) {
        throw new Error(
          `failed to uninstall: ${err?.message}\n${err?.stdout || ""}`
        );
      }
    }
  }

  private async logWindows(): Promise<string> {
    return execSync(
      `powershell -Command Get-EventLog -LogName Application -Source ${this.serverName} -Newest 1000`,
      { encoding: "utf8" }
    );
  }
  private async logDarwin(): Promise<string> {
    return fs
      .readFileSync(`/var/log/${this.serverName}.out.log`)
      .toString("utf-8");
  }
  private async logLinux(): Promise<string> {
    return execSync(`journalctl -u ${this.serverName} -n 1000`, {
      encoding: "utf8",
    });
  }

  private async check(): Promise<void> {
    if (!this.serverIsRunning) {
      throw new Error("server not run");
    }
  }

  constructor(public serverName: string, public serverDir: string) {
    this.serverInstaller = path.join(serverDir, "service.zip");
    this.serverFile = path.join(serverDir, this.serverFileName);

    this.serverInstallerExists = fs.existsSync(this.serverInstaller);
    this.serverFileExists = fs.existsSync(this.serverFile);

    this.initClient();
    this.intervalRefreshState();
    this.listenServerIsRunningByClient();
  }

  public async GetServerIsRunningByServer() {
    try {
      switch (this.platform) {
        case "win32":
          return await this.getServerIsRunningByServerWindows();
        case "darwin":
          return await this.getServerIsRunningByServerDarwin();
        case "linux":
          return await this.getServerIsRunningByServerLinux();
        default:
          throw new Error(`${this.platform} not support`);
      }
    } catch (err) {
      console.warn(
        "[space-envoy] get server is running by server failed:",
        err
      );
    }
    return false;
  }
  public GetServerInstallerExists(): boolean {
    return this.serverInstallerExists;
  }
  public GetServerFileExists(): boolean {
    return this.serverFileExists;
  }
  public GetServerIsRunning(): boolean {
    return this.serverIsRunning;
  }

  public async Download(
    fn: (serverInstaller: string) => Promise<void>
  ): Promise<void> {
    await fn?.(this.serverInstaller);
  }
  public async Unzip(): Promise<void> {
    if (!this.serverFileExists && !this.serverInstallerExists) {
      throw new Error("server not found");
    }
    if (!this.serverFileExists) {
      const installer = new AdmZip(this.serverInstaller);
      installer.extractAllTo(this.serverDir, true);
    }
  }
  public async Install(): Promise<void> {
    await this.install();
  }
  public async Uninstall(): Promise<void> {
    await this.uninstall();
  }
  public ListenState(cb: (state: State) => void): void {
    this.stateListeners.push(cb);
  }
  public async Version(): Promise<string> {
    await this.check();
    const data = await this.client.request({
      method: "GET",
      url: "/version",
    });
    return data.data;
  }
  public async Option(): Promise<Option> {
    await this.check();
    const data = await this.client.request({
      method: "GET",
      url: "/option",
    });
    return data.data;
  }
  public async SetOption(opt: Option): Promise<void> {
    await this.check();
    await this.client.request({
      method: "POST",
      url: "/option",
      data: opt,
    });
  }
  public async ParseURI(uri: string): Promise<URIInfo> {
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
  public async Ping(
    target: string,
    port: number,
    timeout: number = 2000
  ): Promise<number> {
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
  public async Status(): Promise<State> {
    await this.check();
    const data = await this.client.request({
      method: "GET",
      url: "/status",
    });
    return data.data;
  }
  public async Enable(param: Param): Promise<void> {
    await this.check();
    await this.client.request({
      method: "POST",
      url: "/enable",
      data: param,
    });
  }
  public async Disable(): Promise<void> {
    await this.check();
    await this.client.request({
      method: "POST",
      url: "/disable",
    });
  }
  public async Log(): Promise<string> {
    switch (this.platform) {
      case "win32":
        return await this.logWindows();
      case "darwin":
        return await this.logDarwin();
      case "linux":
        return await this.logLinux();
      default:
        throw new Error(`${this.platform} not support`);
    }
  }
}
