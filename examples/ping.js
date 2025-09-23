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
  console.log(await m.Ping("115.236.100.149", 44542, 2000));
}

test();
