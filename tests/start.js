const { Manager } = require("../index");
const { serviceName, serviceFile } = require("./args");

const m = new Manager(serviceName, serviceFile);

async function test() {
  await m.Init();
  await m.Start(
    "/Users/mac/go/src/github.com/MetaCubeX/mihomo/tmp",
    "/Users/mac/go/src/github.com/MetaCubeX/mihomo/tmp/config_feimiao.yaml"
  );
}

test();
