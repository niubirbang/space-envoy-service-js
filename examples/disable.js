const { Manager } = require("../index");
const { serviceName, serviceFile } = require("./var");

const m = new Manager(serviceName, serviceFile);
m.mockInited();

async function test() {
  await m.Init();
  await m.Disable();
}

test();
