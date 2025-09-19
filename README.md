# space-envoy-service

```
npm install @niubir/space-envoy-service
```

```javascript
const { Manager } = require("@niubir/space-envoy-service")
const m = new Manager(serviceName, serviceFile);
await m.Init();
await m.Up(
  "[config_dir]",
  "[config_file]",
);
await m.Down();
await m.Uninstall();
```
