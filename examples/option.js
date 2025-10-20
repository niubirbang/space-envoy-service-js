const { Manager, LogLevelInfo } = require("../index");
const { serviceName, serviceFile, mockServerIsRunning } = require("./var");

const m = new Manager(serviceName, serviceFile);
if (mockServerIsRunning) {
  m.mockServerIsRunning();
}

async function test() {
  await m.Init();
  console.log(await m.Option());
  // console.log(
  //   await m.SetOption({
  //     logLevel: LogLevelInfo,
  //   })
  // );
}

test();
