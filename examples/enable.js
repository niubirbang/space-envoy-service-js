const { Manager, ModeGlobal, ModeAbroad, ModeReturning, UseFixed, UseAuto } = require("../index");
const { serviceName, serviceFile, mockInited } = require("./var");

const m = new Manager(serviceName, serviceFile);
if (mockInited) {
  m.mockInited();
}

// const mode = ModeGlobal;
const mode = ModeAbroad;
// const mode = ModeReturning;

const use = UseFixed;
// const use = UseAuto;

async function test() {
  await m.Init();
  await m.Enable({
    mode: mode,
    use: use,
    proxies: [
      "trojan://85d40875-8136-4e4a-9f23-a855f3618e29@115.236.100.149:38354?user-agent=Mozilla%2F5.0%20(Windows%20NT%2010.0%3B%20Win64%3B%20x64)%20AppleWebKit%2F537.36%20(KHTML%2C%20like%20Gecko)%20Chrome%2F92.0.4515.131%20Safari%2F537.36&allowInsecure=1&peer=cm.g.doubleclick.net#香港-12",
      "trojan://85d40875-8136-4e4a-9f23-a855f3618e29@115.236.100.149:33330?user-agent=Mozilla%2F5.0%20(Windows%20NT%2010.0%3B%20Win64%3B%20x64)%20AppleWebKit%2F537.36%20(KHTML%2C%20like%20Gecko)%20Chrome%2F92.0.4515.131%20Safari%2F537.36&allowInsecure=1&peer=cm.g.doubleclick.net#台湾-8",
      "trojan://85d40875-8136-4e4a-9f23-a855f3618e29@115.236.100.149:35713?user-agent=Mozilla%2F5.0%20(Windows%20NT%2010.0%3B%20Win64%3B%20x64)%20AppleWebKit%2F537.36%20(KHTML%2C%20like%20Gecko)%20Chrome%2F92.0.4515.131%20Safari%2F537.36&allowInsecure=1&peer=cm.g.doubleclick.net#日本-17",
    ],
  });
}

test();
