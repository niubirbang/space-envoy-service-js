let serviceName = "";
let serviceFile = "";
let dir = "";
let logLevel = "info";
let mixedPort = 0;
let controllerPort = 0;
let dnsPort = 0;

switch (process.platform) {
  case "win32":
    serviceName = "space_envoy";
    serviceFile = "./space-envoy.exe";
    dir = "D:\\Desktop\\mihomo";
    break;
  case "darwin":
    serviceName = "space_envoy";
    serviceFile = "./space-envoy";
    dir = "/Users/mac/go/src/github.com/MetaCubeX/mihomo/tmp";
    break;
  case "linux":
    serviceName = "space_envoy";
    serviceFile = "./space-envoy";
    dir = "/Users/mac/go/src/github.com/MetaCubeX/mihomo/tmp";
    break;
}

module.exports = {
  serviceName,
  serviceFile,
  dir,
  logLevel,
  mixedPort,
  controllerPort,
  dnsPort,
};
