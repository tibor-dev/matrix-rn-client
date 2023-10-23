# matrix-rn-client

React Native (0.68.4) based Matrix client

## Steps to setup the React Native Project

-   Create RN project using version 0.68.4

```
npx react-native@0.68.4 init MatrixRNClient --version 0.68.4
```

```
npm install fbemitter unorm bluebird axios events
```

-   Add packages to encrypt/decrypt attachements

```
npm install @craftzdog/react-native-buffer
npm install react-native-quick-base64
```

-   Cannot use the latest version because of RN Version 0.68.4 !

```
npm install react-native-quick-crypto@0.4.6
```

-   Add async-storage package to be able to save Crypto keys

```
npm install @react-native-async-storage/async-storage
```

```
npm install stream-browserify
```

-   Add Babel 'module-resorcer' plugin to use our Quick Crypto, Buffer and Stream modules

```
npm install --save-dev babel-plugin-module-resolver
```

-   Set JSC flavor to org.webkit:android-jsc-intl:+ in android\app\build.gradle

-   Add Olm and random number generator

```
npm install "https://gitlab.matrix.org/matrix-org/olm/-/package_files/2572/download"
npm install react-native-get-random-values
```

-   Change node_modules\@matrix-org\olm\package.json to use olm-legacy

```
"version": "3.2.15",
  "description": "An implementation of the Double Ratchet cryptographic ratchet",
  "main": "olm_legacy.js",
  "files": [
    "olm.js",
    "olm.wasm",
    "olm_legacy.js",
    "index.d.ts",
    "README.md",
    "checksums.txt",
    "checksums.txt.asc"
  ],
```

-   Add url, path, util, rn-nodeify, js modules

```
npm install react-native-url-polyfill
npm install path util

npm i --save-dev rn-nodeify

./node_modules/.bin/rn-nodeify --install "fs path" --hack

```

-   Add url polyfill to top of index.js

```
import 'react-native-url-polyfill/auto';
```

-   Add Matrix JavaScript SDK

```
npm install matrix-js-sdk@28.2.0
```

# Build errors and solutions

-   Could not find react-native-0.71.0-rc.0-debug.aar
    Add following section under allprojects repositories in android\build.gradle

```
exclusiveContent {
    filter {
        includeGroup "com.facebook.react"
    }
    forRepository {
        maven {
            url "$rootDir/../node_modules/react-native/android"
        }
    }
}
```

```

```
