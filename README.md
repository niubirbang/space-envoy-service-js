# space-envoy-service-js

```javascript
const m = new Manager(serviceName, serviceFile);
await m.Init();
await m.Start(
  "[config_dir]",
  "[config_file]",
);
await m.Stop();
await m.Uninstall();
```
