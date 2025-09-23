const { Manager } = require("../index");
const {
  serviceName,
  serviceFile,
  dir,
  logLevel,
  mixedPort,
  controllerPort,
  dnsPort,
} = require("./var");

const m = new Manager(serviceName, serviceFile);

async function test() {
  await m.Init(dir, logLevel, mixedPort, controllerPort, dnsPort);
  await m.Up();
}

test();
