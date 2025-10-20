const { Manager } = require("../index");
const { serviceName, serviceFile, mockServerIsRunning } = require("./var");

const m = new Manager(serviceName, serviceFile);

async function test() {
  await m.Init();
}

test();
