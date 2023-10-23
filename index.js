/**
 * @format
 */
import 'react-native-get-random-values';

import 'react-native-url-polyfill/auto';

import Olm from '@matrix-org/olm'; // using legacy if default wasm doesn't load
window.Olm = Olm;

// import {decode, encode} from 'base-64';
// if (!global.btoa) {
//     global.btoa = encode;
// }
// if (!global.atob) {
//     global.atob = decode;
// }

// if (typeof BigInt === 'undefined') global.BigInt = require('big-integer');
// window.Buffer = window.Buffer || require('buffer').Buffer;
// polyfillGlobal('Buffer', () => require('buffer').Buffer);
// polyfillGlobal('SharedArrayBuffer', () => SharedArrayBuffer.prototype);
// polyfillGlobal('URL', () => require('whatwg-url').URL);
// SharedArrayBuffer = ArrayBuffer;

global.fetch = fetch;

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);
