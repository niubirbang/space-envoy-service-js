let serviceName = "";
let serviceFile = "";

switch (process.platform) {
  case "win32":
    serviceName = "space_envoy";
    serviceFile = "./space-envoy.exe";
    break;
  case "darwin":
    serviceName = "space_envoy";
    serviceFile = "./space-envoy";
    break;
  case "linux":
    serviceName = "space_envoy";
    serviceFile = "./space-envoy";
    break;
}

module.exports = {
  serviceName,
  serviceFile,
};
