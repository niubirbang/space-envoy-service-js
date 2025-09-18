const { Manager } = require("../index");
const { serviceName, serviceFile, homeDir, configFile } = require("./args");

const m = new Manager(serviceName, serviceFile);

async function test() {
  await m.Init();
  await m.Start(homeDir, configFile);
}

test();
