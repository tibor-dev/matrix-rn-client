# matrix-rn-client

React Native (0.68.4) based Matrix client

## Steps to setup the React Native Project

-   Create RN project using version 0.68.4

```
npx react-native@0.68.4 init MatrixRNClient --version 0.68.4
```

```
npm install fbemitter unorm bluebird axios
```

-   Add packages to encrypt/decrypt attachements

````
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


-   Add Matrix JavaScript SDK
```
npm install matrix-js-sdk
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

````
