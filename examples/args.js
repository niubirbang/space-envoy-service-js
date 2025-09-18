let serviceName = ""
let serviceFile = ""
let homeDir = ""
let configFile = ""

switch (process.platform) {
  case "win32":
    serviceName = "space_envoy"
    serviceFile = "./space-envoy.exe"
    homeDir     = "D:\\Desktop\\mihomo"
    configFile  = "D:\\Desktop\\mihomo\\config_feimiao.yaml"
    break
  case "darwin":
    serviceName = "space_envoy"
    serviceFile = "./space-envoy"
    homeDir = "/Users/mac/go/src/github.com/MetaCubeX/mihomo/tmp"
    configFile = "/Users/mac/go/src/github.com/MetaCubeX/mihomo/tmp/config_feimiao.yaml"
    break
  case "linux":
    serviceName = "space_envoy"
    serviceFile = "./space-envoy"
    homeDir = "/Users/mac/go/src/github.com/MetaCubeX/mihomo/tmp"
    configFile = "/Users/mac/go/src/github.com/MetaCubeX/mihomo/tmp/config_feimiao.yaml"
    break
}

module.exports = { serviceName, serviceFile, homeDir, configFile };
