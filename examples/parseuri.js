const { Manager } = require("../index");
const { serviceName, serviceFile } = require("./var");

const m = new Manager(serviceName, serviceFile);
m.mockInited();

async function test() {
  await m.Init();
  console.log(
    await m.ParseURI(
      "trojan://xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx@115.236.100.149:38354?user-agent=Mozilla%2F5.0%20(Windows%20NT%2010.0%3B%20Win64%3B%20x64)%20AppleWebKit%2F537.36%20(KHTML%2C%20like%20Gecko)%20Chrome%2F92.0.4515.131%20Safari%2F537.36&allowInsecure=1&peer=cm.g.doubleclick.net#-香港-12"
    )
  );
}

test();
