const { Manager } = require("../index");
const { serviceName, serviceFile } = require("./args");

const m = new Manager(serviceName, serviceFile);

async function test() {
  await m.Init();
  await m.Stop();
}

test();
