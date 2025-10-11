const { Manager } = require("../index");
const { serviceName, serviceFile, mockInited } = require("./var");

const m = new Manager(serviceName, serviceFile);

async function test() {
  await m.Init();
}

test();
