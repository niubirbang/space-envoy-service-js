const { Manager } = require("../index");
const { serviceName, serviceFile, mockInited } = require("./var");

const m = new Manager(serviceName, serviceFile);
if (mockInited) {
  m.mockInited();
}

async function test() {
  await m.Init();
  console.log(await m.Ping("115.236.100.149", 44542, 2000));
}

test();
