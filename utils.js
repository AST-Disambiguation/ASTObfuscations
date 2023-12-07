/**
 * randoms
 * @param {number} m
 * @param {number} n
 */
exports.randoms = (m, n) => {
  return Math.floor(Math.random() * (m - n) + n)
};

/**
 * base64Encode
 * @param {string} e
 */
exports.base64Encode = function (e) {
  var r, a, c, h, o, t,
      base64EncodeChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  for (c = e.length, a = 0, r = ''; a < c;) {
    if (h = 255 & e.charCodeAt(a++), a == c) {
      r += base64EncodeChars.charAt(h >> 2), r += base64EncodeChars.charAt(
          (3 & h) << 4), r += '==';
      break
    }
    if (o = e.charCodeAt(a++), a == c) {
      r += base64EncodeChars.charAt(h >> 2), r += base64EncodeChars.charAt(
          (3 & h) << 4 | (240 & o) >> 4), r += base64EncodeChars.charAt(
          (15 & o) << 2), r += '=';
      break
    }
    t = e.charCodeAt(a++), r += base64EncodeChars.charAt(
        h >> 2), r += base64EncodeChars.charAt(
        (3 & h) << 4 | (240 & o) >> 4), r += base64EncodeChars.charAt(
        (15 & o) << 2 | (192 & t) >> 6), r += base64EncodeChars.charAt(63 & t)
  }
  return r
};

exports.native_func = ['Object', 'Function', 'Array', 'Number', 'parseFloat',
  'parseInt', 'Infinity', 'NaN', 'undefined', 'Boolean', 'String', 'Symbol',
  'Date', 'Promise', 'RegExp', 'Error', 'AggregateError', 'EvalError',
  'RangeError', 'ReferenceError', 'SyntaxError', 'TypeError', 'URIError',
  'globalThis', 'JSON', 'Math', 'console', 'Intl', 'ArrayBuffer', 'Uint8Array',
  'Int8Array', 'Uint16Array', 'Int16Array', 'Uint32Array', 'Int32Array',
  'Float32Array', 'Float64Array', 'Uint8ClampedArray', 'BigUint64Array',
  'BigInt64Array', 'DataView', 'Map', 'BigInt', 'Set', 'WeakMap', 'WeakSet',
  'Proxy', 'Reflect', 'FinalizationRegistry', 'WeakRef', 'decodeURI',
  'decodeURIComponent', 'encodeURI', 'encodeURIComponent', 'escape', 'unescape',
  'eval', 'isFinite', 'isNaN', 'process', 'Buffer', 'atob', 'btoa', 'URL',
  'URLSearchParams', 'TextEncoder', 'TextDecoder', 'AbortController',
  'AbortSignal', 'EventTarget', 'Event', 'MessageChannel', 'MessagePort',
  'MessageEvent', 'clearInterval', 'clearTimeout', 'setInterval', 'setTimeout',
  'queueMicrotask', 'performance', 'clearImmediate', 'setImmediate',
  'SharedArrayBuffer', 'Atomics', 'WebAssembly'];

// module.exports.radix=randoms(5, 17);