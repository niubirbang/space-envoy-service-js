const { Manager } = require("../index");
const { serviceName, serviceFile } = require("./var");

const m = new Manager(serviceName, serviceFile);
m.mockInited();

async function test() {
  await m.Init();
  console.log(await m.Ping("115.236.100.149", 44542, 2000));
}

test();
