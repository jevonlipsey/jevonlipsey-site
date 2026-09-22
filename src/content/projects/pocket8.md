---
title: "pocket8"
tech: ["webassembly", "capacitor", "vue.js", "ios"]
desc: "Native iOS runtime and companion app for the PICO-8 fantasy console. Available on the App Store."
links:
  github: "https://github.com/jevonlipsey/pico-ios"
  appstore: "https://apps.apple.com/us/app/pocket8/id6758171942"
featured: true
---

Custom mobile runtime bridging the official PICO-8 web engine for native iOS. Intercepts the Emscripten `Module.preRun` lifecycle to bypass default demo cartridges and inject user memory directly into the WASM heap. Pairs wrapper with a suite of QoL features.
