# HOPE Android API configuration
The APK does not hard-code a production backend URL.
Set the API endpoint at build/run time with:
```bash
flutter run   --dart-define=API_BASE_URL=https://api.example.com/api/v1
flutter build apk --release --dart-define=API_BASE_URL=https://api.example.com/api/v1
```

## Local emulator development
For an Android emulator talking to a host machine, use the debug build:
```text
http://10.0.2.2:3000/api/v1
```
Debug builds permit cleartext HTTP to `10.0.2.2` and `localhost` only
(`src/debug/res/xml/network_security_config.xml`); release builds block all cleartext.
Run debug builds with:
```bash
flutter run --debug --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1
```

## Physical devices
For a physical phone, use the LAN/VPN-reachable address of the API server, or the final HTTPS domain.
Note that a physical device talking to a plain-HTTP LAN server needs the debug build as well —
release builds reject cleartext traffic.
