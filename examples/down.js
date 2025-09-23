const { Manager } = require("../index");
const { serviceName, serviceFile } = require("./var");

const m = new Manager(serviceName, serviceFile);

async function test() {
  await m.Init();
  await m.Down();
}

test();
