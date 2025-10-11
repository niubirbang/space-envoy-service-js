const { Manager } = require("../index");
const { serviceName, serviceFile, mockInited } = require("./var");

const m = new Manager(serviceName, serviceFile);
if (mockInited) {
  m.mockInited();
}

async function test() {
  await m.Init();
  console.log(await m.Status());
}

test();
