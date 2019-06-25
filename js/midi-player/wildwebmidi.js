var MidiModule = function(MidiModule) {
  MidiModule = MidiModule || {};

  var Module = typeof MidiModule !== "undefined" ? MidiModule : {};
  if (!Module.expectedDataFileDownloads) {
    Module.expectedDataFileDownloads = 0;
    Module.finishedDataFileDownloads = 0
  }
  Module.expectedDataFileDownloads++;
  ((function() {
    var loadPackage = (function(metadata) {
      var PACKAGE_PATH;
      if (typeof window === "object") {
        PACKAGE_PATH = window["encodeURIComponent"](window.location.pathname.toString().substring(0, window.location.pathname.toString().lastIndexOf("/")) + "/")
      } else if (typeof location !== "undefined") {
        PACKAGE_PATH = encodeURIComponent(location.pathname.toString().substring(0, location.pathname.toString().lastIndexOf("/")) + "/")
      } else {
        throw "using preloaded data can only be done on a web page or in a web worker"
      }
      var PACKAGE_NAME = "/js/wildwebmidi.data";
      var REMOTE_PACKAGE_BASE = "/js/wildwebmidi.data";
      if (typeof Module["locateFilePackage"] === "function" && !Module["locateFile"]) {
        Module["locateFile"] = Module["locateFilePackage"];
        Module.printErr("warning: you defined Module.locateFilePackage, that has been renamed to Module.locateFile (using your locateFilePackage for now)")
      }
      var REMOTE_PACKAGE_NAME = typeof Module["locateFile"] === "function" ? Module["locateFile"](REMOTE_PACKAGE_BASE) : (Module["filePackagePrefixURL"] || "") + REMOTE_PACKAGE_BASE;
      var REMOTE_PACKAGE_SIZE = metadata.remote_package_size;
      var PACKAGE_UUID = metadata.package_uuid;

      function fetchRemotePackage(packageName, packageSize, callback, errback) {
        var xhr = new XMLHttpRequest;
        xhr.open("GET", packageName, true);
        xhr.responseType = "arraybuffer";
        xhr.onprogress = (function(event) {
          var url = packageName;
          var size = packageSize;
          if (event.total) size = event.total;
          if (event.loaded) {
            if (!xhr.addedTotal) {
              xhr.addedTotal = true;
              if (!Module.dataFileDownloads) Module.dataFileDownloads = {};
              Module.dataFileDownloads[url] = {
                loaded: event.loaded,
                total: size
              }
            } else {
              Module.dataFileDownloads[url].loaded = event.loaded
            }
            var total = 0;
            var loaded = 0;
            var num = 0;
            for (var download in Module.dataFileDownloads) {
              var data = Module.dataFileDownloads[download];
              total += data.total;
              loaded += data.loaded;
              num++
            }
            total = Math.ceil(total * Module.expectedDataFileDownloads / num);
            if (Module["setStatus"]) Module["setStatus"]("Downloading data... (" + loaded + "/" + total + ")")
          } else if (!Module.dataFileDownloads) {
            if (Module["setStatus"]) Module["setStatus"]("Downloading data...")
          }
        });
        xhr.onerror = (function(event) {
          throw new Error("NetworkError for: " + packageName)
        });
        xhr.onload = (function(event) {
          if (xhr.status == 200 || xhr.status == 304 || xhr.status == 206 || xhr.status == 0 && xhr.response) {
            var packageData = xhr.response;
            callback(packageData)
          } else {
            throw new Error(xhr.statusText + " : " + xhr.responseURL)
          }
        });
        xhr.send(null)
      }

      function handleError(error) {
        console.error("package error:", error)
      }
      var fetchedCallback = null;
      var fetched = Module["getPreloadedPackage"] ? Module["getPreloadedPackage"](REMOTE_PACKAGE_NAME, REMOTE_PACKAGE_SIZE) : null;
      if (!fetched) fetchRemotePackage(REMOTE_PACKAGE_NAME, REMOTE_PACKAGE_SIZE, (function(data) {
        if (fetchedCallback) {
          fetchedCallback(data);
          fetchedCallback = null
        } else {
          fetched = data
        }
      }), handleError);

      function runWithFS() {
        function assert(check, msg) {
          if (!check) throw msg + (new Error).stack
        }
        Module["FS_createPath"]("/", "freepats", true, true);
        Module["FS_createPath"]("/freepats", "Tone_000", true, true);

        function DataRequest(start, end, crunched, audio) {
          this.start = start;
          this.end = end;
          this.crunched = crunched;
          this.audio = audio
        }
        DataRequest.prototype = {
          requests: {},
          open: (function(mode, name) {
            this.name = name;
            this.requests[name] = this;
            Module["addRunDependency"]("fp " + this.name)
          }),
          send: (function() {}),
          onload: (function() {
            var byteArray = this.byteArray.subarray(this.start, this.end);
            this.finish(byteArray)
          }),
          finish: (function(byteArray) {
            var that = this;
            Module["FS_createDataFile"](this.name, null, byteArray, true, true, true);
            Module["removeRunDependency"]("fp " + that.name);
            this.requests[this.name] = null
          })
        };
        var files = metadata.files;
        for (var i = 0; i < files.length; ++i) {
          (new DataRequest(files[i].start, files[i].end, files[i].crunched, files[i].audio)).open("GET", files[i].filename)
        }

        function processPackageData(arrayBuffer) {
          Module.finishedDataFileDownloads++;
          assert(arrayBuffer, "Loading data file failed.");
          assert(arrayBuffer instanceof ArrayBuffer, "bad input to processPackageData");
          var byteArray = new Uint8Array(arrayBuffer);
          if (Module["SPLIT_MEMORY"]) Module.printErr("warning: you should run the file packager with --no-heap-copy when SPLIT_MEMORY is used, otherwise copying into the heap may fail due to the splitting");
          var ptr = Module["getMemory"](byteArray.length);
          Module["HEAPU8"].set(byteArray, ptr);
          DataRequest.prototype.byteArray = Module["HEAPU8"].subarray(ptr, ptr + byteArray.length);
          var files = metadata.files;
          for (var i = 0; i < files.length; ++i) {
            DataRequest.prototype.requests[files[i].filename].onload()
          }
          Module["removeRunDependency"]("datafile_wildwebmidi.data")
        }
        Module["addRunDependency"]("datafile_wildwebmidi.data");
        if (!Module.preloadResults) Module.preloadResults = {};
        Module.preloadResults[PACKAGE_NAME] = {
          fromCache: false
        };
        if (fetched) {
          processPackageData(fetched);
          fetched = null
        } else {
          fetchedCallback = processPackageData
        }
      }
      if (Module["calledRun"]) {
        runWithFS()
      } else {
        if (!Module["preRun"]) Module["preRun"] = [];
        Module["preRun"].push(runWithFS)
      }
    });
    loadPackage({
      "files": [{
        "audio": 0,
        "start": 0,
        "crunched": 0,
        "end": 7645,
        "filename": "/freepats/freepats.cfg"
      }, {
        "audio": 0,
        "start": 7645,
        "crunched": 0,
        "end": 13793,
        "filename": "/freepats/.DS_Store"
      }, {
        "audio": 0,
        "start": 13793,
        "crunched": 0,
        "end": 14102,
        "filename": "/freepats/Tone_000/000_Acoustic_Grand_Piano.txt"
      }, {
        "audio": 0,
        "start": 14102,
        "crunched": 0,
        "end": 1350465,
        "filename": "/freepats/Tone_000/000_Acoustic_Grand_Piano.pat"
      }],
      "remote_package_size": 1350465,
      "package_uuid": "c2b727da-f83a-4cf6-a1c6-a92ff88f42c1"
    })
  }))();
  var moduleOverrides = {};
  var key;
  for (key in Module) {
    if (Module.hasOwnProperty(key)) {
      moduleOverrides[key] = Module[key]
    }
  }
  Module["arguments"] = [];
  Module["thisProgram"] = "./this.program";
  Module["quit"] = (function(status, toThrow) {
    throw toThrow
  });
  Module["preRun"] = [];
  Module["postRun"] = [];
  var ENVIRONMENT_IS_WEB = false;
  var ENVIRONMENT_IS_WORKER = false;
  var ENVIRONMENT_IS_NODE = false;
  var ENVIRONMENT_IS_SHELL = false;
  if (Module["ENVIRONMENT"]) {
    if (Module["ENVIRONMENT"] === "WEB") {
      ENVIRONMENT_IS_WEB = true
    } else if (Module["ENVIRONMENT"] === "WORKER") {
      ENVIRONMENT_IS_WORKER = true
    } else if (Module["ENVIRONMENT"] === "NODE") {
      ENVIRONMENT_IS_NODE = true
    } else if (Module["ENVIRONMENT"] === "SHELL") {
      ENVIRONMENT_IS_SHELL = true
    } else {
      throw new Error("Module['ENVIRONMENT'] value is not valid. must be one of: WEB|WORKER|NODE|SHELL.")
    }
  } else {
    ENVIRONMENT_IS_WEB = typeof window === "object";
    ENVIRONMENT_IS_WORKER = typeof importScripts === "function";
    ENVIRONMENT_IS_NODE = typeof process === "object" && typeof require === "function" && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;
    ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER
  }
  if (ENVIRONMENT_IS_NODE) {
    var nodeFS;
    var nodePath;
    Module["read"] = function shell_read(filename, binary) {
      var ret;
      ret = tryParseAsDataURI(filename);
      if (!ret) {
        if (!nodeFS) nodeFS = require("fs");
        if (!nodePath) nodePath = require("path");
        filename = nodePath["normalize"](filename);
        ret = nodeFS["readFileSync"](filename)
      }
      return binary ? ret : ret.toString()
    };
    Module["readBinary"] = function readBinary(filename) {
      var ret = Module["read"](filename, true);
      if (!ret.buffer) {
        ret = new Uint8Array(ret)
      }
      assert(ret.buffer);
      return ret
    };
    if (process["argv"].length > 1) {
      Module["thisProgram"] = process["argv"][1].replace(/\\/g, "/")
    }
    Module["arguments"] = process["argv"].slice(2);
    process["on"]("uncaughtException", (function(ex) {
      if (!(ex instanceof ExitStatus)) {
        throw ex
      }
    }));
    process["on"]("unhandledRejection", (function(reason, p) {
      process["exit"](1)
    }));
    Module["inspect"] = (function() {
      return "[Emscripten Module object]"
    })
  } else if (ENVIRONMENT_IS_SHELL) {
    if (typeof read != "undefined") {
      Module["read"] = function shell_read(f) {
        var data = tryParseAsDataURI(f);
        if (data) {
          return intArrayToString(data)
        }
        return read(f)
      }
    }
    Module["readBinary"] = function readBinary(f) {
      var data;
      data = tryParseAsDataURI(f);
      if (data) {
        return data
      }
      if (typeof readbuffer === "function") {
        return new Uint8Array(readbuffer(f))
      }
      data = read(f, "binary");
      assert(typeof data === "object");
      return data
    };
    if (typeof scriptArgs != "undefined") {
      Module["arguments"] = scriptArgs
    } else if (typeof arguments != "undefined") {
      Module["arguments"] = arguments
    }
    if (typeof quit === "function") {
      Module["quit"] = (function(status, toThrow) {
        quit(status)
      })
    }
  } else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
    Module["read"] = function shell_read(url) {
      try {
        var xhr = new XMLHttpRequest;
        xhr.open("GET", url, false);
        xhr.send(null);
        return xhr.responseText
      } catch (err) {
        var data = tryParseAsDataURI(url);
        if (data) {
          return intArrayToString(data)
        }
        throw err
      }
    };
    if (ENVIRONMENT_IS_WORKER) {
      Module["readBinary"] = function readBinary(url) {
        try {
          var xhr = new XMLHttpRequest;
          xhr.open("GET", url, false);
          xhr.responseType = "arraybuffer";
          xhr.send(null);
          return new Uint8Array(xhr.response)
        } catch (err) {
          var data = tryParseAsDataURI(url);
          if (data) {
            return data
          }
          throw err
        }
      }
    }
    Module["readAsync"] = function readAsync(url, onload, onerror) {
      var xhr = new XMLHttpRequest;
      xhr.open("GET", url, true);
      xhr.responseType = "arraybuffer";
      xhr.onload = function xhr_onload() {
        if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
          onload(xhr.response);
          return
        }
        var data = tryParseAsDataURI(url);
        if (data) {
          onload(data.buffer);
          return
        }
        onerror()
      };
      xhr.onerror = onerror;
      xhr.send(null)
    };
    if (typeof arguments != "undefined") {
      Module["arguments"] = arguments
    }
    Module["setWindowTitle"] = (function(title) {
      document.title = title
    })
  }
  Module["print"] = typeof console !== "undefined" ? console.log.bind(console) : typeof print !== "undefined" ? print : null;
  Module["printErr"] = typeof printErr !== "undefined" ? printErr : typeof console !== "undefined" && console.warn.bind(console) || Module["print"];
  Module.print = Module["print"];
  Module.printErr = Module["printErr"];
  for (key in moduleOverrides) {
    if (moduleOverrides.hasOwnProperty(key)) {
      Module[key] = moduleOverrides[key]
    }
  }
  moduleOverrides = undefined;
  var STACK_ALIGN = 16;

  function staticAlloc(size) {
    assert(!staticSealed);
    var ret = STATICTOP;
    STATICTOP = STATICTOP + size + 15 & -16;
    return ret
  }

  function dynamicAlloc(size) {
    assert(DYNAMICTOP_PTR);
    var ret = HEAP32[DYNAMICTOP_PTR >> 2];
    var end = ret + size + 15 & -16;
    HEAP32[DYNAMICTOP_PTR >> 2] = end;
    if (end >= TOTAL_MEMORY) {
      var success = enlargeMemory();
      if (!success) {
        HEAP32[DYNAMICTOP_PTR >> 2] = ret;
        return 0
      }
    }
    return ret
  }

  function alignMemory(size, factor) {
    if (!factor) factor = STACK_ALIGN;
    var ret = size = Math.ceil(size / factor) * factor;
    return ret
  }

  function getNativeTypeSize(type) {
    switch (type) {
      case "i1":
      case "i8":
        return 1;
      case "i16":
        return 2;
      case "i32":
        return 4;
      case "i64":
        return 8;
      case "float":
        return 4;
      case "double":
        return 8;
      default:
        {
          if (type[type.length - 1] === "*") {
            return 4
          } else if (type[0] === "i") {
            var bits = parseInt(type.substr(1));
            assert(bits % 8 === 0);
            return bits / 8
          } else {
            return 0
          }
        }
    }
  }

  function warnOnce(text) {
    if (!warnOnce.shown) warnOnce.shown = {};
    if (!warnOnce.shown[text]) {
      warnOnce.shown[text] = 1;
      Module.printErr(text)
    }
  }
  var jsCallStartIndex = 1;
  var functionPointers = new Array(0);
  var funcWrappers = {};

  function dynCall(sig, ptr, args) {
    if (args && args.length) {
      return Module["dynCall_" + sig].apply(null, [ptr].concat(args))
    } else {
      return Module["dynCall_" + sig].call(null, ptr)
    }
  }
  var GLOBAL_BASE = 8;
  var ABORT = 0;
  var EXITSTATUS = 0;

  function assert(condition, text) {
    if (!condition) {
      abort("Assertion failed: " + text)
    }
  }

  function getCFunc(ident) {
    var func = Module["_" + ident];
    assert(func, "Cannot call unknown function " + ident + ", make sure it is exported");
    return func
  }
  var JSfuncs = {
    "stackSave": (function() {
      stackSave()
    }),
    "stackRestore": (function() {
      stackRestore()
    }),
    "arrayToC": (function(arr) {
      var ret = stackAlloc(arr.length);
      writeArrayToMemory(arr, ret);
      return ret
    }),
    "stringToC": (function(str) {
      var ret = 0;
      if (str !== null && str !== undefined && str !== 0) {
        var len = (str.length << 2) + 1;
        ret = stackAlloc(len);
        stringToUTF8(str, ret, len)
      }
      return ret
    })
  };
  var toC = {
    "string": JSfuncs["stringToC"],
    "array": JSfuncs["arrayToC"]
  };

  function ccall(ident, returnType, argTypes, args, opts) {
    var func = getCFunc(ident);
    var cArgs = [];
    var stack = 0;
    if (args) {
      for (var i = 0; i < args.length; i++) {
        var converter = toC[argTypes[i]];
        if (converter) {
          if (stack === 0) stack = stackSave();
          cArgs[i] = converter(args[i])
        } else {
          cArgs[i] = args[i]
        }
      }
    }
    var ret = func.apply(null, cArgs);
    if (returnType === "string") ret = Pointer_stringify(ret);
    if (stack !== 0) {
      if (opts && opts.async) {
        EmterpreterAsync.asyncFinalizers.push((function() {
          stackRestore(stack)
        }));
        return
      }
      stackRestore(stack)
    }
    return ret
  }

  function setValue(ptr, value, type, noSafe) {
    type = type || "i8";
    if (type.charAt(type.length - 1) === "*") type = "i32";
    switch (type) {
      case "i1":
        HEAP8[ptr >> 0] = value;
        break;
      case "i8":
        HEAP8[ptr >> 0] = value;
        break;
      case "i16":
        HEAP16[ptr >> 1] = value;
        break;
      case "i32":
        HEAP32[ptr >> 2] = value;
        break;
      case "i64":
        tempI64 = [value >>> 0, (tempDouble = value, +Math_abs(tempDouble) >= +1 ? tempDouble > +0 ? (Math_min(+Math_floor(tempDouble / +4294967296), +4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / +4294967296) >>> 0 : 0)], HEAP32[ptr >> 2] = tempI64[0], HEAP32[ptr + 4 >> 2] = tempI64[1];
        break;
      case "float":
        HEAPF32[ptr >> 2] = value;
        break;
      case "double":
        HEAPF64[ptr >> 3] = value;
        break;
      default:
        abort("invalid type for setValue: " + type)
    }
  }
  var ALLOC_STATIC = 2;
  var ALLOC_NONE = 4;

  function allocate(slab, types, allocator, ptr) {
    var zeroinit, size;
    if (typeof slab === "number") {
      zeroinit = true;
      size = slab
    } else {
      zeroinit = false;
      size = slab.length
    }
    var singleType = typeof types === "string" ? types : null;
    var ret;
    if (allocator == ALLOC_NONE) {
      ret = ptr
    } else {
      ret = [typeof _malloc === "function" ? _malloc : staticAlloc, stackAlloc, staticAlloc, dynamicAlloc][allocator === undefined ? ALLOC_STATIC : allocator](Math.max(size, singleType ? 1 : types.length))
    }
    if (zeroinit) {
      var stop;
      ptr = ret;
      assert((ret & 3) == 0);
      stop = ret + (size & ~3);
      for (; ptr < stop; ptr += 4) {
        HEAP32[ptr >> 2] = 0
      }
      stop = ret + size;
      while (ptr < stop) {
        HEAP8[ptr++ >> 0] = 0
      }
      return ret
    }
    if (singleType === "i8") {
      if (slab.subarray || slab.slice) {
        HEAPU8.set(slab, ret)
      } else {
        HEAPU8.set(new Uint8Array(slab), ret)
      }
      return ret
    }
    var i = 0,
      type, typeSize, previousType;
    while (i < size) {
      var curr = slab[i];
      type = singleType || types[i];
      if (type === 0) {
        i++;
        continue
      }
      if (type == "i64") type = "i32";
      setValue(ret + i, curr, type);
      if (previousType !== type) {
        typeSize = getNativeTypeSize(type);
        previousType = type
      }
      i += typeSize
    }
    return ret
  }

  function getMemory(size) {
    if (!staticSealed) return staticAlloc(size);
    if (!runtimeInitialized) return dynamicAlloc(size);
    return _malloc(size)
  }

  function Pointer_stringify(ptr, length) {
    if (length === 0 || !ptr) return "";
    var hasUtf = 0;
    var t;
    var i = 0;
    while (1) {
      t = HEAPU8[ptr + i >> 0];
      hasUtf |= t;
      if (t == 0 && !length) break;
      i++;
      if (length && i == length) break
    }
    if (!length) length = i;
    var ret = "";
    if (hasUtf < 128) {
      var MAX_CHUNK = 1024;
      var curr;
      while (length > 0) {
        curr = String.fromCharCode.apply(String, HEAPU8.subarray(ptr, ptr + Math.min(length, MAX_CHUNK)));
        ret = ret ? ret + curr : curr;
        ptr += MAX_CHUNK;
        length -= MAX_CHUNK
      }
      return ret
    }
    return UTF8ToString(ptr)
  }
  var UTF8Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf8") : undefined;

  function UTF8ArrayToString(u8Array, idx) {
    var endPtr = idx;
    while (u8Array[endPtr]) ++endPtr;
    if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
      return UTF8Decoder.decode(u8Array.subarray(idx, endPtr))
    } else {
      var u0, u1, u2, u3, u4, u5;
      var str = "";
      while (1) {
        u0 = u8Array[idx++];
        if (!u0) return str;
        if (!(u0 & 128)) {
          str += String.fromCharCode(u0);
          continue
        }
        u1 = u8Array[idx++] & 63;
        if ((u0 & 224) == 192) {
          str += String.fromCharCode((u0 & 31) << 6 | u1);
          continue
        }
        u2 = u8Array[idx++] & 63;
        if ((u0 & 240) == 224) {
          u0 = (u0 & 15) << 12 | u1 << 6 | u2
        } else {
          u3 = u8Array[idx++] & 63;
          if ((u0 & 248) == 240) {
            u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | u3
          } else {
            u4 = u8Array[idx++] & 63;
            if ((u0 & 252) == 248) {
              u0 = (u0 & 3) << 24 | u1 << 18 | u2 << 12 | u3 << 6 | u4
            } else {
              u5 = u8Array[idx++] & 63;
              u0 = (u0 & 1) << 30 | u1 << 24 | u2 << 18 | u3 << 12 | u4 << 6 | u5
            }
          }
        }
        if (u0 < 65536) {
          str += String.fromCharCode(u0)
        } else {
          var ch = u0 - 65536;
          str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023)
        }
      }
    }
  }

  function UTF8ToString(ptr) {
    return UTF8ArrayToString(HEAPU8, ptr)
  }

  function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
    if (!(maxBytesToWrite > 0)) return 0;
    var startIdx = outIdx;
    var endIdx = outIdx + maxBytesToWrite - 1;
    for (var i = 0; i < str.length; ++i) {
      var u = str.charCodeAt(i);
      if (u >= 55296 && u <= 57343) u = 65536 + ((u & 1023) << 10) | str.charCodeAt(++i) & 1023;
      if (u <= 127) {
        if (outIdx >= endIdx) break;
        outU8Array[outIdx++] = u
      } else if (u <= 2047) {
        if (outIdx + 1 >= endIdx) break;
        outU8Array[outIdx++] = 192 | u >> 6;
        outU8Array[outIdx++] = 128 | u & 63
      } else if (u <= 65535) {
        if (outIdx + 2 >= endIdx) break;
        outU8Array[outIdx++] = 224 | u >> 12;
        outU8Array[outIdx++] = 128 | u >> 6 & 63;
        outU8Array[outIdx++] = 128 | u & 63
      } else if (u <= 2097151) {
        if (outIdx + 3 >= endIdx) break;
        outU8Array[outIdx++] = 240 | u >> 18;
        outU8Array[outIdx++] = 128 | u >> 12 & 63;
        outU8Array[outIdx++] = 128 | u >> 6 & 63;
        outU8Array[outIdx++] = 128 | u & 63
      } else if (u <= 67108863) {
        if (outIdx + 4 >= endIdx) break;
        outU8Array[outIdx++] = 248 | u >> 24;
        outU8Array[outIdx++] = 128 | u >> 18 & 63;
        outU8Array[outIdx++] = 128 | u >> 12 & 63;
        outU8Array[outIdx++] = 128 | u >> 6 & 63;
        outU8Array[outIdx++] = 128 | u & 63
      } else {
        if (outIdx + 5 >= endIdx) break;
        outU8Array[outIdx++] = 252 | u >> 30;
        outU8Array[outIdx++] = 128 | u >> 24 & 63;
        outU8Array[outIdx++] = 128 | u >> 18 & 63;
        outU8Array[outIdx++] = 128 | u >> 12 & 63;
        outU8Array[outIdx++] = 128 | u >> 6 & 63;
        outU8Array[outIdx++] = 128 | u & 63
      }
    }
    outU8Array[outIdx] = 0;
    return outIdx - startIdx
  }

  function stringToUTF8(str, outPtr, maxBytesToWrite) {
    return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite)
  }

  function lengthBytesUTF8(str) {
    var len = 0;
    for (var i = 0; i < str.length; ++i) {
      var u = str.charCodeAt(i);
      if (u >= 55296 && u <= 57343) u = 65536 + ((u & 1023) << 10) | str.charCodeAt(++i) & 1023;
      if (u <= 127) {
        ++len
      } else if (u <= 2047) {
        len += 2
      } else if (u <= 65535) {
        len += 3
      } else if (u <= 2097151) {
        len += 4
      } else if (u <= 67108863) {
        len += 5
      } else {
        len += 6
      }
    }
    return len
  }
  var UTF16Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf-16le") : undefined;

  function allocateUTF8(str) {
    var size = lengthBytesUTF8(str) + 1;
    var ret = _malloc(size);
    if (ret) stringToUTF8Array(str, HEAP8, ret, size);
    return ret
  }

  function demangle(func) {
    return func
  }

  function demangleAll(text) {
    var regex = /__Z[\w\d_]+/g;
    return text.replace(regex, (function(x) {
      var y = demangle(x);
      return x === y ? x : x + " [" + y + "]"
    }))
  }

  function jsStackTrace() {
    var err = new Error;
    if (!err.stack) {
      try {
        throw new Error(0)
      } catch (e) {
        err = e
      }
      if (!err.stack) {
        return "(no stack trace available)"
      }
    }
    return err.stack.toString()
  }

  function stackTrace() {
    var js = jsStackTrace();
    if (Module["extraStackTrace"]) js += "\n" + Module["extraStackTrace"]();
    return demangleAll(js)
  }
  var buffer, HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;

  function updateGlobalBufferViews() {
    Module["HEAP8"] = HEAP8 = new Int8Array(buffer);
    Module["HEAP16"] = HEAP16 = new Int16Array(buffer);
    Module["HEAP32"] = HEAP32 = new Int32Array(buffer);
    Module["HEAPU8"] = HEAPU8 = new Uint8Array(buffer);
    Module["HEAPU16"] = HEAPU16 = new Uint16Array(buffer);
    Module["HEAPU32"] = HEAPU32 = new Uint32Array(buffer);
    Module["HEAPF32"] = HEAPF32 = new Float32Array(buffer);
    Module["HEAPF64"] = HEAPF64 = new Float64Array(buffer)
  }
  var STATIC_BASE, STATICTOP, staticSealed;
  var STACK_BASE, STACKTOP, STACK_MAX;
  var DYNAMIC_BASE, DYNAMICTOP_PTR;
  STATIC_BASE = STATICTOP = STACK_BASE = STACKTOP = STACK_MAX = DYNAMIC_BASE = DYNAMICTOP_PTR = 0;
  staticSealed = false;

  function abortOnCannotGrowMemory() {
    abort("Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value " + TOTAL_MEMORY + ", (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime but prevents some optimizations, (3) set Module.TOTAL_MEMORY to a higher value before the program runs, or (4) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ")
  }

  function enlargeMemory() {
    abortOnCannotGrowMemory()
  }
  var TOTAL_STACK = Module["TOTAL_STACK"] || 5242880;
  var TOTAL_MEMORY = Module["TOTAL_MEMORY"] || 67108864;
  if (TOTAL_MEMORY < TOTAL_STACK) Module.printErr("TOTAL_MEMORY should be larger than TOTAL_STACK, was " + TOTAL_MEMORY + "! (TOTAL_STACK=" + TOTAL_STACK + ")");
  if (Module["buffer"]) {
    buffer = Module["buffer"]
  } else {
    {
      buffer = new ArrayBuffer(TOTAL_MEMORY)
    }
    Module["buffer"] = buffer
  }
  updateGlobalBufferViews();

  function getTotalMemory() {
    return TOTAL_MEMORY
  }
  HEAP32[0] = 1668509029;
  HEAP16[1] = 25459;
  if (HEAPU8[2] !== 115 || HEAPU8[3] !== 99) throw "Runtime error: expected the system to be little-endian!";

  function callRuntimeCallbacks(callbacks) {
    while (callbacks.length > 0) {
      var callback = callbacks.shift();
      if (typeof callback == "function") {
        callback();
        continue
      }
      var func = callback.func;
      if (typeof func === "number") {
        if (callback.arg === undefined) {
          Module["dynCall_v"](func)
        } else {
          Module["dynCall_vi"](func, callback.arg)
        }
      } else {
        func(callback.arg === undefined ? null : callback.arg)
      }
    }
  }
  var __ATPRERUN__ = [];
  var __ATINIT__ = [];
  var __ATMAIN__ = [];
  var __ATEXIT__ = [];
  var __ATPOSTRUN__ = [];
  var runtimeInitialized = false;
  var runtimeExited = false;

  function preRun() {
    if (Module["preRun"]) {
      if (typeof Module["preRun"] == "function") Module["preRun"] = [Module["preRun"]];
      while (Module["preRun"].length) {
        addOnPreRun(Module["preRun"].shift())
      }
    }
    callRuntimeCallbacks(__ATPRERUN__)
  }

  function ensureInitRuntime() {
    if (runtimeInitialized) return;
    runtimeInitialized = true;
    callRuntimeCallbacks(__ATINIT__)
  }

  function preMain() {
    callRuntimeCallbacks(__ATMAIN__)
  }

  function exitRuntime() {
    callRuntimeCallbacks(__ATEXIT__);
    runtimeExited = true
  }

  function postRun() {
    if (Module["postRun"]) {
      if (typeof Module["postRun"] == "function") Module["postRun"] = [Module["postRun"]];
      while (Module["postRun"].length) {
        addOnPostRun(Module["postRun"].shift())
      }
    }
    callRuntimeCallbacks(__ATPOSTRUN__)
  }

  function addOnPreRun(cb) {
    __ATPRERUN__.unshift(cb)
  }

  function addOnPostRun(cb) {
    __ATPOSTRUN__.unshift(cb)
  }

  function writeArrayToMemory(array, buffer) {
    HEAP8.set(array, buffer)
  }

  function writeAsciiToMemory(str, buffer, dontAddNull) {
    for (var i = 0; i < str.length; ++i) {
      HEAP8[buffer++ >> 0] = str.charCodeAt(i)
    }
    if (!dontAddNull) HEAP8[buffer >> 0] = 0
  }
  var Math_abs = Math.abs;
  var Math_cos = Math.cos;
  var Math_sin = Math.sin;
  var Math_tan = Math.tan;
  var Math_acos = Math.acos;
  var Math_asin = Math.asin;
  var Math_atan = Math.atan;
  var Math_atan2 = Math.atan2;
  var Math_exp = Math.exp;
  var Math_log = Math.log;
  var Math_sqrt = Math.sqrt;
  var Math_ceil = Math.ceil;
  var Math_floor = Math.floor;
  var Math_pow = Math.pow;
  var Math_imul = Math.imul;
  var Math_fround = Math.fround;
  var Math_round = Math.round;
  var Math_min = Math.min;
  var Math_max = Math.max;
  var Math_clz32 = Math.clz32;
  var Math_trunc = Math.trunc;
  var runDependencies = 0;
  var runDependencyWatcher = null;
  var dependenciesFulfilled = null;

  function getUniqueRunDependency(id) {
    return id
  }

  function addRunDependency(id) {
    runDependencies++;
    if (Module["monitorRunDependencies"]) {
      Module["monitorRunDependencies"](runDependencies)
    }
  }

  function removeRunDependency(id) {
    runDependencies--;
    if (Module["monitorRunDependencies"]) {
      Module["monitorRunDependencies"](runDependencies)
    }
    if (runDependencies == 0) {
      if (runDependencyWatcher !== null) {
        clearInterval(runDependencyWatcher);
        runDependencyWatcher = null
      }
      if (dependenciesFulfilled) {
        var callback = dependenciesFulfilled;
        dependenciesFulfilled = null;
        callback()
      }
    }
  }
  Module["preloadedImages"] = {};
  Module["preloadedAudios"] = {};
  var memoryInitializer = null;
  var dataURIPrefix = "data:application/octet-stream;base64,";

  function isDataURI(filename) {
    return String.prototype.startsWith ? filename.startsWith(dataURIPrefix) : filename.indexOf(dataURIPrefix) === 0
  }
  var ASM_CONSTS = [(function() {
    return _EM_signalStop
  }), (function() {
    if (_EM_seekSamples < ULONG_MAX) {
      var tmp = _EM_seekSamples;
      _EM_seekSamples = ULONG_MAX;
      circularBuffer.reset();
      return tmp
    }
    return ULONG_MAX
  }), (function() {
    return circularBuffer.full()
  }), (function($0, $1, $2) {
    updateProgress($0, $1, $2)
  }), (function() {
    completeConversion(status)
  }), (function($0, $1) {
    processAudio($0, $1)
  })];

  function _emscripten_asm_const_i(code) {
    return ASM_CONSTS[code]()
  }

  function _emscripten_asm_const_iii(code, a0, a1) {
    return ASM_CONSTS[code](a0, a1)
  }

  function _emscripten_asm_const_iiii(code, a0, a1, a2) {
    return ASM_CONSTS[code](a0, a1, a2)
  }
  STATIC_BASE = GLOBAL_BASE;
  STATICTOP = STATIC_BASE + 43616;
  __ATINIT__.push();
  memoryInitializer = "data:application/octet-stream;base64,BoGVQ4ts/b9SuB6F69EYwNV46SYxyCHAke18PzUeKMAfhetRuN4vwP7UeOkm8TTA+FPjpZvEwL9SuB6F69EYwJHtfD81HijAAiuHFtnuNMACK4cW2e40wBfZzvdT4y/A+FPjpZvEwL9SuB6F69EYwJHtfD81HijAAiuHFtnuNMACK4cW2e40wBfZzvdT4y/ABoGVQ4ts/b9SuB6F69EYwNV46SYxyCHAke18PzUeKMAfhetRuN4vwP7UeOkm8TTABoGVQ4ts/b9SuB6F69EYwNV46SYxyCHAke18PzUeKMAfhetRuN4vwP7UeOkm8TTA+FPjpZvEwL9SuB6F69EYwJHtfD81HijAAiuHFtnuNMACK4cW2e40wBfZzvdT4y/A+FPjpZvEwL9SuB6F69EYwJHtfD81HijAAiuHFtnuNMACK4cW2e40wBfZzvdT4y/ABoGVQ4ts/b9SuB6F69EYwNV46SYxyCHAke18PzUeKMAfhetRuN4vwP7UeOkm8TTA6iAAAPMgAAALIQAAGiEAACkhAAA4IQAARyEAAGohAAB3IQAAjyEAAKAhAAC8IQAAzCEAAPEhAAABIgAAESIAACMiAAAyIgAAQiIAAAAAh0EAALRBAAAHQQAAh0EAAAAA5Nu7PeTbOz2Fevo85Nu7PINJljyFeno8KbJWPOTbOzxZ/CY8g0kWPOufCDyFevo7BTbnOymy1jsEYsg75Nu7O/XOsDtZ/KY7bjKeO4NJljtxIY877J+IOzqvgjuFeno7nnVwOwU2ZzvKpV47KbJWO+hKTzsEYkg7P+tBO+TbOzuOKjY7884wO7rBKztZ/CY7/HgiO3AyHjsDJBo7g0kWOyGfEjtxIQ87T80LO+qfCDutlgU7Oq8CO9jO/zqFevo65l31Op518DqZvus6BTbnOjrZ4jrOpd46epnaOimy1jro7dI66ErPOnrHyzoEYsg6ExnFOj/rwTpB1746AAAAAOTbOz/k27s+hXp6PuTbOz6DSRY+hXr6PSmy1j3k27s9WfymPYNJlj3rn4g9hXp6PQU2Zz0pslY9BGJIPeTbOz31zjA9WfwmPW8yHj2DSRY9cSEPPeufCD06rwI9hXr6PJ518DwFNuc8zKXePCmy1jzqSs88BGLIPD7rwTzk27s8jyq2PPXOsDy6was8WfymPPx4ojxvMp48AySaPINJljwin5I8cSGPPFDNizzrn4g8rZaFPDqvgjzVzn88hXp6POZddTyedXA8m75rPAU2Zzw62WI8y6VePHmZWjwpslY86e1SPOpKTzx5x0s8BGJIPBEZRTw+60E8Qdc+PAAAAADk27tA5Ns7QIV6+j/k27s/g0mWP4V6ej8pslY/5Ns7P1n8Jj+DSRY/658IP4V6+j4FNuc+KbLWPgRiyD7k27s+9M6wPln8pj5vMp4+g0mWPnEhjz7rn4g+Oq+CPoV6ej6edXA+BTZnPsylXj4pslY+6kpPPgRiSD4+60E+5Ns7Po8qNj71zjA+usErPln8Jj78eCI+bzIePgMkGj6DSRY+Ip8SPnEhDz5QzQs+658IPq2WBT46rwI+1M7/PYV6+j3mXfU9nnXwPZu+6z0FNuc9OtniPcyl3j15mdo9KbLWPent0j3qSs89ecfLPQRiyD0RGcU9PuvBPUHXvj0AAAAA5Ns7QuTbu0GFenpB5Ns7QYNJFkGFevpAKbLWQOTbu0BZ/KZAg0mWQOufiECFenpABTZnQCmyVkAEYkhA5Ns7QPTOMEBZ/CZAbzIeQINJFkBxIQ9A658IQDqvAkCFevo/nnXwPwU25z/Mpd4/KbLWP+pKzz8EYsg/PuvBP+Tbuz+PKrY/9M6wP7rBqz9Z/KY//HiiP28ynj8DJJo/g0mWPyKfkj9xIY8/UM2LP+ufiD+tloU/Oq+CP9TOfz+Feno/5l11P551cD+bvms/BTZnPzrZYj/MpV4/eZlaPymyVj/p7VI/6kpPP3nHSz8EYkg/ERlFPz7rQT9B1z4/AQAAAAIAAAADAAAABAAAAAUAAAAGAAAABwAAAAgAAAAJAAAACgAAAAsAAAAMAAAADQAAAA4AAAAPAAAAEAAAAICv5jGAEe4xgHT1MYDW/DHAOwQyQKILMsAJEzJAchoygNshMgBEKTJAsDAyAB04MgCLPzIA+kYyAGhOMkDZVTLAS10yQL9kMsAzbDKAp3MygB57MkCWgjIAD4oyQImRMoAEmTKAfqAyAPynMsB6rzJA+rYyQHu+MsD6xTLAfc0yAALVMgCH3DKADeQywJLrMkAb8zIApfoywC8CM8C7CTPASBEzwNQYM8BjIDNA9CczwIUvM0AYNzMAqj4zwD5GM8DUTTPAa1UzAARdM0CbZDOANWwzANFzMwBuezOAC4MzwKqKM8BIkjPA6ZkzAIyhM4AvqTNA1LAzwHe4M4AewDOAxsczwG/PMwAa1zMAw94zwG/mM0Ad7jMAzPUzAHz9M0AtBTQA3Qw0QJAUNMBEHDTA+iM0gLErNABnMzRAIDs0QNpCNMCVSjQAUlI0wA9aNEDMYTRAjGk0QE1xNIAPeTTA0oA0AJWINABbkDSAIZg0wOmfNICypzTAeq80QEa3NMASvzSA4MY0QK/ONEB/1jQATt40QCDmNAD07TTAyPU0QJ79NEBzBTVASw01gCQVNQD/HDWA2iQ1ALUsNQCTNDUAcjw1gFJENQA0TDWAFlQ1wPdbNcDcYzUAw2s1QKpzNYCSezUAeoM1wGSLNcBQkzXAPZs1QCyjNUAZqzUACrM1wPu6NcDuwjXA4so1QNjSNUDM2jUAxOI1AL3qNQC38jUAsvo1gKwCNsCpCjbAqBI2wKgaNgCqIjbAqSo2QK0yNsCxOjYAuEI2wL5KNkDHUjaAzlo2wNhiNgDlajYA8nI2AAB7NgANgzbAHYs2QC+TNoBCmzaAVqM2AGyrNkCAszbAl7s2ALHDNgDLyzZA5tM2gADcNkAe5DZAPew2QF30NsB+/DYAnwQ3wMIMN8DnFDcADh03QDUlN8BdLTcAhTU3QLA9N4DcRTeACU43gDhWNwBmXjcAl2Y3AMluN4D8djdAMX83gGSHNwCcjzdA1Jc3wA2gN4BIqDdAhLA3QL+4N4D9wDdAPck3QH7RNwDA2TfAAOI3wEXqN4CL8jcA0vo3gBoDOEBhCzgArBM4APgbOMBEJDiAkyw4wOI0OEAxPThAg0U4gNZNOAArVjjAgF44QNVmOEAtbzjAhnc4QOF/OEA9iDgAmJA4QPaYOIBVoTiAtqk4gBiyOMB7ujgA3sI4gEPLOMCq0zgAE9w4gHzkOADl7DjAUPU4QL79OIAsBjlAnA45QA0XOQB9HznA8Cc5QGUwOUDbODmAUkE5gMhJOUBCUjlAvVo5QDljOcC2azlAM3Q5ALN8OYA0hTkAt405ADuWOQDAnjnAQ6c5QMuvOQBUuDlA3sA5gGnJOcDz0TnAgdo5wBDjOQCh6znAMvQ5QMP8OYBXBTrA7A06wIMWOgAcHzoAtSc6AE0wOgDpODpAhkE6gCRKOgDEUjrAYls6wARkOkCobDrATHU6APN9OsCXhjqAQI86QOqXOsCVoDoAQqk6wO+xOgCcujqATMM6AP7LOgCx1DpAZd06ABjmOgDP7jrAhvc6QEAAO8D6CDtAtBE7QHEaO8AvIzvA7ys7wLA0OwBzPTsANEY7APlOO0C/VzvAhmA7wE9pO0AXcjvA4no7gK+DO4B9jDvATJU7gB2eOwDtpjsAwK87wJS4O8BqwTvAQco7wBfTO8Dx2zuAzOQ7AKntOwCH9jtAY/87wEMIPEAlETxACBo8wOwiPADSKzyAtjQ8wJ49PECIRjxAc088gF9YPIBKYTwAOWo8QClzPMAafDzADYU8QP+NPMD0ljyA6588gOOoPADdsTyA17o8ANHDPEDOzDxAzdU8QM3ePADP5zzAzvA8ANP5PEDYAj0A3ws9QOcUPcDtHT2A+CY9wAQwPQASOT0AIUI9ADFLPcA/VD2AUl09wGZmPUB8bz0Ak3g9gKiBPQDCij3A3JM9APmcPYAWpj0AM689AFO4PcB0wT2Al8o9wLvTPYDh3D3ABeY9AC7vPQBY+D0AgwE+gK8KPkDaEz6ACR0+ADomPsBrLz5Anzg+wNNBPgAHSz4APlQ+wHZdPgCxZj5A7G8+QCZ5PoBkgj7Ao4s+wOSUPkAnnj4AaKc+wKywPkDzuT4AO8M+QITMPoDO1T6AF98+AGXoPkCz8T5AA/s+wFQEP8CkDT+A+BY/AE4gPwClKT+A/TI/QFQ8PwCvRT+AC08/AGlYP4DIYT/AKGs/QIh0P4DrfT8AUIc/QLaQP4Admj/Ag6M/AO6sP8BZtj/Axr8/QDXJPwCi0j+AE9w/QIblP0D67j+Ab/g/gOYBQABcC0CA1RRAgFAeQADNJ0CASjFAAMc6QABIRECAyU1AgE1XQADSYECAVWpAgN1zQIBmfUAA8YZAAH2QQAAKmkAAlqNAACatQIC3tkAAS8BAAN/JQABy00CACd1AAKLmQAA88ECA1/lAgHQDQQAQDUGArxZBAFEgQYDzKUGAlzNBADo9QQDhRkEAiVBBADNaQYDeY0EAiG1BADZ3QYDlgEGAlopBAEmUQYD8nUGArqdBAGWxQYAdu0EA18RBAJLOQYBL2EGACeJBgMjrQQCJ9UEAS/9BAAwJQgDREkKAlxxCgF8mQoAoMEKA8zlCAL1DQoCKTUIAWldCgCphQoD8akIAzXRCAKJ+QoB4iEKAUJJCACqcQgACpkIA3q9CgLu5QgCbw0KAe81CgF3XQoA+4UIAI+tCAAr1QoDx/kIA2whDAMMSQ4CvHEOAnSZDgIwwQwB9OkOAbERDgGBOQ4BVWEMATGJDAERsQwA+dkMANoBDgDKKQ4AwlEMAMJ5DADGoQ4AwskOANLxDADrGQ4BA0EMASdpDgFLkQwBb7kMAaPhDgHYCRACGDESAlxZEAKcgRIC7KkSA0TREgOg+RIABSUSAGFNEgDRdRIBRZ0SAcHFEgJB7RICyhUSA0o9EAPeZRIAdpEQARa5EgG64RACWwkSAwsxEAPDWRIAf4UQAUOtEgH/1RACz/0SA6AlFAB8URYBXHkUAkShFgMkyRYAGPUUARUdFgIRRRQDGW0UABmZFgEpwRQCQekWA14RFgCCPRQBomUUAtKNFgAGuRYBQuEUAocJFgPPMRQBE10UAmeFFAPDrRQBI9kUAogBGAPoKRgBXFUYAtR9GABUqRoB2NEaA1j5GADtJRgChU0aACF5GgHFoRgDcckaARX1GALOHRoAikkYAk5xGgAWnRoB2sUaA67tGgGLGRgDb0EYAVdtGANHlRgBL8EYAyvpGAEoFRwDMD0eATxpHANEkRwBYL0cA4DlHgGlER4D0TkcAfllHgAxkR4CcbkcALnlHAMGDR4BVjkeA6JhHgICjR4AZrkcAtLhHgFDDR4DrzUcAi9hHACzjR4DO7UcAc/hHgBUDSAC9DUgAZhhIgBAjSIC8LUiAajhIgBZDSADHTUgAelhIAC5jSIDjbUiAl3hIgFCDSIAKjkiAxphIAISjSABArkiAALlIAMPDSACHzkiATNlIgBPkSADZ7kiAo/lIgG8ESQA9D0mACxpJANkkSYCrL0mAfzpJAFVFSQAsUEmAAVtJgNtlSYC3cEkAlXtJAHSGSQBVkUkANJxJABinSYD9sUmA5LxJgM3HSYC00kmAoN1JAI7oSYB980kAbv5JgGAJSoBRFEoARx9KgD4qSoA3NUoAMkBKACtLSoAoVkoAKGFKAClsSgAsd0oALYJKADONSoA6mEqAQ6NKgE6uSgBbuUoAZsRKgHXPSgCH2koAmuVKAK/wSgDC+0qA2QZLgPMRS4AOHUsAKyhLgEYzSwBnPkuAiElLAKxUSwDRX0sA+GpLAB12SwBHgUuAcoxLgJ+XSwDPoksA/K1LgC65S4BixEsAmM9LgM/aSwAF5kuAP/FLAHz8SwC6B0wA+RJMgDoeTAB6KUyAvjRMAAVATABNS0yAllZMgN5hTIArbUwAenhMAMqDTAAcj0yAbJpMgMGlTIAYsUyAcbxMgMvHTIAn00wAgt5MAOHpTIBC9UwApQBNgAkMTQBsF00A1CJNAD0uTYCoOU2AFUVNAIRQTYDwW02AYmdNANZyTYBLfk2AwolNADiVTQCyoE0ALqxNAKy3TYArw00Aqc5NgCzaTQCx5U2AN/FNAL/8TYBICE4A0RNOAF4fToDsKk6AfTZOgA9CTgCgTU6ANVlOAM1kTgBmcE4AAXxOAJqHToA4k06A2J5OAHqqToAdtk6AwsFOAGbNToAO2U4AueROgGTwToAS/E6AvgdPAHATT4AiH0+A1ypPAI42T4BCQk+A/E1PALhZTwB1ZU+ANHFPAPV8T4C0iE+AeJRPgD6gT4AGrE8A0LdPgJfDT4Bkz0+AM9tPAATnTwDW8k+Apv5PgHwKUABUFlAALSJQAAguUADlOVAAwEVQAKBRUACCXVAAZmlQgEt1UAAvgVAAGI1QAAOZUIDvpFAA3rBQAM68UAC8yFAAsNRQgKXgUICc7FCAlfhQgIwEUQCJEFGAhxxRgIcoUQCJNFEAiUBRgI5MUQCWWFGAnmRRAKlwUYC1fFGAwIhRgNCUUYDioFEA9qxRAAu5UQAfxVEAONFRgFLdUQBv6VGAjfVRAKoBUgDMDVIA8BlSgBUmUoA8MlKAZT5SAI1KUoC5VlKA6GJSgBhvUgBLe1IAe4dSALGTUoDon1KAIaxSAF24UgCWxFIA1dBSgBXdUgBY6VIAnPVSAOIBU4AmDlMAcBpTgLsmUwAJM1MAWD9TAKVLUwD4V1OATGRTAKNwUwD7fFOAUYlTAK2VUwALolOAaq5TAMy6UwAvx1OAkNNTgPffUwBg7FOAyvhTADcFVACiEVSAER5UgIMqVAD3NlQAbUNUAORPVIBZXFSA1GhUgFF1VIDQgVQAUY5UgM+aVABUp1QA2rNUAGLAVADszFSAdNlUgAHmVICR8lQAI/9UALYLVYBKGFUA3iRVAHcxVYARPlUArkpVgExXVQDpY1UAi3BVAC99VYDUiVWAfJZVACKjVYDNr1UAe7xVACrJVYDb1VUAjuJVgD/vVQD2+1UArwhWgGgVVoAlIlYA4C5WgJ87VgBiSFYAJlVWgOthVoCvblYAeXtWgESIVoARlVYA4aFWALKuVoCBu1aAVshWAC3VVgAG4laA4O5WgLn7VoCXCFcAeBVXAFoiV4A+L1eAIDxXgAhJVwDyVVcA3mJXgMtvVwC7fFcAqYlXgJyWV4CRo1cAibBXAIK9V4B5yleAdtdXAHXkV4B28VcAef5XAH4LWICAGFgAiSVYAJQyWICfP1gArkxYgLpZWADNZlgA4XNYgPeAWAAPjliAJZtYAEGoWABftVgAf8JYgKDPWADE3FgA5ulYgA33WAA3BFkAYhFZgI8eWQC7K1kA7DhZgB9GWYBUU1mAi2BZAMFtWQD8elkAOYhZAHiVWQC5olkA/K9ZgDy9WQCDylkAzNdZABflWYBj8lmArv9ZgP8MWoBRGloApidagPw0WoBRQloArE9agAhdWgBnalqAx3daACmFWoCJkloA8J9agFitWoDCulqAL8haAJrVWgAK41oAfPBagPD9WoBmC1uA2hhbAFUmWwDRM1sAT0FbANBOW4BRXFuA0mlbAFh3W4DghFsAa5JbAPefWwCBrVuAEbtbAKTIWwA41luAzuNbgGbxW4D8/lsAmQxcADcaXIDXJ1yAeTVcABpDXIDAUFwAaV5cABNsXIC/eVwAaodcgBqVXADNolwAgbBcADi+XIDwy1wAp9lcAGTnXAAi9VwA4wJdgKUQXYBmHl2ALSxdAPY5XYDAR10AjlVdgFhjXQAqcV0A/X5dgNGMXQCpml0AgqhdAFm2XYA2xF2AFdJdgPffXQDb7V0AvPtdgKMJXgCNF14AeSVegGYzXoBSQV4ARE9eADhdXgAua14AJnlegCCHXoAYlV4AFqNegBaxXgAZv16AHc1eACDbXoAo6V4AM/deAEAFXwBPE1+AWyFfgG4vX4CDPV+AmktfALRZX4DPZ1+A6HVfAAiEXwApkl8ATaBfAHOuX4CWvF+AwMpfAO3YX4Aa518AS/VfAH0DYICtEWCA5B9ggBwuYABXPGAAlEpgAM9YYAAQZ2CAU3VgAJmDYADgkWCAJaBgAHGuYIC+vGAADstggGDZYAC052CABvZgAF8EYQC5EmEAFiFhgHQvYQDRPWEANExhgJhaYQAAaWGAaXdhANGFYQA+lGEArqJhACCxYYCTv2EACs5hAH7cYYD46mEAdflhAPQHYoB0FmIA8yRigHgzYoD/QWIAiVBiABVfYoCebWIALnxiAMCKYoBUmWKA6qdiAIO2YoAZxWIAttNiAFXiYgD28GIAmv9iADsOY4DiHGOAjCtjgDg6Y4DmSGOAkldjAEVmYwD6dGOAsINjAGqSY4AkoWMA3q9jgJ2+YwAkdMmYnRjCLokAwu3n5MGc7dDBQnDBwfzJtMG+GarBM9mgwbaxmMEcaJHBM9KKwdPQhMGnmH7Bn2R0wWboasF5DGLBoL1Zwe3rUcEJikrBq4xDwTHqPMFSmjbB4JUwwZfWKsH4ViXBLBIgweUDG8FOKBbB/XsRwdv7DMElpQjBWHUEwS1qAMEiA/nAQnPxwEMh6sD3CePAcyrcwAWA1cAxCM/AqcDIwEynwsAdurzARfe2wApdscDS6avAHZymwINyocCza5zAcYaXwJPBksACHI7AtZSJwLQqhcAW3YDA91V5wCknccAzLGnAnmNhwAbMWcAZZFLAlipLwEweRMAZPj3A6og2wLf9L8CImynAbGEjwIFOHcDvYRfA5ZoRwJ74C8BeegbAcB8BwE/O97++oe2/8bfjv7wP2r/8p9C/nX/Hv5WVvr/n6LW/oHitv9VDpb+qSZ2/RomVv94Bjr+tsoa/8DV/vxR0cb9tHmS/sjNXv6aySr8amj6/7egyvwmeJ79ouBy/CzcSvwEZCL/Huvy+rwbqvhcU2L5x4ca+QW22viG2pr67upe+znmJvk7kd75ORV6+fhRGvuNPL76f9Rm+9wMGvpny5r1EqMS9LyalvdRpiL3S4Vy9vXIuvbuCBb0gHcS84SaIvP87LryI+sO7WC4uu+4qLroAAAAAACR0yeZNqMLOOJDCdSKCwmxHcML9xWDCuhpUwpZkScI8HUDCB+43ws2bMMJb/CnCifAjwq5gHsJlOhnCGm8UwgzzD8KdvAvC18MHwg4CBMKdcQDCZRv6wVak88Hbdu3BsoznwVvg4cH8bNzBSC7XwWog0sH1P83B1InIwUD7w8G3kb/B8Eq7wdkkt8GMHbPBTTOvwYRkq8G7r6fBlxOkwdmOoMFZIJ3BBceZwd2BlsH1T5PBbzCQwXsijcFYJYrBUjiHwb1ahMH6i4HB55Z9wTcxeMHY5XLBz7NtwS6aaMETmGPBqqxewSnXWcHPFlXB52pQwcPSS8G/TUfBP9tCwa16PsF6KzrBIO01wRu/McHxoC3BK5IpwVeSJcEJoSHB2L0dwWLoGcFHIBbBKmUSwbS2DsGQFAvBbH4HwfvzA8HwdADBCAL6wOEv88DlcuzAkcrlwGk238DztdjAvEjSwFLuy8BJpsXAOHC/wLhLucBoOLPA6TWtwN5Dp8DvYaHAxI+bwAvNlcBxGZDAqnSKwGfehMDArH7AmbhzwM7faMDWIV7AMH5TwFv0SMDbgz7ANyw0wPrsKcCyxR/A8LUVwEm9C8BR2wHASR/wv72z3L89c8m/Cl22v25wo7+zrJC/VyJ8v1g6V78doDK/X1IOv8Wf1L7iLo2+dZ8MvgAAAAD/////AQAAAPAcAAAFAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAgAAAFamAAAAAAAAAAAAAAAAAAACAAAAAAAAAAAAAAAAAAD//////wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAcB0AAAUAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAACAAAAXqYAAAAEAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAr/////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACymAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACgAAAGQAAADoAwAAECcAAKCGAQBAQg8AgJaYAADh9QVfcIkA/wkvDwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP//////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAEAAYACAAKAAwADgAQABIAFAAWABgAGgAcAB4AIEAiQCRAJkAoQCpALEAuQDBAMkA0QDZAOEA6QDxAPkAAgEKARIBGgEiASoBMgE6AUIBSgFSAVoBYgFqAXIBegGDAYsBkwGbAaMBqwGzAbsBwwHLAdMB2wHjAesB8wH7AQQCDAIUAhwCJAIsAjQCPAJEAkwCVAJcAmQCbAJ0AnwChQKNApUCnQKlAq0CtQK9AsUCzQLVAt0C5QLtAvUC/QIGAw4DFgMeAyYDLgM2Az4DRgNOA1YDXgNmA24DdgN+A4cDjwOXA58DpwOvA7cDvwPHA88D1wPfA+cD7wP3AwAERXJyb3IgKCVzOiVpKSAlcwBFcnJvciAoJXM6JWkpICVzICglcykAU3lzdGVtIEVycm9yICglczolaSkgJXMgOiAlcwBTeXN0ZW0gRXJyb3IgKCVzOiVpKSAlcyAoJXMpIDogJXMATm8gRXJyb3IAVW5hYmxlIHRvIG9idGFpbiBtZW1vcnkAVW5hYmxlIHRvIHN0YXQAVW5hYmxlIHRvIGxvYWQAVW5hYmxlIHRvIG9wZW4AVW5hYmxlIHRvIHJlYWQASW52YWxpZCBvciBVbnN1cHBvcnRlZCBmaWxlIGZvcm1hdABGaWxlIGNvcnJ1cHQATGlicmFyeSBub3QgSW5pdGlhbGl6ZWQASW52YWxpZCBhcmd1bWVudABMaWJyYXJ5IEFscmVhZHkgSW5pdGlhbGl6ZWQATm90IGEgbWlkaSBmaWxlAFJlZnVzaW5nIHRvIGxvYWQgdW51c3VhbGx5IGxvbmcgZmlsZQBOb3QgYW4gaG1wIGZpbGUATm90IGFuIGhtaSBmaWxlAFVuYWJsZSB0byBjb252ZXJ0AE5vdCBhIG11cyBmaWxlAE5vdCBhbiB4bWkgZmlsZQBJbnZhbGlkIGVycm9yIGNvZGUAfi8ASE9NRQBfV01fQnVmZmVyRmlsZQAoTlVMTCBmaWxlbmFtZSkAV2lsZE1pZGlfSW5pdAAoTlVMTCBjb25maWcgZmlsZSBwb2ludGVyKQAoaW52YWxpZCBvcHRpb24pAChyYXRlIG91dCBvZiBib3VuZHMsIHJhbmdlIGlzIDExMDI1IC0gNjU1MzUpAGxvYWRfY29uZmlnAGRpcgAobWlzc2luZyBuYW1lIGluIGRpciBsaW5lKQBzb3VyY2UAKG1pc3NpbmcgbmFtZSBpbiBzb3VyY2UgbGluZSkAYmFuawAoc3ludGF4IGVycm9yIGluIGJhbmsgbGluZSkAZHJ1bXNldAAoc3ludGF4IGVycm9yIGluIGRydW1zZXQgbGluZSkAcmV2ZXJiX3Jvb21fd2lkdGgAKHN5bnRheCBlcnJvciBpbiByZXZlcmJfcm9vbV93aWR0aCBsaW5lKQAlczogcmV2ZXJiX3Jvb21fd2lkdGggPCAxIG1ldGVyLCBzZXR0aW5nIHRvIG1pbmltdW0gb2YgMSBtZXRlcgAlczogcmV2ZXJiX3Jvb21fd2lkdGggPiAxMDAgbWV0ZXJzLCBzZXR0aW5nIHRvIG1heGltdW0gb2YgMTAwIG1ldGVycwByZXZlcmJfcm9vbV9sZW5ndGgAKHN5bnRheCBlcnJvciBpbiByZXZlcmJfcm9vbV9sZW5ndGggbGluZSkAJXM6IHJldmVyYl9yb29tX2xlbmd0aCA8IDEgbWV0ZXIsIHNldHRpbmcgdG8gbWluaW11bSBvZiAxIG1ldGVyACVzOiByZXZlcmJfcm9vbV9sZW5ndGggPiAxMDAgbWV0ZXJzLCBzZXR0aW5nIHRvIG1heGltdW0gb2YgMTAwIG1ldGVycwByZXZlcmJfbGlzdGVuZXJfcG9zeAAoc3ludGF4IGVycm9yIGluIHJldmVyYl9saXN0ZW5fcG9zeCBsaW5lKQAlczogcmV2ZXJiX2xpc3Rlbl9wb3N4IHNldCBvdXRzaWRlIG9mIHJvb20AcmV2ZXJiX2xpc3RlbmVyX3Bvc3kAKHN5bnRheCBlcnJvciBpbiByZXZlcmJfbGlzdGVuX3Bvc3kgbGluZSkAJXM6IHJldmVyYl9saXN0ZW5fcG9zeSBzZXQgb3V0c2lkZSBvZiByb29tAGd1c3BhdF9lZGl0b3JfYXV0aG9yX2NhbnRfcmVhZF9zb19maXhfcmVsZWFzZV90aW1lX2Zvcl9tZQBhdXRvX2FtcABhdXRvX2FtcF93aXRoX2FtcAAobWlzc2luZyBuYW1lIGluIHBhdGNoIGxpbmUpAC5wYXQAYW1wPQAlczogc3ludGF4IGVycm9yIGluIHBhdGNoIGxpbmUgZm9yICVzAG5vdGU9AGVudl90aW1lACVzOiByYW5nZSBlcnJvciBpbiBwYXRjaCBsaW5lICVzAGVudl9sZXZlbAAlczogcmFuZ2UgZXJyb3IgaW4gcGF0Y2ggbGluZSBmb3IgJXMAa2VlcD1sb29wAGtlZXA9ZW52AHJlbW92ZT1zdXN0YWluAHJlbW92ZT1jbGFtcGVkAFdNX0xDX1Rva2VuaXplX0xpbmUAdG8gcGFyc2UgY29uZmlnAFdpbGRNaWRpX01hc3RlclZvbHVtZQAobWFzdGVyIHZvbHVtZSBvdXQgb2YgcmFuZ2UsIHJhbmdlIGlzIDAtMTI3KQBXaWxkTWlkaV9DbG9zZQAoTlVMTCBoYW5kbGUpAChubyBtaWRpJ3Mgb3BlbikAV2lsZE1pZGlfT3BlbgBGT1JNYWRkX2hhbmRsZQAgdG8gZ2V0IHJhbQBXaWxkTWlkaV9GYXN0U2VlawAoTlVMTCBzZWVrIHBvc2l0aW9uIHBvaW50ZXIpAFdpbGRNaWRpX0dldE91dHB1dAAoTlVMTCBidWZmZXIgcG9pbnRlcikAKHNpemUgbm90IGEgbXVsdGlwbGUgb2YgNCkAV2lsZE1pZGlfU2V0T3B0aW9uAChpbnZhbGlkIHNldHRpbmcpAFdpbGRNaWRpX0dldEluZm8AdG8gc2V0IGluZm8AdG8gc2V0IGNvcHlyaWdodABXaWxkTWlkaV9TaHV0ZG93bgBfV01fbG9hZF9ndXNfcGF0AEdGMVBBVENIMTEwAElEIzAwMDAwMgBHRjFQQVRDSDEwMABJRCMwMDAwMDIAJXM6IFdhcm5pbmc6IGZvdW5kIGludmFsaWQgZW52ZWxvcGUoJXUpIHJhdGUgc2V0dGluZyBpbiAlcy4gVXNpbmcgJWYgaW5zdGVhZC4AY29udmVydF8xNnVycAB0byBwYXJzZSBzYW1wbGUAY29udmVydF84dXJwAGNvbnZlcnRfMTZzcnAAY29udmVydF84c3JwAGNvbnZlcnRfMTZ1cgBjb252ZXJ0Xzh1cgBjb252ZXJ0XzE2c3IAY29udmVydF84c3IAY29udmVydF8xNnVwAGNvbnZlcnRfOHVwAGNvbnZlcnRfMTZzcABjb252ZXJ0XzhzcABjb252ZXJ0XzE2dQBjb252ZXJ0Xzh1AGNvbnZlcnRfMTZzAGNvbnZlcnRfOHMAY2FsbG9jIGZhaWxlZABBEEISfn8JAfdDEEwAAH4A919XTV9TZXR1cE1pZGlFdmVudAAodW5yZWNvZ25pemVkIG1ldGEgdHlwZSBldmVudCkAKG1pc3NpbmcgZXZlbnQpAChpbnB1dCB0b28gc2hvcnQpAEZPUk0AX1dNX1BhcnNlTmV3WG1pAFhESVJJTkZPAENBVCAAWE1JRABUSU1CAFJCUk4ARVZOVABfV01fUGFyc2VOZXdNdXMARmlsZSB0b28gc2hvcnQATVVTGkhNSU1JRElQAF9XTV9QYXJzZU5ld0htcAAwMTMxOTUAREVCVUc6IFRlbXBvIGNoYW5nZSAlZg0KAF9XTV9QYXJzZU5ld01pZGkAKHRvbyBzaG9ydCkAUklGRgBNVGhkAChubyB0cmFja3MpAChleHBlY3RlZCAxIHRyYWNrIGZvciB0eXBlIDAgbWlkaSBmaWxlLCBmb3VuZCBtb3JlKQBNVHJrAChtaXNzaW5nIHRyYWNrIGhlYWRlcikAKGJhZCB0cmFjayBzaXplKQAobWlzc2luZyBFT1QpAEhNSS1NSURJU09ORzA2MTU5NQBfV01fUGFyc2VOZXdIbWkAZmlsZSB0b28gc2hvcnQASE1JLU1JRElUUkFDSwB0byBpbml0IHJldmVyYgBmcmVlcGF0cy9mcmVlcGF0cy5jZmcASW5pdGlhbGl6aW5nIFNvdW5kIFN5c3RlbQBDYW5ub3Qgb3BlbiB3YXZlAEluaXRpYWxpemluZyBsaWJXaWxkTWlkaSAlbGQuJWxkLiVsZAoKAENhbm5vdCBXaWxkTWlkaV9Jbml0AE5vdCBlbm91Z2ggbWVtb3J5LCBleGl0aW5nAA1Qcm9jZXNzaW5nICVzIAAgRXJyb3Igb3BlbmluZyBtaWRpOiAlcw0KAA0KW0R1cmF0aW9uIG9mIG1pZGkgYXBwcm94ICUydW0gJTJ1cyBUb3RhbF0NCgAieyByZXR1cm4gX0VNX3NpZ25hbFN0b3A7IH0iACJ7IGlmIChfRU1fc2Vla1NhbXBsZXMgPCBVTE9OR19NQVgpIHsgdmFyIHRtcCA9IF9FTV9zZWVrU2FtcGxlczsgX0VNX3NlZWtTYW1wbGVzID0gVUxPTkdfTUFYOyBjaXJjdWxhckJ1ZmZlci5yZXNldCgpOyByZXR1cm4gdG1wOyB9IHJldHVybiBVTE9OR19NQVg7IH0iACJ7IHJldHVybiBjaXJjdWxhckJ1ZmZlci5mdWxsKCk7IH0iAHsgdXBkYXRlUHJvZ3Jlc3MoJDAsICQxLCAkMik7IH0AT09QUzogZmFpbGVkIGNsb3NpbmcgbWlkaSBoYW5kbGUhDQolcw0KAE9PUFM6IGZhaWx1cmUgc2h1dHRpbmcgZG93biBsaWJXaWxkTWlkaQ0KJXMNCgBGaW5pc2hpbmcgYW5kIGNsb3Npbmcgd2F2IG91dHB1dA0ACkVSUk9SOiBmYWlsZWQgd3JpdGluZyB3YXYgKCVzKQ0KAHsgcHJvY2Vzc0F1ZGlvKCQwLCAkMSk7IH0AY29tcGxldGVDb252ZXJzaW9uKHN0YXR1cyk7AFJJRkYAAAAAV0FWRWZtdCAQAAAAAQACAAAAAAAAAAAABAAQAGRhdGEAAAAARXJyb3I6IHVuYWJsZSB0byBvcGVuIGZpbGUgZm9yIHdyaXRpbmcgKCVzKQ0KAEVSUk9SOiBmYWlsZWQgd3JpdGluZyB3YXYgaGVhZGVyICglcykNCgBpbmZpbml0eQARAAoAERERAAAAAAUAAAAAAAAJAAAAAAsAAAAAAAAAABEADwoREREDCgcAARMJCwsAAAkGCwAACwAGEQAAABEREQAAAAAAAAAAAAAAAAAAAAALAAAAAAAAAAARAAoKERERAAoAAAIACQsAAAAJAAsAAAsAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAAAAAAAAAAAAAAADAAAAAAMAAAAAAkMAAAAAAAMAAAMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4AAAAAAAAAAAAAAA0AAAAEDQAAAAAJDgAAAAAADgAADgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAPAAAAAA8AAAAACRAAAAAAABAAABAAABIAAAASEhIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEgAAABISEgAAAAAAAAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAsAAAAAAAAAAAAAAAoAAAAACgAAAAAJCwAAAAAACwAACwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAAAAAAAAAMAAAAAAwAAAAACQwAAAAAAAwAAAwAAC0rICAgMFgweAAobnVsbCkALTBYKzBYIDBYLTB4KzB4IDB4AGluZgBJTkYAbmFuAE5BTgAwMTIzNDU2Nzg5QUJDREVGLgBUISIZDQECAxFLHAwQBAsdEh4naG5vcHFiIAUGDxMUFRoIFgcoJBcYCQoOGx8lI4OCfSYqKzw9Pj9DR0pNWFlaW1xdXl9gYWNkZWZnaWprbHJzdHl6e3wASWxsZWdhbCBieXRlIHNlcXVlbmNlAERvbWFpbiBlcnJvcgBSZXN1bHQgbm90IHJlcHJlc2VudGFibGUATm90IGEgdHR5AFBlcm1pc3Npb24gZGVuaWVkAE9wZXJhdGlvbiBub3QgcGVybWl0dGVkAE5vIHN1Y2ggZmlsZSBvciBkaXJlY3RvcnkATm8gc3VjaCBwcm9jZXNzAEZpbGUgZXhpc3RzAFZhbHVlIHRvbyBsYXJnZSBmb3IgZGF0YSB0eXBlAE5vIHNwYWNlIGxlZnQgb24gZGV2aWNlAE91dCBvZiBtZW1vcnkAUmVzb3VyY2UgYnVzeQBJbnRlcnJ1cHRlZCBzeXN0ZW0gY2FsbABSZXNvdXJjZSB0ZW1wb3JhcmlseSB1bmF2YWlsYWJsZQBJbnZhbGlkIHNlZWsAQ3Jvc3MtZGV2aWNlIGxpbmsAUmVhZC1vbmx5IGZpbGUgc3lzdGVtAERpcmVjdG9yeSBub3QgZW1wdHkAQ29ubmVjdGlvbiByZXNldCBieSBwZWVyAE9wZXJhdGlvbiB0aW1lZCBvdXQAQ29ubmVjdGlvbiByZWZ1c2VkAEhvc3QgaXMgZG93bgBIb3N0IGlzIHVucmVhY2hhYmxlAEFkZHJlc3MgaW4gdXNlAEJyb2tlbiBwaXBlAEkvTyBlcnJvcgBObyBzdWNoIGRldmljZSBvciBhZGRyZXNzAEJsb2NrIGRldmljZSByZXF1aXJlZABObyBzdWNoIGRldmljZQBOb3QgYSBkaXJlY3RvcnkASXMgYSBkaXJlY3RvcnkAVGV4dCBmaWxlIGJ1c3kARXhlYyBmb3JtYXQgZXJyb3IASW52YWxpZCBhcmd1bWVudABBcmd1bWVudCBsaXN0IHRvbyBsb25nAFN5bWJvbGljIGxpbmsgbG9vcABGaWxlbmFtZSB0b28gbG9uZwBUb28gbWFueSBvcGVuIGZpbGVzIGluIHN5c3RlbQBObyBmaWxlIGRlc2NyaXB0b3JzIGF2YWlsYWJsZQBCYWQgZmlsZSBkZXNjcmlwdG9yAE5vIGNoaWxkIHByb2Nlc3MAQmFkIGFkZHJlc3MARmlsZSB0b28gbGFyZ2UAVG9vIG1hbnkgbGlua3MATm8gbG9ja3MgYXZhaWxhYmxlAFJlc291cmNlIGRlYWRsb2NrIHdvdWxkIG9jY3VyAFN0YXRlIG5vdCByZWNvdmVyYWJsZQBQcmV2aW91cyBvd25lciBkaWVkAE9wZXJhdGlvbiBjYW5jZWxlZABGdW5jdGlvbiBub3QgaW1wbGVtZW50ZWQATm8gbWVzc2FnZSBvZiBkZXNpcmVkIHR5cGUASWRlbnRpZmllciByZW1vdmVkAERldmljZSBub3QgYSBzdHJlYW0ATm8gZGF0YSBhdmFpbGFibGUARGV2aWNlIHRpbWVvdXQAT3V0IG9mIHN0cmVhbXMgcmVzb3VyY2VzAExpbmsgaGFzIGJlZW4gc2V2ZXJlZABQcm90b2NvbCBlcnJvcgBCYWQgbWVzc2FnZQBGaWxlIGRlc2NyaXB0b3IgaW4gYmFkIHN0YXRlAE5vdCBhIHNvY2tldABEZXN0aW5hdGlvbiBhZGRyZXNzIHJlcXVpcmVkAE1lc3NhZ2UgdG9vIGxhcmdlAFByb3RvY29sIHdyb25nIHR5cGUgZm9yIHNvY2tldABQcm90b2NvbCBub3QgYXZhaWxhYmxlAFByb3RvY29sIG5vdCBzdXBwb3J0ZWQAU29ja2V0IHR5cGUgbm90IHN1cHBvcnRlZABOb3Qgc3VwcG9ydGVkAFByb3RvY29sIGZhbWlseSBub3Qgc3VwcG9ydGVkAEFkZHJlc3MgZmFtaWx5IG5vdCBzdXBwb3J0ZWQgYnkgcHJvdG9jb2wAQWRkcmVzcyBub3QgYXZhaWxhYmxlAE5ldHdvcmsgaXMgZG93bgBOZXR3b3JrIHVucmVhY2hhYmxlAENvbm5lY3Rpb24gcmVzZXQgYnkgbmV0d29yawBDb25uZWN0aW9uIGFib3J0ZWQATm8gYnVmZmVyIHNwYWNlIGF2YWlsYWJsZQBTb2NrZXQgaXMgY29ubmVjdGVkAFNvY2tldCBub3QgY29ubmVjdGVkAENhbm5vdCBzZW5kIGFmdGVyIHNvY2tldCBzaHV0ZG93bgBPcGVyYXRpb24gYWxyZWFkeSBpbiBwcm9ncmVzcwBPcGVyYXRpb24gaW4gcHJvZ3Jlc3MAU3RhbGUgZmlsZSBoYW5kbGUAUmVtb3RlIEkvTyBlcnJvcgBRdW90YSBleGNlZWRlZABObyBtZWRpdW0gZm91bmQAV3JvbmcgbWVkaXVtIHR5cGUATm8gZXJyb3IgaW5mb3JtYXRpb24=";
  var tempDoublePtr = STATICTOP;
  STATICTOP += 16;
  var EMTSTACKTOP = getMemory(1048576);
  var EMT_STACK_MAX = EMTSTACKTOP + 1048576;
  var eb = getMemory(976);
  __ATPRERUN__.push((function() {
    HEAPU8.set([140, 3, 23, 0, 0, 0, 0, 0, 2, 15, 0, 0, 0, 64, 0, 0, 2, 16, 0, 0, 3, 41, 0, 0, 2, 17, 0, 0, 255, 15, 0, 0, 1, 13, 0, 0, 136, 18, 0, 0, 0, 14, 18, 0, 136, 18, 0, 0, 25, 18, 18, 64, 137, 18, 0, 0, 25, 12, 14, 56, 25, 11, 14, 48, 25, 10, 14, 40, 25, 6, 14, 32, 25, 5, 14, 24, 25, 4, 14, 8, 0, 3, 14, 0, 2, 18, 0, 0, 8, 164, 0, 0, 1, 19, 243, 43, 85, 18, 19, 0, 1, 18, 9, 44, 135, 19, 0, 0, 18, 0, 0, 0, 78, 19, 1, 0, 33, 9, 19, 0, 121, 9, 13, 0, 135, 19, 1, 0, 1, 0, 0, 0, 32, 19, 19, 255, 121, 19, 7, 0, 1, 18, 35, 44, 135, 19, 2, 0, 18, 3, 0, 0, 135, 19, 3, 0, 1, 1, 1, 0, 119, 0, 8, 0, 1, 13, 5, 0, 119, 0, 6, 0, 2, 19, 0, 0, 12, 164, 0, 0, 1, 18, 17, 0, 85, 19, 18, 0, 1, 13, 5, 0, 32, 18, 13, 5, 121, 18, 192, 0, 135, 8, 4, 0, 43, 18, 8, 16, 1, 19, 255, 0, 19, 18, 18, 19, 85, 4, 18, 0, 43, 19, 8, 8, 1, 20, 255, 0, 19, 19, 19, 20, 109, 4, 4, 19, 1, 18, 255, 0, 19, 18, 8, 18, 109, 4, 8, 18, 1, 19, 52, 44, 135, 18, 2, 0, 19, 4, 0, 0, 2, 19, 0, 0, 8, 164, 0, 0, 82, 19, 19, 0, 1, 20, 68, 172, 1, 21, 0, 0, 135, 18, 5, 0, 19, 20, 21, 0, 32, 18, 18, 255, 121, 18, 7, 0, 1, 21, 91, 44, 135, 18, 0, 0, 21, 0, 0, 0, 135, 18, 3, 0, 1, 1, 1, 0, 119, 0, 162, 0, 135, 8, 6, 0, 15, 0, 0, 0, 120, 8, 8, 0, 1, 21, 112, 44, 135, 18, 0, 0, 21, 0, 0, 0, 135, 18, 7, 0, 135, 18, 3, 0, 1, 1, 1, 0, 119, 0, 152, 0, 1, 21, 127, 0, 135, 18, 8, 0, 21, 0, 0, 0, 135, 18, 9, 0, 85, 5, 0, 0, 1, 21, 139, 44, 135, 18, 2, 0, 21, 5, 0, 0, 135, 7, 10, 0, 0, 0, 0, 0, 1, 18, 232, 28, 1, 21, 232, 28, 82, 21, 21, 0, 25, 21, 21, 1, 85, 18, 21, 0, 120, 7, 6, 0, 135, 21, 11, 0, 85, 6, 21, 0, 1, 18, 155, 44, 135, 21, 2, 0, 18, 6, 0, 0, 135, 1, 12, 0, 7, 0, 0, 0, 106, 0, 1, 8, 1, 18, 6, 0, 1, 20, 6, 0, 135, 21, 13, 0, 7, 18, 20, 0, 2, 21, 0, 0, 240, 95, 40, 0, 7, 21, 0, 21, 85, 10, 21, 0, 2, 20, 0, 0, 240, 95, 40, 0, 9, 20, 0, 20, 2, 18, 0, 0, 68, 172, 0, 0, 7, 20, 20, 18, 109, 10, 4, 20, 1, 21, 181, 44, 135, 20, 2, 0, 21, 10, 0, 0, 1, 20, 236, 28, 82, 0, 20, 0, 1, 21, 13, 0, 135, 20, 14, 0, 21, 0, 0, 0, 1, 20, 255, 255, 15, 5, 20, 2, 25, 4, 1, 8, 25, 1, 1, 4, 82, 20, 4, 0, 82, 21, 1, 0, 4, 3, 20, 21, 120, 3, 3, 0, 1, 13, 26, 0, 119, 0, 61, 0, 120, 9, 22, 0, 1, 20, 0, 0, 135, 21, 15, 0, 20, 0, 0, 0, 120, 21, 56, 0, 1, 21, 1, 0, 135, 6, 15, 0, 21, 0, 0, 0, 85, 10, 6, 0, 33, 21, 6, 255, 121, 21, 3, 0, 135, 21, 16, 0, 7, 10, 0, 0, 1, 20, 2, 0, 135, 21, 15, 0, 20, 0, 0, 0, 120, 21, 3, 0, 1, 13, 20, 0, 119, 0, 4, 0, 135, 21, 17, 0, 2, 0, 0, 0, 119, 0, 229, 255, 32, 21, 13, 20, 121, 21, 2, 0, 1, 13, 0, 0, 48, 20, 17, 3, 192, 2, 0, 0, 0, 21, 15, 0, 119, 0, 3, 0, 41, 20, 3, 2, 0, 21, 20, 0, 135, 3, 18, 0, 7, 8, 21, 0, 34, 21, 3, 1, 121, 21, 3, 0, 1, 13, 26, 0, 119, 0, 24, 0, 135, 1, 12, 0, 7, 0, 0, 0, 1, 20, 3, 0, 106, 18, 1, 4, 106, 19, 1, 8, 106, 22, 1, 16, 135, 21, 19, 0, 20, 18, 19, 22, 2, 22, 0, 0, 12, 164, 0, 0, 82, 22, 22, 0, 38, 22, 22, 31, 135, 21, 20, 0, 22, 8, 3, 0, 34, 21, 21, 0, 121, 21, 3, 0, 1, 13, 23, 0, 119, 0, 6, 0, 120, 5, 2, 0, 119, 0, 192, 255, 135, 21, 17, 0, 2, 0, 0, 0, 119, 0, 189, 255, 32, 21, 13, 23, 121, 21, 5, 0, 1, 22, 13, 0, 135, 21, 21, 0, 22, 0, 0, 0, 119, 0, 15, 0, 32, 21, 13, 26, 121, 21, 13, 0, 135, 21, 22, 0, 7, 0, 0, 0, 32, 21, 21, 255, 121, 21, 6, 0, 135, 21, 11, 0, 85, 11, 21, 0, 1, 22, 221, 45, 135, 21, 23, 0, 0, 22, 11, 0, 1, 22, 0, 0, 135, 21, 24, 0, 8, 22, 15, 0, 135, 21, 25, 0, 135, 21, 26, 0, 8, 0, 0, 0, 135, 21, 7, 0, 32, 21, 21, 255, 121, 21, 7, 0, 135, 21, 11, 0, 85, 12, 21, 0, 1, 22, 5, 46, 135, 21, 23, 0, 0, 22, 12, 0, 135, 21, 9, 0, 135, 21, 3, 0, 1, 1, 0, 0, 137, 14, 0, 0, 139, 1, 0, 0, 0, 0, 0, 0], eb + 0);
    var relocations = [];
    relocations = relocations.concat([692]);
    for (var i = 0; i < relocations.length; i++) {
      HEAPU32[eb + relocations[i] >> 2] = HEAPU32[eb + relocations[i] >> 2] + eb
    }
  }));
  var ERRNO_CODES = {
    EPERM: 1,
    ENOENT: 2,
    ESRCH: 3,
    EINTR: 4,
    EIO: 5,
    ENXIO: 6,
    E2BIG: 7,
    ENOEXEC: 8,
    EBADF: 9,
    ECHILD: 10,
    EAGAIN: 11,
    EWOULDBLOCK: 11,
    ENOMEM: 12,
    EACCES: 13,
    EFAULT: 14,
    ENOTBLK: 15,
    EBUSY: 16,
    EEXIST: 17,
    EXDEV: 18,
    ENODEV: 19,
    ENOTDIR: 20,
    EISDIR: 21,
    EINVAL: 22,
    ENFILE: 23,
    EMFILE: 24,
    ENOTTY: 25,
    ETXTBSY: 26,
    EFBIG: 27,
    ENOSPC: 28,
    ESPIPE: 29,
    EROFS: 30,
    EMLINK: 31,
    EPIPE: 32,
    EDOM: 33,
    ERANGE: 34,
    ENOMSG: 42,
    EIDRM: 43,
    ECHRNG: 44,
    EL2NSYNC: 45,
    EL3HLT: 46,
    EL3RST: 47,
    ELNRNG: 48,
    EUNATCH: 49,
    ENOCSI: 50,
    EL2HLT: 51,
    EDEADLK: 35,
    ENOLCK: 37,
    EBADE: 52,
    EBADR: 53,
    EXFULL: 54,
    ENOANO: 55,
    EBADRQC: 56,
    EBADSLT: 57,
    EDEADLOCK: 35,
    EBFONT: 59,
    ENOSTR: 60,
    ENODATA: 61,
    ETIME: 62,
    ENOSR: 63,
    ENONET: 64,
    ENOPKG: 65,
    EREMOTE: 66,
    ENOLINK: 67,
    EADV: 68,
    ESRMNT: 69,
    ECOMM: 70,
    EPROTO: 71,
    EMULTIHOP: 72,
    EDOTDOT: 73,
    EBADMSG: 74,
    ENOTUNIQ: 76,
    EBADFD: 77,
    EREMCHG: 78,
    ELIBACC: 79,
    ELIBBAD: 80,
    ELIBSCN: 81,
    ELIBMAX: 82,
    ELIBEXEC: 83,
    ENOSYS: 38,
    ENOTEMPTY: 39,
    ENAMETOOLONG: 36,
    ELOOP: 40,
    EOPNOTSUPP: 95,
    EPFNOSUPPORT: 96,
    ECONNRESET: 104,
    ENOBUFS: 105,
    EAFNOSUPPORT: 97,
    EPROTOTYPE: 91,
    ENOTSOCK: 88,
    ENOPROTOOPT: 92,
    ESHUTDOWN: 108,
    ECONNREFUSED: 111,
    EADDRINUSE: 98,
    ECONNABORTED: 103,
    ENETUNREACH: 101,
    ENETDOWN: 100,
    ETIMEDOUT: 110,
    EHOSTDOWN: 112,
    EHOSTUNREACH: 113,
    EINPROGRESS: 115,
    EALREADY: 114,
    EDESTADDRREQ: 89,
    EMSGSIZE: 90,
    EPROTONOSUPPORT: 93,
    ESOCKTNOSUPPORT: 94,
    EADDRNOTAVAIL: 99,
    ENETRESET: 102,
    EISCONN: 106,
    ENOTCONN: 107,
    ETOOMANYREFS: 109,
    EUSERS: 87,
    EDQUOT: 122,
    ESTALE: 116,
    ENOTSUP: 95,
    ENOMEDIUM: 123,
    EILSEQ: 84,
    EOVERFLOW: 75,
    ECANCELED: 125,
    ENOTRECOVERABLE: 131,
    EOWNERDEAD: 130,
    ESTRPIPE: 86
  };
  var ERRNO_MESSAGES = {
    0: "Success",
    1: "Not super-user",
    2: "No such file or directory",
    3: "No such process",
    4: "Interrupted system call",
    5: "I/O error",
    6: "No such device or address",
    7: "Arg list too long",
    8: "Exec format error",
    9: "Bad file number",
    10: "No children",
    11: "No more processes",
    12: "Not enough core",
    13: "Permission denied",
    14: "Bad address",
    15: "Block device required",
    16: "Mount device busy",
    17: "File exists",
    18: "Cross-device link",
    19: "No such device",
    20: "Not a directory",
    21: "Is a directory",
    22: "Invalid argument",
    23: "Too many open files in system",
    24: "Too many open files",
    25: "Not a typewriter",
    26: "Text file busy",
    27: "File too large",
    28: "No space left on device",
    29: "Illegal seek",
    30: "Read only file system",
    31: "Too many links",
    32: "Broken pipe",
    33: "Math arg out of domain of func",
    34: "Math result not representable",
    35: "File locking deadlock error",
    36: "File or path name too long",
    37: "No record locks available",
    38: "Function not implemented",
    39: "Directory not empty",
    40: "Too many symbolic links",
    42: "No message of desired type",
    43: "Identifier removed",
    44: "Channel number out of range",
    45: "Level 2 not synchronized",
    46: "Level 3 halted",
    47: "Level 3 reset",
    48: "Link number out of range",
    49: "Protocol driver not attached",
    50: "No CSI structure available",
    51: "Level 2 halted",
    52: "Invalid exchange",
    53: "Invalid request descriptor",
    54: "Exchange full",
    55: "No anode",
    56: "Invalid request code",
    57: "Invalid slot",
    59: "Bad font file fmt",
    60: "Device not a stream",
    61: "No data (for no delay io)",
    62: "Timer expired",
    63: "Out of streams resources",
    64: "Machine is not on the network",
    65: "Package not installed",
    66: "The object is remote",
    67: "The link has been severed",
    68: "Advertise error",
    69: "Srmount error",
    70: "Communication error on send",
    71: "Protocol error",
    72: "Multihop attempted",
    73: "Cross mount point (not really error)",
    74: "Trying to read unreadable message",
    75: "Value too large for defined data type",
    76: "Given log. name not unique",
    77: "f.d. invalid for this operation",
    78: "Remote address changed",
    79: "Can   access a needed shared lib",
    80: "Accessing a corrupted shared lib",
    81: ".lib section in a.out corrupted",
    82: "Attempting to link in too many libs",
    83: "Attempting to exec a shared library",
    84: "Illegal byte sequence",
    86: "Streams pipe error",
    87: "Too many users",
    88: "Socket operation on non-socket",
    89: "Destination address required",
    90: "Message too long",
    91: "Protocol wrong type for socket",
    92: "Protocol not available",
    93: "Unknown protocol",
    94: "Socket type not supported",
    95: "Not supported",
    96: "Protocol family not supported",
    97: "Address family not supported by protocol family",
    98: "Address already in use",
    99: "Address not available",
    100: "Network interface is not configured",
    101: "Network is unreachable",
    102: "Connection reset by network",
    103: "Connection aborted",
    104: "Connection reset by peer",
    105: "No buffer space available",
    106: "Socket is already connected",
    107: "Socket is not connected",
    108: "Can't send after socket shutdown",
    109: "Too many references",
    110: "Connection timed out",
    111: "Connection refused",
    112: "Host is down",
    113: "Host is unreachable",
    114: "Socket already connected",
    115: "Connection already in progress",
    116: "Stale file handle",
    122: "Quota exceeded",
    123: "No medium (in tape drive)",
    125: "Operation canceled",
    130: "Previous owner died",
    131: "State not recoverable"
  };

  function ___setErrNo(value) {
    if (Module["___errno_location"]) HEAP32[Module["___errno_location"]() >> 2] = value;
    return value
  }
  var PATH = {
    splitPath: (function(filename) {
      var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
      return splitPathRe.exec(filename).slice(1)
    }),
    normalizeArray: (function(parts, allowAboveRoot) {
      var up = 0;
      for (var i = parts.length - 1; i >= 0; i--) {
        var last = parts[i];
        if (last === ".") {
          parts.splice(i, 1)
        } else if (last === "..") {
          parts.splice(i, 1);
          up++
        } else if (up) {
          parts.splice(i, 1);
          up--
        }
      }
      if (allowAboveRoot) {
        for (; up; up--) {
          parts.unshift("..")
        }
      }
      return parts
    }),
    normalize: (function(path) {
      var isAbsolute = path.charAt(0) === "/",
        trailingSlash = path.substr(-1) === "/";
      path = PATH.normalizeArray(path.split("/").filter((function(p) {
        return !!p
      })), !isAbsolute).join("/");
      if (!path && !isAbsolute) {
        path = "."
      }
      if (path && trailingSlash) {
        path += "/"
      }
      return (isAbsolute ? "/" : "") + path
    }),
    dirname: (function(path) {
      var result = PATH.splitPath(path),
        root = result[0],
        dir = result[1];
      if (!root && !dir) {
        return "."
      }
      if (dir) {
        dir = dir.substr(0, dir.length - 1)
      }
      return root + dir
    }),
    basename: (function(path) {
      if (path === "/") return "/";
      var lastSlash = path.lastIndexOf("/");
      if (lastSlash === -1) return path;
      return path.substr(lastSlash + 1)
    }),
    extname: (function(path) {
      return PATH.splitPath(path)[3]
    }),
    join: (function() {
      var paths = Array.prototype.slice.call(arguments, 0);
      return PATH.normalize(paths.join("/"))
    }),
    join2: (function(l, r) {
      return PATH.normalize(l + "/" + r)
    }),
    resolve: (function() {
      var resolvedPath = "",
        resolvedAbsolute = false;
      for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
        var path = i >= 0 ? arguments[i] : FS.cwd();
        if (typeof path !== "string") {
          throw new TypeError("Arguments to path.resolve must be strings")
        } else if (!path) {
          return ""
        }
        resolvedPath = path + "/" + resolvedPath;
        resolvedAbsolute = path.charAt(0) === "/"
      }
      resolvedPath = PATH.normalizeArray(resolvedPath.split("/").filter((function(p) {
        return !!p
      })), !resolvedAbsolute).join("/");
      return (resolvedAbsolute ? "/" : "") + resolvedPath || "."
    }),
    relative: (function(from, to) {
      from = PATH.resolve(from).substr(1);
      to = PATH.resolve(to).substr(1);

      function trim(arr) {
        var start = 0;
        for (; start < arr.length; start++) {
          if (arr[start] !== "") break
        }
        var end = arr.length - 1;
        for (; end >= 0; end--) {
          if (arr[end] !== "") break
        }
        if (start > end) return [];
        return arr.slice(start, end - start + 1)
      }
      var fromParts = trim(from.split("/"));
      var toParts = trim(to.split("/"));
      var length = Math.min(fromParts.length, toParts.length);
      var samePartsLength = length;
      for (var i = 0; i < length; i++) {
        if (fromParts[i] !== toParts[i]) {
          samePartsLength = i;
          break
        }
      }
      var outputParts = [];
      for (var i = samePartsLength; i < fromParts.length; i++) {
        outputParts.push("..")
      }
      outputParts = outputParts.concat(toParts.slice(samePartsLength));
      return outputParts.join("/")
    })
  };
  var TTY = {
    ttys: [],
    init: (function() {}),
    shutdown: (function() {}),
    register: (function(dev, ops) {
      TTY.ttys[dev] = {
        input: [],
        output: [],
        ops: ops
      };
      FS.registerDevice(dev, TTY.stream_ops)
    }),
    stream_ops: {
      open: (function(stream) {
        var tty = TTY.ttys[stream.node.rdev];
        if (!tty) {
          throw new FS.ErrnoError(ERRNO_CODES.ENODEV)
        }
        stream.tty = tty;
        stream.seekable = false
      }),
      close: (function(stream) {
        stream.tty.ops.flush(stream.tty)
      }),
      flush: (function(stream) {
        stream.tty.ops.flush(stream.tty)
      }),
      read: (function(stream, buffer, offset, length, pos) {
        if (!stream.tty || !stream.tty.ops.get_char) {
          throw new FS.ErrnoError(ERRNO_CODES.ENXIO)
        }
        var bytesRead = 0;
        for (var i = 0; i < length; i++) {
          var result;
          try {
            result = stream.tty.ops.get_char(stream.tty)
          } catch (e) {
            throw new FS.ErrnoError(ERRNO_CODES.EIO)
          }
          if (result === undefined && bytesRead === 0) {
            throw new FS.ErrnoError(ERRNO_CODES.EAGAIN)
          }
          if (result === null || result === undefined) break;
          bytesRead++;
          buffer[offset + i] = result
        }
        if (bytesRead) {
          stream.node.timestamp = Date.now()
        }
        return bytesRead
      }),
      write: (function(stream, buffer, offset, length, pos) {
        if (!stream.tty || !stream.tty.ops.put_char) {
          throw new FS.ErrnoError(ERRNO_CODES.ENXIO)
        }
        for (var i = 0; i < length; i++) {
          try {
            stream.tty.ops.put_char(stream.tty, buffer[offset + i])
          } catch (e) {
            throw new FS.ErrnoError(ERRNO_CODES.EIO)
          }
        }
        if (length) {
          stream.node.timestamp = Date.now()
        }
        return i
      })
    },
    default_tty_ops: {
      get_char: (function(tty) {
        if (!tty.input.length) {
          var result = null;
          if (ENVIRONMENT_IS_NODE) {
            var BUFSIZE = 256;
            var buf = new Buffer(BUFSIZE);
            var bytesRead = 0;
            var isPosixPlatform = process.platform != "win32";
            var fd = process.stdin.fd;
            if (isPosixPlatform) {
              var usingDevice = false;
              try {
                fd = fs.openSync("/dev/stdin", "r");
                usingDevice = true
              } catch (e) {}
            }
            try {
              bytesRead = fs.readSync(fd, buf, 0, BUFSIZE, null)
            } catch (e) {
              if (e.toString().indexOf("EOF") != -1) bytesRead = 0;
              else throw e
            }
            if (usingDevice) {
              fs.closeSync(fd)
            }
            if (bytesRead > 0) {
              result = buf.slice(0, bytesRead).toString("utf-8")
            } else {
              result = null
            }
          } else if (typeof window != "undefined" && typeof window.prompt == "function") {
            result = window.prompt("Input: ");
            if (result !== null) {
              result += "\n"
            }
          } else if (typeof readline == "function") {
            result = readline();
            if (result !== null) {
              result += "\n"
            }
          }
          if (!result) {
            return null
          }
          tty.input = intArrayFromString(result, true)
        }
        return tty.input.shift()
      }),
      put_char: (function(tty, val) {
        if (val === null || val === 10) {
          Module["print"](UTF8ArrayToString(tty.output, 0));
          tty.output = []
        } else {
          if (val != 0) tty.output.push(val)
        }
      }),
      flush: (function(tty) {
        if (tty.output && tty.output.length > 0) {
          Module["print"](UTF8ArrayToString(tty.output, 0));
          tty.output = []
        }
      })
    },
    default_tty1_ops: {
      put_char: (function(tty, val) {
        if (val === null || val === 10) {
          Module["printErr"](UTF8ArrayToString(tty.output, 0));
          tty.output = []
        } else {
          if (val != 0) tty.output.push(val)
        }
      }),
      flush: (function(tty) {
        if (tty.output && tty.output.length > 0) {
          Module["printErr"](UTF8ArrayToString(tty.output, 0));
          tty.output = []
        }
      })
    }
  };
  var MEMFS = {
    ops_table: null,
    mount: (function(mount) {
      return MEMFS.createNode(null, "/", 16384 | 511, 0)
    }),
    createNode: (function(parent, name, mode, dev) {
      if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
        throw new FS.ErrnoError(ERRNO_CODES.EPERM)
      }
      if (!MEMFS.ops_table) {
        MEMFS.ops_table = {
          dir: {
            node: {
              getattr: MEMFS.node_ops.getattr,
              setattr: MEMFS.node_ops.setattr,
              lookup: MEMFS.node_ops.lookup,
              mknod: MEMFS.node_ops.mknod,
              rename: MEMFS.node_ops.rename,
              unlink: MEMFS.node_ops.unlink,
              rmdir: MEMFS.node_ops.rmdir,
              readdir: MEMFS.node_ops.readdir,
              symlink: MEMFS.node_ops.symlink
            },
            stream: {
              llseek: MEMFS.stream_ops.llseek
            }
          },
          file: {
            node: {
              getattr: MEMFS.node_ops.getattr,
              setattr: MEMFS.node_ops.setattr
            },
            stream: {
              llseek: MEMFS.stream_ops.llseek,
              read: MEMFS.stream_ops.read,
              write: MEMFS.stream_ops.write,
              allocate: MEMFS.stream_ops.allocate,
              mmap: MEMFS.stream_ops.mmap,
              msync: MEMFS.stream_ops.msync
            }
          },
          link: {
            node: {
              getattr: MEMFS.node_ops.getattr,
              setattr: MEMFS.node_ops.setattr,
              readlink: MEMFS.node_ops.readlink
            },
            stream: {}
          },
          chrdev: {
            node: {
              getattr: MEMFS.node_ops.getattr,
              setattr: MEMFS.node_ops.setattr
            },
            stream: FS.chrdev_stream_ops
          }
        }
      }
      var node = FS.createNode(parent, name, mode, dev);
      if (FS.isDir(node.mode)) {
        node.node_ops = MEMFS.ops_table.dir.node;
        node.stream_ops = MEMFS.ops_table.dir.stream;
        node.contents = {}
      } else if (FS.isFile(node.mode)) {
        node.node_ops = MEMFS.ops_table.file.node;
        node.stream_ops = MEMFS.ops_table.file.stream;
        node.usedBytes = 0;
        node.contents = null
      } else if (FS.isLink(node.mode)) {
        node.node_ops = MEMFS.ops_table.link.node;
        node.stream_ops = MEMFS.ops_table.link.stream
      } else if (FS.isChrdev(node.mode)) {
        node.node_ops = MEMFS.ops_table.chrdev.node;
        node.stream_ops = MEMFS.ops_table.chrdev.stream
      }
      node.timestamp = Date.now();
      if (parent) {
        parent.contents[name] = node
      }
      return node
    }),
    getFileDataAsRegularArray: (function(node) {
      if (node.contents && node.contents.subarray) {
        var arr = [];
        for (var i = 0; i < node.usedBytes; ++i) arr.push(node.contents[i]);
        return arr
      }
      return node.contents
    }),
    getFileDataAsTypedArray: (function(node) {
      if (!node.contents) return new Uint8Array;
      if (node.contents.subarray) return node.contents.subarray(0, node.usedBytes);
      return new Uint8Array(node.contents)
    }),
    expandFileStorage: (function(node, newCapacity) {
      if (node.contents && node.contents.subarray && newCapacity > node.contents.length) {
        node.contents = MEMFS.getFileDataAsRegularArray(node);
        node.usedBytes = node.contents.length
      }
      if (!node.contents || node.contents.subarray) {
        var prevCapacity = node.contents ? node.contents.length : 0;
        if (prevCapacity >= newCapacity) return;
        var CAPACITY_DOUBLING_MAX = 1024 * 1024;
        newCapacity = Math.max(newCapacity, prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2 : 1.125) | 0);
        if (prevCapacity != 0) newCapacity = Math.max(newCapacity, 256);
        var oldContents = node.contents;
        node.contents = new Uint8Array(newCapacity);
        if (node.usedBytes > 0) node.contents.set(oldContents.subarray(0, node.usedBytes), 0);
        return
      }
      if (!node.contents && newCapacity > 0) node.contents = [];
      while (node.contents.length < newCapacity) node.contents.push(0)
    }),
    resizeFileStorage: (function(node, newSize) {
      if (node.usedBytes == newSize) return;
      if (newSize == 0) {
        node.contents = null;
        node.usedBytes = 0;
        return
      }
      if (!node.contents || node.contents.subarray) {
        var oldContents = node.contents;
        node.contents = new Uint8Array(new ArrayBuffer(newSize));
        if (oldContents) {
          node.contents.set(oldContents.subarray(0, Math.min(newSize, node.usedBytes)))
        }
        node.usedBytes = newSize;
        return
      }
      if (!node.contents) node.contents = [];
      if (node.contents.length > newSize) node.contents.length = newSize;
      else
        while (node.contents.length < newSize) node.contents.push(0);
      node.usedBytes = newSize
    }),
    node_ops: {
      getattr: (function(node) {
        var attr = {};
        attr.dev = FS.isChrdev(node.mode) ? node.id : 1;
        attr.ino = node.id;
        attr.mode = node.mode;
        attr.nlink = 1;
        attr.uid = 0;
        attr.gid = 0;
        attr.rdev = node.rdev;
        if (FS.isDir(node.mode)) {
          attr.size = 4096
        } else if (FS.isFile(node.mode)) {
          attr.size = node.usedBytes
        } else if (FS.isLink(node.mode)) {
          attr.size = node.link.length
        } else {
          attr.size = 0
        }
        attr.atime = new Date(node.timestamp);
        attr.mtime = new Date(node.timestamp);
        attr.ctime = new Date(node.timestamp);
        attr.blksize = 4096;
        attr.blocks = Math.ceil(attr.size / attr.blksize);
        return attr
      }),
      setattr: (function(node, attr) {
        if (attr.mode !== undefined) {
          node.mode = attr.mode
        }
        if (attr.timestamp !== undefined) {
          node.timestamp = attr.timestamp
        }
        if (attr.size !== undefined) {
          MEMFS.resizeFileStorage(node, attr.size)
        }
      }),
      lookup: (function(parent, name) {
        throw FS.genericErrors[ERRNO_CODES.ENOENT]
      }),
      mknod: (function(parent, name, mode, dev) {
        return MEMFS.createNode(parent, name, mode, dev)
      }),
      rename: (function(old_node, new_dir, new_name) {
        if (FS.isDir(old_node.mode)) {
          var new_node;
          try {
            new_node = FS.lookupNode(new_dir, new_name)
          } catch (e) {}
          if (new_node) {
            for (var i in new_node.contents) {
              throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY)
            }
          }
        }
        delete old_node.parent.contents[old_node.name];
        old_node.name = new_name;
        new_dir.contents[new_name] = old_node;
        old_node.parent = new_dir
      }),
      unlink: (function(parent, name) {
        delete parent.contents[name]
      }),
      rmdir: (function(parent, name) {
        var node = FS.lookupNode(parent, name);
        for (var i in node.contents) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY)
        }
        delete parent.contents[name]
      }),
      readdir: (function(node) {
        var entries = [".", ".."];
        for (var key in node.contents) {
          if (!node.contents.hasOwnProperty(key)) {
            continue
          }
          entries.push(key)
        }
        return entries
      }),
      symlink: (function(parent, newname, oldpath) {
        var node = MEMFS.createNode(parent, newname, 511 | 40960, 0);
        node.link = oldpath;
        return node
      }),
      readlink: (function(node) {
        if (!FS.isLink(node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
        }
        return node.link
      })
    },
    stream_ops: {
      read: (function(stream, buffer, offset, length, position) {
        var contents = stream.node.contents;
        if (position >= stream.node.usedBytes) return 0;
        var size = Math.min(stream.node.usedBytes - position, length);
        assert(size >= 0);
        if (size > 8 && contents.subarray) {
          buffer.set(contents.subarray(position, position + size), offset)
        } else {
          for (var i = 0; i < size; i++) buffer[offset + i] = contents[position + i]
        }
        return size
      }),
      write: (function(stream, buffer, offset, length, position, canOwn) {
        if (!length) return 0;
        var node = stream.node;
        node.timestamp = Date.now();
        if (buffer.subarray && (!node.contents || node.contents.subarray)) {
          if (canOwn) {
            node.contents = buffer.subarray(offset, offset + length);
            node.usedBytes = length;
            return length
          } else if (node.usedBytes === 0 && position === 0) {
            node.contents = new Uint8Array(buffer.subarray(offset, offset + length));
            node.usedBytes = length;
            return length
          } else if (position + length <= node.usedBytes) {
            node.contents.set(buffer.subarray(offset, offset + length), position);
            return length
          }
        }
        MEMFS.expandFileStorage(node, position + length);
        if (node.contents.subarray && buffer.subarray) node.contents.set(buffer.subarray(offset, offset + length), position);
        else {
          for (var i = 0; i < length; i++) {
            node.contents[position + i] = buffer[offset + i]
          }
        }
        node.usedBytes = Math.max(node.usedBytes, position + length);
        return length
      }),
      llseek: (function(stream, offset, whence) {
        var position = offset;
        if (whence === 1) {
          position += stream.position
        } else if (whence === 2) {
          if (FS.isFile(stream.node.mode)) {
            position += stream.node.usedBytes
          }
        }
        if (position < 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
        }
        return position
      }),
      allocate: (function(stream, offset, length) {
        MEMFS.expandFileStorage(stream.node, offset + length);
        stream.node.usedBytes = Math.max(stream.node.usedBytes, offset + length)
      }),
      mmap: (function(stream, buffer, offset, length, position, prot, flags) {
        if (!FS.isFile(stream.node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.ENODEV)
        }
        var ptr;
        var allocated;
        var contents = stream.node.contents;
        if (!(flags & 2) && (contents.buffer === buffer || contents.buffer === buffer.buffer)) {
          allocated = false;
          ptr = contents.byteOffset
        } else {
          if (position > 0 || position + length < stream.node.usedBytes) {
            if (contents.subarray) {
              contents = contents.subarray(position, position + length)
            } else {
              contents = Array.prototype.slice.call(contents, position, position + length)
            }
          }
          allocated = true;
          ptr = _malloc(length);
          if (!ptr) {
            throw new FS.ErrnoError(ERRNO_CODES.ENOMEM)
          }
          buffer.set(contents, ptr)
        }
        return {
          ptr: ptr,
          allocated: allocated
        }
      }),
      msync: (function(stream, buffer, offset, length, mmapFlags) {
        if (!FS.isFile(stream.node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.ENODEV)
        }
        if (mmapFlags & 2) {
          return 0
        }
        var bytesWritten = MEMFS.stream_ops.write(stream, buffer, 0, length, offset, false);
        return 0
      })
    }
  };
  var IDBFS = {
    dbs: {},
    indexedDB: (function() {
      if (typeof indexedDB !== "undefined") return indexedDB;
      var ret = null;
      if (typeof window === "object") ret = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
      assert(ret, "IDBFS used, but indexedDB not supported");
      return ret
    }),
    DB_VERSION: 21,
    DB_STORE_NAME: "FILE_DATA",
    mount: (function(mount) {
      return MEMFS.mount.apply(null, arguments)
    }),
    syncfs: (function(mount, populate, callback) {
      IDBFS.getLocalSet(mount, (function(err, local) {
        if (err) return callback(err);
        IDBFS.getRemoteSet(mount, (function(err, remote) {
          if (err) return callback(err);
          var src = populate ? remote : local;
          var dst = populate ? local : remote;
          IDBFS.reconcile(src, dst, callback)
        }))
      }))
    }),
    getDB: (function(name, callback) {
      var db = IDBFS.dbs[name];
      if (db) {
        return callback(null, db)
      }
      var req;
      try {
        req = IDBFS.indexedDB().open(name, IDBFS.DB_VERSION)
      } catch (e) {
        return callback(e)
      }
      if (!req) {
        return callback("Unable to connect to IndexedDB")
      }
      req.onupgradeneeded = (function(e) {
        var db = e.target.result;
        var transaction = e.target.transaction;
        var fileStore;
        if (db.objectStoreNames.contains(IDBFS.DB_STORE_NAME)) {
          fileStore = transaction.objectStore(IDBFS.DB_STORE_NAME)
        } else {
          fileStore = db.createObjectStore(IDBFS.DB_STORE_NAME)
        }
        if (!fileStore.indexNames.contains("timestamp")) {
          fileStore.createIndex("timestamp", "timestamp", {
            unique: false
          })
        }
      });
      req.onsuccess = (function() {
        db = req.result;
        IDBFS.dbs[name] = db;
        callback(null, db)
      });
      req.onerror = (function(e) {
        callback(this.error);
        e.preventDefault()
      })
    }),
    getLocalSet: (function(mount, callback) {
      var entries = {};

      function isRealDir(p) {
        return p !== "." && p !== ".."
      }

      function toAbsolute(root) {
        return (function(p) {
          return PATH.join2(root, p)
        })
      }
      var check = FS.readdir(mount.mountpoint).filter(isRealDir).map(toAbsolute(mount.mountpoint));
      while (check.length) {
        var path = check.pop();
        var stat;
        try {
          stat = FS.stat(path)
        } catch (e) {
          return callback(e)
        }
        if (FS.isDir(stat.mode)) {
          check.push.apply(check, FS.readdir(path).filter(isRealDir).map(toAbsolute(path)))
        }
        entries[path] = {
          timestamp: stat.mtime
        }
      }
      return callback(null, {
        type: "local",
        entries: entries
      })
    }),
    getRemoteSet: (function(mount, callback) {
      var entries = {};
      IDBFS.getDB(mount.mountpoint, (function(err, db) {
        if (err) return callback(err);
        try {
          var transaction = db.transaction([IDBFS.DB_STORE_NAME], "readonly");
          transaction.onerror = (function(e) {
            callback(this.error);
            e.preventDefault()
          });
          var store = transaction.objectStore(IDBFS.DB_STORE_NAME);
          var index = store.index("timestamp");
          index.openKeyCursor().onsuccess = (function(event) {
            var cursor = event.target.result;
            if (!cursor) {
              return callback(null, {
                type: "remote",
                db: db,
                entries: entries
              })
            }
            entries[cursor.primaryKey] = {
              timestamp: cursor.key
            };
            cursor.continue()
          })
        } catch (e) {
          return callback(e)
        }
      }))
    }),
    loadLocalEntry: (function(path, callback) {
      var stat, node;
      try {
        var lookup = FS.lookupPath(path);
        node = lookup.node;
        stat = FS.stat(path)
      } catch (e) {
        return callback(e)
      }
      if (FS.isDir(stat.mode)) {
        return callback(null, {
          timestamp: stat.mtime,
          mode: stat.mode
        })
      } else if (FS.isFile(stat.mode)) {
        node.contents = MEMFS.getFileDataAsTypedArray(node);
        return callback(null, {
          timestamp: stat.mtime,
          mode: stat.mode,
          contents: node.contents
        })
      } else {
        return callback(new Error("node type not supported"))
      }
    }),
    storeLocalEntry: (function(path, entry, callback) {
      try {
        if (FS.isDir(entry.mode)) {
          FS.mkdir(path, entry.mode)
        } else if (FS.isFile(entry.mode)) {
          FS.writeFile(path, entry.contents, {
            canOwn: true
          })
        } else {
          return callback(new Error("node type not supported"))
        }
        FS.chmod(path, entry.mode);
        FS.utime(path, entry.timestamp, entry.timestamp)
      } catch (e) {
        return callback(e)
      }
      callback(null)
    }),
    removeLocalEntry: (function(path, callback) {
      try {
        var lookup = FS.lookupPath(path);
        var stat = FS.stat(path);
        if (FS.isDir(stat.mode)) {
          FS.rmdir(path)
        } else if (FS.isFile(stat.mode)) {
          FS.unlink(path)
        }
      } catch (e) {
        return callback(e)
      }
      callback(null)
    }),
    loadRemoteEntry: (function(store, path, callback) {
      var req = store.get(path);
      req.onsuccess = (function(event) {
        callback(null, event.target.result)
      });
      req.onerror = (function(e) {
        callback(this.error);
        e.preventDefault()
      })
    }),
    storeRemoteEntry: (function(store, path, entry, callback) {
      var req = store.put(entry, path);
      req.onsuccess = (function() {
        callback(null)
      });
      req.onerror = (function(e) {
        callback(this.error);
        e.preventDefault()
      })
    }),
    removeRemoteEntry: (function(store, path, callback) {
      var req = store.delete(path);
      req.onsuccess = (function() {
        callback(null)
      });
      req.onerror = (function(e) {
        callback(this.error);
        e.preventDefault()
      })
    }),
    reconcile: (function(src, dst, callback) {
      var total = 0;
      var create = [];
      Object.keys(src.entries).forEach((function(key) {
        var e = src.entries[key];
        var e2 = dst.entries[key];
        if (!e2 || e.timestamp > e2.timestamp) {
          create.push(key);
          total++
        }
      }));
      var remove = [];
      Object.keys(dst.entries).forEach((function(key) {
        var e = dst.entries[key];
        var e2 = src.entries[key];
        if (!e2) {
          remove.push(key);
          total++
        }
      }));
      if (!total) {
        return callback(null)
      }
      var completed = 0;
      var db = src.type === "remote" ? src.db : dst.db;
      var transaction = db.transaction([IDBFS.DB_STORE_NAME], "readwrite");
      var store = transaction.objectStore(IDBFS.DB_STORE_NAME);

      function done(err) {
        if (err) {
          if (!done.errored) {
            done.errored = true;
            return callback(err)
          }
          return
        }
        if (++completed >= total) {
          return callback(null)
        }
      }
      transaction.onerror = (function(e) {
        done(this.error);
        e.preventDefault()
      });
      create.sort().forEach((function(path) {
        if (dst.type === "local") {
          IDBFS.loadRemoteEntry(store, path, (function(err, entry) {
            if (err) return done(err);
            IDBFS.storeLocalEntry(path, entry, done)
          }))
        } else {
          IDBFS.loadLocalEntry(path, (function(err, entry) {
            if (err) return done(err);
            IDBFS.storeRemoteEntry(store, path, entry, done)
          }))
        }
      }));
      remove.sort().reverse().forEach((function(path) {
        if (dst.type === "local") {
          IDBFS.removeLocalEntry(path, done)
        } else {
          IDBFS.removeRemoteEntry(store, path, done)
        }
      }))
    })
  };
  var NODEFS = {
    isWindows: false,
    staticInit: (function() {
      NODEFS.isWindows = !!process.platform.match(/^win/);
      var flags = process["binding"]("constants");
      if (flags["fs"]) {
        flags = flags["fs"]
      }
      NODEFS.flagsForNodeMap = {
        "1024": flags["O_APPEND"],
        "64": flags["O_CREAT"],
        "128": flags["O_EXCL"],
        "0": flags["O_RDONLY"],
        "2": flags["O_RDWR"],
        "4096": flags["O_SYNC"],
        "512": flags["O_TRUNC"],
        "1": flags["O_WRONLY"]
      }
    }),
    bufferFrom: (function(arrayBuffer) {
      return Buffer.alloc ? Buffer.from(arrayBuffer) : new Buffer(arrayBuffer)
    }),
    mount: (function(mount) {
      assert(ENVIRONMENT_IS_NODE);
      return NODEFS.createNode(null, "/", NODEFS.getMode(mount.opts.root), 0)
    }),
    createNode: (function(parent, name, mode, dev) {
      if (!FS.isDir(mode) && !FS.isFile(mode) && !FS.isLink(mode)) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
      }
      var node = FS.createNode(parent, name, mode);
      node.node_ops = NODEFS.node_ops;
      node.stream_ops = NODEFS.stream_ops;
      return node
    }),
    getMode: (function(path) {
      var stat;
      try {
        stat = fs.lstatSync(path);
        if (NODEFS.isWindows) {
          stat.mode = stat.mode | (stat.mode & 292) >> 2
        }
      } catch (e) {
        if (!e.code) throw e;
        throw new FS.ErrnoError(ERRNO_CODES[e.code])
      }
      return stat.mode
    }),
    realPath: (function(node) {
      var parts = [];
      while (node.parent !== node) {
        parts.push(node.name);
        node = node.parent
      }
      parts.push(node.mount.opts.root);
      parts.reverse();
      return PATH.join.apply(null, parts)
    }),
    flagsForNode: (function(flags) {
      flags &= ~2097152;
      flags &= ~2048;
      flags &= ~32768;
      flags &= ~524288;
      var newFlags = 0;
      for (var k in NODEFS.flagsForNodeMap) {
        if (flags & k) {
          newFlags |= NODEFS.flagsForNodeMap[k];
          flags ^= k
        }
      }
      if (!flags) {
        return newFlags
      } else {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
      }
    }),
    node_ops: {
      getattr: (function(node) {
        var path = NODEFS.realPath(node);
        var stat;
        try {
          stat = fs.lstatSync(path)
        } catch (e) {
          if (!e.code) throw e;
          throw new FS.ErrnoError(ERRNO_CODES[e.code])
        }
        if (NODEFS.isWindows && !stat.blksize) {
          stat.blksize = 4096
        }
        if (NODEFS.isWindows && !stat.blocks) {
          stat.blocks = (stat.size + stat.blksize - 1) / stat.blksize | 0
        }
        return {
          dev: stat.dev,
          ino: stat.ino,
          mode: stat.mode,
          nlink: stat.nlink,
          uid: stat.uid,
          gid: stat.gid,
          rdev: stat.rdev,
          size: stat.size,
          atime: stat.atime,
          mtime: stat.mtime,
          ctime: stat.ctime,
          blksize: stat.blksize,
          blocks: stat.blocks
        }
      }),
      setattr: (function(node, attr) {
        var path = NODEFS.realPath(node);
        try {
          if (attr.mode !== undefined) {
            fs.chmodSync(path, attr.mode);
            node.mode = attr.mode
          }
          if (attr.timestamp !== undefined) {
            var date = new Date(attr.timestamp);
            fs.utimesSync(path, date, date)
          }
          if (attr.size !== undefined) {
            fs.truncateSync(path, attr.size)
          }
        } catch (e) {
          if (!e.code) throw e;
          throw new FS.ErrnoError(ERRNO_CODES[e.code])
        }
      }),
      lookup: (function(parent, name) {
        var path = PATH.join2(NODEFS.realPath(parent), name);
        var mode = NODEFS.getMode(path);
        return NODEFS.createNode(parent, name, mode)
      }),
      mknod: (function(parent, name, mode, dev) {
        var node = NODEFS.createNode(parent, name, mode, dev);
        var path = NODEFS.realPath(node);
        try {
          if (FS.isDir(node.mode)) {
            fs.mkdirSync(path, node.mode)
          } else {
            fs.writeFileSync(path, "", {
              mode: node.mode
            })
          }
        } catch (e) {
          if (!e.code) throw e;
          throw new FS.ErrnoError(ERRNO_CODES[e.code])
        }
        return node
      }),
      rename: (function(oldNode, newDir, newName) {
        var oldPath = NODEFS.realPath(oldNode);
        var newPath = PATH.join2(NODEFS.realPath(newDir), newName);
        try {
          fs.renameSync(oldPath, newPath)
        } catch (e) {
          if (!e.code) throw e;
          throw new FS.ErrnoError(ERRNO_CODES[e.code])
        }
      }),
      unlink: (function(parent, name) {
        var path = PATH.join2(NODEFS.realPath(parent), name);
        try {
          fs.unlinkSync(path)
        } catch (e) {
          if (!e.code) throw e;
          throw new FS.ErrnoError(ERRNO_CODES[e.code])
        }
      }),
      rmdir: (function(parent, name) {
        var path = PATH.join2(NODEFS.realPath(parent), name);
        try {
          fs.rmdirSync(path)
        } catch (e) {
          if (!e.code) throw e;
          throw new FS.ErrnoError(ERRNO_CODES[e.code])
        }
      }),
      readdir: (function(node) {
        var path = NODEFS.realPath(node);
        try {
          return fs.readdirSync(path)
        } catch (e) {
          if (!e.code) throw e;
          throw new FS.ErrnoError(ERRNO_CODES[e.code])
        }
      }),
      symlink: (function(parent, newName, oldPath) {
        var newPath = PATH.join2(NODEFS.realPath(parent), newName);
        try {
          fs.symlinkSync(oldPath, newPath)
        } catch (e) {
          if (!e.code) throw e;
          throw new FS.ErrnoError(ERRNO_CODES[e.code])
        }
      }),
      readlink: (function(node) {
        var path = NODEFS.realPath(node);
        try {
          path = fs.readlinkSync(path);
          path = NODEJS_PATH.relative(NODEJS_PATH.resolve(node.mount.opts.root), path);
          return path
        } catch (e) {
          if (!e.code) throw e;
          throw new FS.ErrnoError(ERRNO_CODES[e.code])
        }
      })
    },
    stream_ops: {
      open: (function(stream) {
        var path = NODEFS.realPath(stream.node);
        try {
          if (FS.isFile(stream.node.mode)) {
            stream.nfd = fs.openSync(path, NODEFS.flagsForNode(stream.flags))
          }
        } catch (e) {
          if (!e.code) throw e;
          throw new FS.ErrnoError(ERRNO_CODES[e.code])
        }
      }),
      close: (function(stream) {
        try {
          if (FS.isFile(stream.node.mode) && stream.nfd) {
            fs.closeSync(stream.nfd)
          }
        } catch (e) {
          if (!e.code) throw e;
          throw new FS.ErrnoError(ERRNO_CODES[e.code])
        }
      }),
      read: (function(stream, buffer, offset, length, position) {
        if (length === 0) return 0;
        try {
          return fs.readSync(stream.nfd, NODEFS.bufferFrom(buffer.buffer), offset, length, position)
        } catch (e) {
          throw new FS.ErrnoError(ERRNO_CODES[e.code])
        }
      }),
      write: (function(stream, buffer, offset, length, position) {
        try {
          return fs.writeSync(stream.nfd, NODEFS.bufferFrom(buffer.buffer), offset, length, position)
        } catch (e) {
          throw new FS.ErrnoError(ERRNO_CODES[e.code])
        }
      }),
      llseek: (function(stream, offset, whence) {
        var position = offset;
        if (whence === 1) {
          position += stream.position
        } else if (whence === 2) {
          if (FS.isFile(stream.node.mode)) {
            try {
              var stat = fs.fstatSync(stream.nfd);
              position += stat.size
            } catch (e) {
              throw new FS.ErrnoError(ERRNO_CODES[e.code])
            }
          }
        }
        if (position < 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
        }
        return position
      })
    }
  };
  var WORKERFS = {
    DIR_MODE: 16895,
    FILE_MODE: 33279,
    reader: null,
    mount: (function(mount) {
      assert(ENVIRONMENT_IS_WORKER);
      if (!WORKERFS.reader) WORKERFS.reader = new FileReaderSync;
      var root = WORKERFS.createNode(null, "/", WORKERFS.DIR_MODE, 0);
      var createdParents = {};

      function ensureParent(path) {
        var parts = path.split("/");
        var parent = root;
        for (var i = 0; i < parts.length - 1; i++) {
          var curr = parts.slice(0, i + 1).join("/");
          if (!createdParents[curr]) {
            createdParents[curr] = WORKERFS.createNode(parent, parts[i], WORKERFS.DIR_MODE, 0)
          }
          parent = createdParents[curr]
        }
        return parent
      }

      function base(path) {
        var parts = path.split("/");
        return parts[parts.length - 1]
      }
      Array.prototype.forEach.call(mount.opts["files"] || [], (function(file) {
        WORKERFS.createNode(ensureParent(file.name), base(file.name), WORKERFS.FILE_MODE, 0, file, file.lastModifiedDate)
      }));
      (mount.opts["blobs"] || []).forEach((function(obj) {
        WORKERFS.createNode(ensureParent(obj["name"]), base(obj["name"]), WORKERFS.FILE_MODE, 0, obj["data"])
      }));
      (mount.opts["packages"] || []).forEach((function(pack) {
        pack["metadata"].files.forEach((function(file) {
          var name = file.filename.substr(1);
          WORKERFS.createNode(ensureParent(name), base(name), WORKERFS.FILE_MODE, 0, pack["blob"].slice(file.start, file.end))
        }))
      }));
      return root
    }),
    createNode: (function(parent, name, mode, dev, contents, mtime) {
      var node = FS.createNode(parent, name, mode);
      node.mode = mode;
      node.node_ops = WORKERFS.node_ops;
      node.stream_ops = WORKERFS.stream_ops;
      node.timestamp = (mtime || new Date).getTime();
      assert(WORKERFS.FILE_MODE !== WORKERFS.DIR_MODE);
      if (mode === WORKERFS.FILE_MODE) {
        node.size = contents.size;
        node.contents = contents
      } else {
        node.size = 4096;
        node.contents = {}
      }
      if (parent) {
        parent.contents[name] = node
      }
      return node
    }),
    node_ops: {
      getattr: (function(node) {
        return {
          dev: 1,
          ino: undefined,
          mode: node.mode,
          nlink: 1,
          uid: 0,
          gid: 0,
          rdev: undefined,
          size: node.size,
          atime: new Date(node.timestamp),
          mtime: new Date(node.timestamp),
          ctime: new Date(node.timestamp),
          blksize: 4096,
          blocks: Math.ceil(node.size / 4096)
        }
      }),
      setattr: (function(node, attr) {
        if (attr.mode !== undefined) {
          node.mode = attr.mode
        }
        if (attr.timestamp !== undefined) {
          node.timestamp = attr.timestamp
        }
      }),
      lookup: (function(parent, name) {
        throw new FS.ErrnoError(ERRNO_CODES.ENOENT)
      }),
      mknod: (function(parent, name, mode, dev) {
        throw new FS.ErrnoError(ERRNO_CODES.EPERM)
      }),
      rename: (function(oldNode, newDir, newName) {
        throw new FS.ErrnoError(ERRNO_CODES.EPERM)
      }),
      unlink: (function(parent, name) {
        throw new FS.ErrnoError(ERRNO_CODES.EPERM)
      }),
      rmdir: (function(parent, name) {
        throw new FS.ErrnoError(ERRNO_CODES.EPERM)
      }),
      readdir: (function(node) {
        var entries = [".", ".."];
        for (var key in node.contents) {
          if (!node.contents.hasOwnProperty(key)) {
            continue
          }
          entries.push(key)
        }
        return entries
      }),
      symlink: (function(parent, newName, oldPath) {
        throw new FS.ErrnoError(ERRNO_CODES.EPERM)
      }),
      readlink: (function(node) {
        throw new FS.ErrnoError(ERRNO_CODES.EPERM)
      })
    },
    stream_ops: {
      read: (function(stream, buffer, offset, length, position) {
        if (position >= stream.node.size) return 0;
        var chunk = stream.node.contents.slice(position, position + length);
        var ab = WORKERFS.reader.readAsArrayBuffer(chunk);
        buffer.set(new Uint8Array(ab), offset);
        return chunk.size
      }),
      write: (function(stream, buffer, offset, length, position) {
        throw new FS.ErrnoError(ERRNO_CODES.EIO)
      }),
      llseek: (function(stream, offset, whence) {
        var position = offset;
        if (whence === 1) {
          position += stream.position
        } else if (whence === 2) {
          if (FS.isFile(stream.node.mode)) {
            position += stream.node.size
          }
        }
        if (position < 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
        }
        return position
      })
    }
  };
  STATICTOP += 16;
  STATICTOP += 16;
  STATICTOP += 16;
  var FS = {
    root: null,
    mounts: [],
    devices: {},
    streams: [],
    nextInode: 1,
    nameTable: null,
    currentPath: "/",
    initialized: false,
    ignorePermissions: true,
    trackingDelegate: {},
    tracking: {
      openFlags: {
        READ: 1,
        WRITE: 2
      }
    },
    ErrnoError: null,
    genericErrors: {},
    filesystems: null,
    syncFSRequests: 0,
    handleFSError: (function(e) {
      if (!(e instanceof FS.ErrnoError)) throw e + " : " + stackTrace();
      return ___setErrNo(e.errno)
    }),
    lookupPath: (function(path, opts) {
      path = PATH.resolve(FS.cwd(), path);
      opts = opts || {};
      if (!path) return {
        path: "",
        node: null
      };
      var defaults = {
        follow_mount: true,
        recurse_count: 0
      };
      for (var key in defaults) {
        if (opts[key] === undefined) {
          opts[key] = defaults[key]
        }
      }
      if (opts.recurse_count > 8) {
        throw new FS.ErrnoError(ERRNO_CODES.ELOOP)
      }
      var parts = PATH.normalizeArray(path.split("/").filter((function(p) {
        return !!p
      })), false);
      var current = FS.root;
      var current_path = "/";
      for (var i = 0; i < parts.length; i++) {
        var islast = i === parts.length - 1;
        if (islast && opts.parent) {
          break
        }
        current = FS.lookupNode(current, parts[i]);
        current_path = PATH.join2(current_path, parts[i]);
        if (FS.isMountpoint(current)) {
          if (!islast || islast && opts.follow_mount) {
            current = current.mounted.root
          }
        }
        if (!islast || opts.follow) {
          var count = 0;
          while (FS.isLink(current.mode)) {
            var link = FS.readlink(current_path);
            current_path = PATH.resolve(PATH.dirname(current_path), link);
            var lookup = FS.lookupPath(current_path, {
              recurse_count: opts.recurse_count
            });
            current = lookup.node;
            if (count++ > 40) {
              throw new FS.ErrnoError(ERRNO_CODES.ELOOP)
            }
          }
        }
      }
      return {
        path: current_path,
        node: current
      }
    }),
    getPath: (function(node) {
      var path;
      while (true) {
        if (FS.isRoot(node)) {
          var mount = node.mount.mountpoint;
          if (!path) return mount;
          return mount[mount.length - 1] !== "/" ? mount + "/" + path : mount + path
        }
        path = path ? node.name + "/" + path : node.name;
        node = node.parent
      }
    }),
    hashName: (function(parentid, name) {
      var hash = 0;
      for (var i = 0; i < name.length; i++) {
        hash = (hash << 5) - hash + name.charCodeAt(i) | 0
      }
      return (parentid + hash >>> 0) % FS.nameTable.length
    }),
    hashAddNode: (function(node) {
      var hash = FS.hashName(node.parent.id, node.name);
      node.name_next = FS.nameTable[hash];
      FS.nameTable[hash] = node
    }),
    hashRemoveNode: (function(node) {
      var hash = FS.hashName(node.parent.id, node.name);
      if (FS.nameTable[hash] === node) {
        FS.nameTable[hash] = node.name_next
      } else {
        var current = FS.nameTable[hash];
        while (current) {
          if (current.name_next === node) {
            current.name_next = node.name_next;
            break
          }
          current = current.name_next
        }
      }
    }),
    lookupNode: (function(parent, name) {
      var err = FS.mayLookup(parent);
      if (err) {
        throw new FS.ErrnoError(err, parent)
      }
      var hash = FS.hashName(parent.id, name);
      for (var node = FS.nameTable[hash]; node; node = node.name_next) {
        var nodeName = node.name;
        if (node.parent.id === parent.id && nodeName === name) {
          return node
        }
      }
      return FS.lookup(parent, name)
    }),
    createNode: (function(parent, name, mode, rdev) {
      if (!FS.FSNode) {
        FS.FSNode = (function(parent, name, mode, rdev) {
          if (!parent) {
            parent = this
          }
          this.parent = parent;
          this.mount = parent.mount;
          this.mounted = null;
          this.id = FS.nextInode++;
          this.name = name;
          this.mode = mode;
          this.node_ops = {};
          this.stream_ops = {};
          this.rdev = rdev
        });
        FS.FSNode.prototype = {};
        var readMode = 292 | 73;
        var writeMode = 146;
        Object.defineProperties(FS.FSNode.prototype, {
          read: {
            get: (function() {
              return (this.mode & readMode) === readMode
            }),
            set: (function(val) {
              val ? this.mode |= readMode : this.mode &= ~readMode
            })
          },
          write: {
            get: (function() {
              return (this.mode & writeMode) === writeMode
            }),
            set: (function(val) {
              val ? this.mode |= writeMode : this.mode &= ~writeMode
            })
          },
          isFolder: {
            get: (function() {
              return FS.isDir(this.mode)
            })
          },
          isDevice: {
            get: (function() {
              return FS.isChrdev(this.mode)
            })
          }
        })
      }
      var node = new FS.FSNode(parent, name, mode, rdev);
      FS.hashAddNode(node);
      return node
    }),
    destroyNode: (function(node) {
      FS.hashRemoveNode(node)
    }),
    isRoot: (function(node) {
      return node === node.parent
    }),
    isMountpoint: (function(node) {
      return !!node.mounted
    }),
    isFile: (function(mode) {
      return (mode & 61440) === 32768
    }),
    isDir: (function(mode) {
      return (mode & 61440) === 16384
    }),
    isLink: (function(mode) {
      return (mode & 61440) === 40960
    }),
    isChrdev: (function(mode) {
      return (mode & 61440) === 8192
    }),
    isBlkdev: (function(mode) {
      return (mode & 61440) === 24576
    }),
    isFIFO: (function(mode) {
      return (mode & 61440) === 4096
    }),
    isSocket: (function(mode) {
      return (mode & 49152) === 49152
    }),
    flagModes: {
      "r": 0,
      "rs": 1052672,
      "r+": 2,
      "w": 577,
      "wx": 705,
      "xw": 705,
      "w+": 578,
      "wx+": 706,
      "xw+": 706,
      "a": 1089,
      "ax": 1217,
      "xa": 1217,
      "a+": 1090,
      "ax+": 1218,
      "xa+": 1218
    },
    modeStringToFlags: (function(str) {
      var flags = FS.flagModes[str];
      if (typeof flags === "undefined") {
        throw new Error("Unknown file open mode: " + str)
      }
      return flags
    }),
    flagsToPermissionString: (function(flag) {
      var perms = ["r", "w", "rw"][flag & 3];
      if (flag & 512) {
        perms += "w"
      }
      return perms
    }),
    nodePermissions: (function(node, perms) {
      if (FS.ignorePermissions) {
        return 0
      }
      if (perms.indexOf("r") !== -1 && !(node.mode & 292)) {
        return ERRNO_CODES.EACCES
      } else if (perms.indexOf("w") !== -1 && !(node.mode & 146)) {
        return ERRNO_CODES.EACCES
      } else if (perms.indexOf("x") !== -1 && !(node.mode & 73)) {
        return ERRNO_CODES.EACCES
      }
      return 0
    }),
    mayLookup: (function(dir) {
      var err = FS.nodePermissions(dir, "x");
      if (err) return err;
      if (!dir.node_ops.lookup) return ERRNO_CODES.EACCES;
      return 0
    }),
    mayCreate: (function(dir, name) {
      try {
        var node = FS.lookupNode(dir, name);
        return ERRNO_CODES.EEXIST
      } catch (e) {}
      return FS.nodePermissions(dir, "wx")
    }),
    mayDelete: (function(dir, name, isdir) {
      var node;
      try {
        node = FS.lookupNode(dir, name)
      } catch (e) {
        return e.errno
      }
      var err = FS.nodePermissions(dir, "wx");
      if (err) {
        return err
      }
      if (isdir) {
        if (!FS.isDir(node.mode)) {
          return ERRNO_CODES.ENOTDIR
        }
        if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
          return ERRNO_CODES.EBUSY
        }
      } else {
        if (FS.isDir(node.mode)) {
          return ERRNO_CODES.EISDIR
        }
      }
      return 0
    }),
    mayOpen: (function(node, flags) {
      if (!node) {
        return ERRNO_CODES.ENOENT
      }
      if (FS.isLink(node.mode)) {
        return ERRNO_CODES.ELOOP
      } else if (FS.isDir(node.mode)) {
        if (FS.flagsToPermissionString(flags) !== "r" || flags & 512) {
          return ERRNO_CODES.EISDIR
        }
      }
      return FS.nodePermissions(node, FS.flagsToPermissionString(flags))
    }),
    MAX_OPEN_FDS: 4096,
    nextfd: (function(fd_start, fd_end) {
      fd_start = fd_start || 0;
      fd_end = fd_end || FS.MAX_OPEN_FDS;
      for (var fd = fd_start; fd <= fd_end; fd++) {
        if (!FS.streams[fd]) {
          return fd
        }
      }
      throw new FS.ErrnoError(ERRNO_CODES.EMFILE)
    }),
    getStream: (function(fd) {
      return FS.streams[fd]
    }),
    createStream: (function(stream, fd_start, fd_end) {
      if (!FS.FSStream) {
        FS.FSStream = (function() {});
        FS.FSStream.prototype = {};
        Object.defineProperties(FS.FSStream.prototype, {
          object: {
            get: (function() {
              return this.node
            }),
            set: (function(val) {
              this.node = val
            })
          },
          isRead: {
            get: (function() {
              return (this.flags & 2097155) !== 1
            })
          },
          isWrite: {
            get: (function() {
              return (this.flags & 2097155) !== 0
            })
          },
          isAppend: {
            get: (function() {
              return this.flags & 1024
            })
          }
        })
      }
      var newStream = new FS.FSStream;
      for (var p in stream) {
        newStream[p] = stream[p]
      }
      stream = newStream;
      var fd = FS.nextfd(fd_start, fd_end);
      stream.fd = fd;
      FS.streams[fd] = stream;
      return stream
    }),
    closeStream: (function(fd) {
      FS.streams[fd] = null
    }),
    chrdev_stream_ops: {
      open: (function(stream) {
        var device = FS.getDevice(stream.node.rdev);
        stream.stream_ops = device.stream_ops;
        if (stream.stream_ops.open) {
          stream.stream_ops.open(stream)
        }
      }),
      llseek: (function() {
        throw new FS.ErrnoError(ERRNO_CODES.ESPIPE)
      })
    },
    major: (function(dev) {
      return dev >> 8
    }),
    minor: (function(dev) {
      return dev & 255
    }),
    makedev: (function(ma, mi) {
      return ma << 8 | mi
    }),
    registerDevice: (function(dev, ops) {
      FS.devices[dev] = {
        stream_ops: ops
      }
    }),
    getDevice: (function(dev) {
      return FS.devices[dev]
    }),
    getMounts: (function(mount) {
      var mounts = [];
      var check = [mount];
      while (check.length) {
        var m = check.pop();
        mounts.push(m);
        check.push.apply(check, m.mounts)
      }
      return mounts
    }),
    syncfs: (function(populate, callback) {
      if (typeof populate === "function") {
        callback = populate;
        populate = false
      }
      FS.syncFSRequests++;
      if (FS.syncFSRequests > 1) {
        console.log("warning: " + FS.syncFSRequests + " FS.syncfs operations in flight at once, probably just doing extra work")
      }
      var mounts = FS.getMounts(FS.root.mount);
      var completed = 0;

      function doCallback(err) {
        assert(FS.syncFSRequests > 0);
        FS.syncFSRequests--;
        return callback(err)
      }

      function done(err) {
        if (err) {
          if (!done.errored) {
            done.errored = true;
            return doCallback(err)
          }
          return
        }
        if (++completed >= mounts.length) {
          doCallback(null)
        }
      }
      mounts.forEach((function(mount) {
        if (!mount.type.syncfs) {
          return done(null)
        }
        mount.type.syncfs(mount, populate, done)
      }))
    }),
    mount: (function(type, opts, mountpoint) {
      var root = mountpoint === "/";
      var pseudo = !mountpoint;
      var node;
      if (root && FS.root) {
        throw new FS.ErrnoError(ERRNO_CODES.EBUSY)
      } else if (!root && !pseudo) {
        var lookup = FS.lookupPath(mountpoint, {
          follow_mount: false
        });
        mountpoint = lookup.path;
        node = lookup.node;
        if (FS.isMountpoint(node)) {
          throw new FS.ErrnoError(ERRNO_CODES.EBUSY)
        }
        if (!FS.isDir(node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR)
        }
      }
      var mount = {
        type: type,
        opts: opts,
        mountpoint: mountpoint,
        mounts: []
      };
      var mountRoot = type.mount(mount);
      mountRoot.mount = mount;
      mount.root = mountRoot;
      if (root) {
        FS.root = mountRoot
      } else if (node) {
        node.mounted = mount;
        if (node.mount) {
          node.mount.mounts.push(mount)
        }
      }
      return mountRoot
    }),
    unmount: (function(mountpoint) {
      var lookup = FS.lookupPath(mountpoint, {
        follow_mount: false
      });
      if (!FS.isMountpoint(lookup.node)) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
      }
      var node = lookup.node;
      var mount = node.mounted;
      var mounts = FS.getMounts(mount);
      Object.keys(FS.nameTable).forEach((function(hash) {
        var current = FS.nameTable[hash];
        while (current) {
          var next = current.name_next;
          if (mounts.indexOf(current.mount) !== -1) {
            FS.destroyNode(current)
          }
          current = next
        }
      }));
      node.mounted = null;
      var idx = node.mount.mounts.indexOf(mount);
      assert(idx !== -1);
      node.mount.mounts.splice(idx, 1)
    }),
    lookup: (function(parent, name) {
      return parent.node_ops.lookup(parent, name)
    }),
    mknod: (function(path, mode, dev) {
      var lookup = FS.lookupPath(path, {
        parent: true
      });
      var parent = lookup.node;
      var name = PATH.basename(path);
      if (!name || name === "." || name === "..") {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
      }
      var err = FS.mayCreate(parent, name);
      if (err) {
        throw new FS.ErrnoError(err)
      }
      if (!parent.node_ops.mknod) {
        throw new FS.ErrnoError(ERRNO_CODES.EPERM)
      }
      return parent.node_ops.mknod(parent, name, mode, dev)
    }),
    create: (function(path, mode) {
      mode = mode !== undefined ? mode : 438;
      mode &= 4095;
      mode |= 32768;
      return FS.mknod(path, mode, 0)
    }),
    mkdir: (function(path, mode) {
      mode = mode !== undefined ? mode : 511;
      mode &= 511 | 512;
      mode |= 16384;
      return FS.mknod(path, mode, 0)
    }),
    mkdirTree: (function(path, mode) {
      var dirs = path.split("/");
      var d = "";
      for (var i = 0; i < dirs.length; ++i) {
        if (!dirs[i]) continue;
        d += "/" + dirs[i];
        try {
          FS.mkdir(d, mode)
        } catch (e) {
          if (e.errno != ERRNO_CODES.EEXIST) throw e
        }
      }
    }),
    mkdev: (function(path, mode, dev) {
      if (typeof dev === "undefined") {
        dev = mode;
        mode = 438
      }
      mode |= 8192;
      return FS.mknod(path, mode, dev)
    }),
    symlink: (function(oldpath, newpath) {
      if (!PATH.resolve(oldpath)) {
        throw new FS.ErrnoError(ERRNO_CODES.ENOENT)
      }
      var lookup = FS.lookupPath(newpath, {
        parent: true
      });
      var parent = lookup.node;
      if (!parent) {
        throw new FS.ErrnoError(ERRNO_CODES.ENOENT)
      }
      var newname = PATH.basename(newpath);
      var err = FS.mayCreate(parent, newname);
      if (err) {
        throw new FS.ErrnoError(err)
      }
      if (!parent.node_ops.symlink) {
        throw new FS.ErrnoError(ERRNO_CODES.EPERM)
      }
      return parent.node_ops.symlink(parent, newname, oldpath)
    }),
    rename: (function(old_path, new_path) {
      var old_dirname = PATH.dirname(old_path);
      var new_dirname = PATH.dirname(new_path);
      var old_name = PATH.basename(old_path);
      var new_name = PATH.basename(new_path);
      var lookup, old_dir, new_dir;
      try {
        lookup = FS.lookupPath(old_path, {
          parent: true
        });
        old_dir = lookup.node;
        lookup = FS.lookupPath(new_path, {
          parent: true
        });
        new_dir = lookup.node
      } catch (e) {
        throw new FS.ErrnoError(ERRNO_CODES.EBUSY)
      }
      if (!old_dir || !new_dir) throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
      if (old_dir.mount !== new_dir.mount) {
        throw new FS.ErrnoError(ERRNO_CODES.EXDEV)
      }
      var old_node = FS.lookupNode(old_dir, old_name);
      var relative = PATH.relative(old_path, new_dirname);
      if (relative.charAt(0) !== ".") {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
      }
      relative = PATH.relative(new_path, old_dirname);
      if (relative.charAt(0) !== ".") {
        throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY)
      }
      var new_node;
      try {
        new_node = FS.lookupNode(new_dir, new_name)
      } catch (e) {}
      if (old_node === new_node) {
        return
      }
      var isdir = FS.isDir(old_node.mode);
      var err = FS.mayDelete(old_dir, old_name, isdir);
      if (err) {
        throw new FS.ErrnoError(err)
      }
      err = new_node ? FS.mayDelete(new_dir, new_name, isdir) : FS.mayCreate(new_dir, new_name);
      if (err) {
        throw new FS.ErrnoError(err)
      }
      if (!old_dir.node_ops.rename) {
        throw new FS.ErrnoError(ERRNO_CODES.EPERM)
      }
      if (FS.isMountpoint(old_node) || new_node && FS.isMountpoint(new_node)) {
        throw new FS.ErrnoError(ERRNO_CODES.EBUSY)
      }
      if (new_dir !== old_dir) {
        err = FS.nodePermissions(old_dir, "w");
        if (err) {
          throw new FS.ErrnoError(err)
        }
      }
      try {
        if (FS.trackingDelegate["willMovePath"]) {
          FS.trackingDelegate["willMovePath"](old_path, new_path)
        }
      } catch (e) {
        console.log("FS.trackingDelegate['willMovePath']('" + old_path + "', '" + new_path + "') threw an exception: " + e.message)
      }
      FS.hashRemoveNode(old_node);
      try {
        old_dir.node_ops.rename(old_node, new_dir, new_name)
      } catch (e) {
        throw e
      } finally {
        FS.hashAddNode(old_node)
      }
      try {
        if (FS.trackingDelegate["onMovePath"]) FS.trackingDelegate["onMovePath"](old_path, new_path)
      } catch (e) {
        console.log("FS.trackingDelegate['onMovePath']('" + old_path + "', '" + new_path + "') threw an exception: " + e.message)
      }
    }),
    rmdir: (function(path) {
      var lookup = FS.lookupPath(path, {
        parent: true
      });
      var parent = lookup.node;
      var name = PATH.basename(path);
      var node = FS.lookupNode(parent, name);
      var err = FS.mayDelete(parent, name, true);
      if (err) {
        throw new FS.ErrnoError(err)
      }
      if (!parent.node_ops.rmdir) {
        throw new FS.ErrnoError(ERRNO_CODES.EPERM)
      }
      if (FS.isMountpoint(node)) {
        throw new FS.ErrnoError(ERRNO_CODES.EBUSY)
      }
      try {
        if (FS.trackingDelegate["willDeletePath"]) {
          FS.trackingDelegate["willDeletePath"](path)
        }
      } catch (e) {
        console.log("FS.trackingDelegate['willDeletePath']('" + path + "') threw an exception: " + e.message)
      }
      parent.node_ops.rmdir(parent, name);
      FS.destroyNode(node);
      try {
        if (FS.trackingDelegate["onDeletePath"]) FS.trackingDelegate["onDeletePath"](path)
      } catch (e) {
        console.log("FS.trackingDelegate['onDeletePath']('" + path + "') threw an exception: " + e.message)
      }
    }),
    readdir: (function(path) {
      var lookup = FS.lookupPath(path, {
        follow: true
      });
      var node = lookup.node;
      if (!node.node_ops.readdir) {
        throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR)
      }
      return node.node_ops.readdir(node)
    }),
    unlink: (function(path) {
      var lookup = FS.lookupPath(path, {
        parent: true
      });
      var parent = lookup.node;
      var name = PATH.basename(path);
      var node = FS.lookupNode(parent, name);
      var err = FS.mayDelete(parent, name, false);
      if (err) {
        throw new FS.ErrnoError(err)
      }
      if (!parent.node_ops.unlink) {
        throw new FS.ErrnoError(ERRNO_CODES.EPERM)
      }
      if (FS.isMountpoint(node)) {
        throw new FS.ErrnoError(ERRNO_CODES.EBUSY)
      }
      try {
        if (FS.trackingDelegate["willDeletePath"]) {
          FS.trackingDelegate["willDeletePath"](path)
        }
      } catch (e) {
        console.log("FS.trackingDelegate['willDeletePath']('" + path + "') threw an exception: " + e.message)
      }
      parent.node_ops.unlink(parent, name);
      FS.destroyNode(node);
      try {
        if (FS.trackingDelegate["onDeletePath"]) FS.trackingDelegate["onDeletePath"](path)
      } catch (e) {
        console.log("FS.trackingDelegate['onDeletePath']('" + path + "') threw an exception: " + e.message)
      }
    }),
    readlink: (function(path) {
      var lookup = FS.lookupPath(path);
      var link = lookup.node;
      if (!link) {
        throw new FS.ErrnoError(ERRNO_CODES.ENOENT)
      }
      if (!link.node_ops.readlink) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
      }
      return PATH.resolve(FS.getPath(link.parent), link.node_ops.readlink(link))
    }),
    stat: (function(path, dontFollow) {
      var lookup = FS.lookupPath(path, {
        follow: !dontFollow
      });
      var node = lookup.node;
      if (!node) {
        throw new FS.ErrnoError(ERRNO_CODES.ENOENT)
      }
      if (!node.node_ops.getattr) {
        throw new FS.ErrnoError(ERRNO_CODES.EPERM)
      }
      return node.node_ops.getattr(node)
    }),
    lstat: (function(path) {
      return FS.stat(path, true)
    }),
    chmod: (function(path, mode, dontFollow) {
      var node;
      if (typeof path === "string") {
        var lookup = FS.lookupPath(path, {
          follow: !dontFollow
        });
        node = lookup.node
      } else {
        node = path
      }
      if (!node.node_ops.setattr) {
        throw new FS.ErrnoError(ERRNO_CODES.EPERM)
      }
      node.node_ops.setattr(node, {
        mode: mode & 4095 | node.mode & ~4095,
        timestamp: Date.now()
      })
    }),
    lchmod: (function(path, mode) {
      FS.chmod(path, mode, true)
    }),
    fchmod: (function(fd, mode) {
      var stream = FS.getStream(fd);
      if (!stream) {
        throw new FS.ErrnoError(ERRNO_CODES.EBADF)
      }
      FS.chmod(stream.node, mode)
    }),
    chown: (function(path, uid, gid, dontFollow) {
      var node;
      if (typeof path === "string") {
        var lookup = FS.lookupPath(path, {
          follow: !dontFollow
        });
        node = lookup.node
      } else {
        node = path
      }
      if (!node.node_ops.setattr) {
        throw new FS.ErrnoError(ERRNO_CODES.EPERM)
      }
      node.node_ops.setattr(node, {
        timestamp: Date.now()
      })
    }),
    lchown: (function(path, uid, gid) {
      FS.chown(path, uid, gid, true)
    }),
    fchown: (function(fd, uid, gid) {
      var stream = FS.getStream(fd);
      if (!stream) {
        throw new FS.ErrnoError(ERRNO_CODES.EBADF)
      }
      FS.chown(stream.node, uid, gid)
    }),
    truncate: (function(path, len) {
      if (len < 0) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
      }
      var node;
      if (typeof path === "string") {
        var lookup = FS.lookupPath(path, {
          follow: true
        });
        node = lookup.node
      } else {
        node = path
      }
      if (!node.node_ops.setattr) {
        throw new FS.ErrnoError(ERRNO_CODES.EPERM)
      }
      if (FS.isDir(node.mode)) {
        throw new FS.ErrnoError(ERRNO_CODES.EISDIR)
      }
      if (!FS.isFile(node.mode)) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
      }
      var err = FS.nodePermissions(node, "w");
      if (err) {
        throw new FS.ErrnoError(err)
      }
      node.node_ops.setattr(node, {
        size: len,
        timestamp: Date.now()
      })
    }),
    ftruncate: (function(fd, len) {
      var stream = FS.getStream(fd);
      if (!stream) {
        throw new FS.ErrnoError(ERRNO_CODES.EBADF)
      }
      if ((stream.flags & 2097155) === 0) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
      }
      FS.truncate(stream.node, len)
    }),
    utime: (function(path, atime, mtime) {
      var lookup = FS.lookupPath(path, {
        follow: true
      });
      var node = lookup.node;
      node.node_ops.setattr(node, {
        timestamp: Math.max(atime, mtime)
      })
    }),
    open: (function(path, flags, mode, fd_start, fd_end) {
      if (path === "") {
        throw new FS.ErrnoError(ERRNO_CODES.ENOENT)
      }
      flags = typeof flags === "string" ? FS.modeStringToFlags(flags) : flags;
      mode = typeof mode === "undefined" ? 438 : mode;
      if (flags & 64) {
        mode = mode & 4095 | 32768
      } else {
        mode = 0
      }
      var node;
      if (typeof path === "object") {
        node = path
      } else {
        path = PATH.normalize(path);
        try {
          var lookup = FS.lookupPath(path, {
            follow: !(flags & 131072)
          });
          node = lookup.node
        } catch (e) {}
      }
      var created = false;
      if (flags & 64) {
        if (node) {
          if (flags & 128) {
            throw new FS.ErrnoError(ERRNO_CODES.EEXIST)
          }
        } else {
          node = FS.mknod(path, mode, 0);
          created = true
        }
      }
      if (!node) {
        throw new FS.ErrnoError(ERRNO_CODES.ENOENT)
      }
      if (FS.isChrdev(node.mode)) {
        flags &= ~512
      }
      if (flags & 65536 && !FS.isDir(node.mode)) {
        throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR)
      }
      if (!created) {
        var err = FS.mayOpen(node, flags);
        if (err) {
          throw new FS.ErrnoError(err)
        }
      }
      if (flags & 512) {
        FS.truncate(node, 0)
      }
      flags &= ~(128 | 512);
      var stream = FS.createStream({
        node: node,
        path: FS.getPath(node),
        flags: flags,
        seekable: true,
        position: 0,
        stream_ops: node.stream_ops,
        ungotten: [],
        error: false
      }, fd_start, fd_end);
      if (stream.stream_ops.open) {
        stream.stream_ops.open(stream)
      }
      if (Module["logReadFiles"] && !(flags & 1)) {
        if (!FS.readFiles) FS.readFiles = {};
        if (!(path in FS.readFiles)) {
          FS.readFiles[path] = 1;
          Module["printErr"]("read file: " + path)
        }
      }
      try {
        if (FS.trackingDelegate["onOpenFile"]) {
          var trackingFlags = 0;
          if ((flags & 2097155) !== 1) {
            trackingFlags |= FS.tracking.openFlags.READ
          }
          if ((flags & 2097155) !== 0) {
            trackingFlags |= FS.tracking.openFlags.WRITE
          }
          FS.trackingDelegate["onOpenFile"](path, trackingFlags)
        }
      } catch (e) {
        console.log("FS.trackingDelegate['onOpenFile']('" + path + "', flags) threw an exception: " + e.message)
      }
      return stream
    }),
    close: (function(stream) {
      if (stream.getdents) stream.getdents = null;
      try {
        if (stream.stream_ops.close) {
          stream.stream_ops.close(stream)
        }
      } catch (e) {
        throw e
      } finally {
        FS.closeStream(stream.fd)
      }
    }),
    llseek: (function(stream, offset, whence) {
      if (!stream.seekable || !stream.stream_ops.llseek) {
        throw new FS.ErrnoError(ERRNO_CODES.ESPIPE)
      }
      stream.position = stream.stream_ops.llseek(stream, offset, whence);
      stream.ungotten = [];
      return stream.position
    }),
    read: (function(stream, buffer, offset, length, position) {
      if (length < 0 || position < 0) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
      }
      if ((stream.flags & 2097155) === 1) {
        throw new FS.ErrnoError(ERRNO_CODES.EBADF)
      }
      if (FS.isDir(stream.node.mode)) {
        throw new FS.ErrnoError(ERRNO_CODES.EISDIR)
      }
      if (!stream.stream_ops.read) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
      }
      var seeking = typeof position !== "undefined";
      if (!seeking) {
        position = stream.position
      } else if (!stream.seekable) {
        throw new FS.ErrnoError(ERRNO_CODES.ESPIPE)
      }
      var bytesRead = stream.stream_ops.read(stream, buffer, offset, length, position);
      if (!seeking) stream.position += bytesRead;
      return bytesRead
    }),
    write: (function(stream, buffer, offset, length, position, canOwn) {
      if (length < 0 || position < 0) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
      }
      if ((stream.flags & 2097155) === 0) {
        throw new FS.ErrnoError(ERRNO_CODES.EBADF)
      }
      if (FS.isDir(stream.node.mode)) {
        throw new FS.ErrnoError(ERRNO_CODES.EISDIR)
      }
      if (!stream.stream_ops.write) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
      }
      if (stream.flags & 1024) {
        FS.llseek(stream, 0, 2)
      }
      var seeking = typeof position !== "undefined";
      if (!seeking) {
        position = stream.position
      } else if (!stream.seekable) {
        throw new FS.ErrnoError(ERRNO_CODES.ESPIPE)
      }
      var bytesWritten = stream.stream_ops.write(stream, buffer, offset, length, position, canOwn);
      if (!seeking) stream.position += bytesWritten;
      try {
        if (stream.path && FS.trackingDelegate["onWriteToFile"]) FS.trackingDelegate["onWriteToFile"](stream.path)
      } catch (e) {
        console.log("FS.trackingDelegate['onWriteToFile']('" + path + "') threw an exception: " + e.message)
      }
      return bytesWritten
    }),
    allocate: (function(stream, offset, length) {
      if (offset < 0 || length <= 0) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
      }
      if ((stream.flags & 2097155) === 0) {
        throw new FS.ErrnoError(ERRNO_CODES.EBADF)
      }
      if (!FS.isFile(stream.node.mode) && !FS.isDir(stream.node.mode)) {
        throw new FS.ErrnoError(ERRNO_CODES.ENODEV)
      }
      if (!stream.stream_ops.allocate) {
        throw new FS.ErrnoError(ERRNO_CODES.EOPNOTSUPP)
      }
      stream.stream_ops.allocate(stream, offset, length)
    }),
    mmap: (function(stream, buffer, offset, length, position, prot, flags) {
      if ((stream.flags & 2097155) === 1) {
        throw new FS.ErrnoError(ERRNO_CODES.EACCES)
      }
      if (!stream.stream_ops.mmap) {
        throw new FS.ErrnoError(ERRNO_CODES.ENODEV)
      }
      return stream.stream_ops.mmap(stream, buffer, offset, length, position, prot, flags)
    }),
    msync: (function(stream, buffer, offset, length, mmapFlags) {
      if (!stream || !stream.stream_ops.msync) {
        return 0
      }
      return stream.stream_ops.msync(stream, buffer, offset, length, mmapFlags)
    }),
    munmap: (function(stream) {
      return 0
    }),
    ioctl: (function(stream, cmd, arg) {
      if (!stream.stream_ops.ioctl) {
        throw new FS.ErrnoError(ERRNO_CODES.ENOTTY)
      }
      return stream.stream_ops.ioctl(stream, cmd, arg)
    }),
    readFile: (function(path, opts) {
      opts = opts || {};
      opts.flags = opts.flags || "r";
      opts.encoding = opts.encoding || "binary";
      if (opts.encoding !== "utf8" && opts.encoding !== "binary") {
        throw new Error('Invalid encoding type "' + opts.encoding + '"')
      }
      var ret;
      var stream = FS.open(path, opts.flags);
      var stat = FS.stat(path);
      var length = stat.size;
      var buf = new Uint8Array(length);
      FS.read(stream, buf, 0, length, 0);
      if (opts.encoding === "utf8") {
        ret = UTF8ArrayToString(buf, 0)
      } else if (opts.encoding === "binary") {
        ret = buf
      }
      FS.close(stream);
      return ret
    }),
    writeFile: (function(path, data, opts) {
      opts = opts || {};
      opts.flags = opts.flags || "w";
      var stream = FS.open(path, opts.flags, opts.mode);
      if (typeof data === "string") {
        var buf = new Uint8Array(lengthBytesUTF8(data) + 1);
        var actualNumBytes = stringToUTF8Array(data, buf, 0, buf.length);
        FS.write(stream, buf, 0, actualNumBytes, undefined, opts.canOwn)
      } else if (ArrayBuffer.isView(data)) {
        FS.write(stream, data, 0, data.byteLength, undefined, opts.canOwn)
      } else {
        throw new Error("Unsupported data type")
      }
      FS.close(stream)
    }),
    cwd: (function() {
      return FS.currentPath
    }),
    chdir: (function(path) {
      var lookup = FS.lookupPath(path, {
        follow: true
      });
      if (lookup.node === null) {
        throw new FS.ErrnoError(ERRNO_CODES.ENOENT)
      }
      if (!FS.isDir(lookup.node.mode)) {
        throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR)
      }
      var err = FS.nodePermissions(lookup.node, "x");
      if (err) {
        throw new FS.ErrnoError(err)
      }
      FS.currentPath = lookup.path
    }),
    createDefaultDirectories: (function() {
      FS.mkdir("/tmp");
      FS.mkdir("/home");
      FS.mkdir("/home/web_user")
    }),
    createDefaultDevices: (function() {
      FS.mkdir("/dev");
      FS.registerDevice(FS.makedev(1, 3), {
        read: (function() {
          return 0
        }),
        write: (function(stream, buffer, offset, length, pos) {
          return length
        })
      });
      FS.mkdev("/dev/null", FS.makedev(1, 3));
      TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
      TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
      FS.mkdev("/dev/tty", FS.makedev(5, 0));
      FS.mkdev("/dev/tty1", FS.makedev(6, 0));
      var random_device;
      if (typeof crypto !== "undefined") {
        var randomBuffer = new Uint8Array(1);
        random_device = (function() {
          crypto.getRandomValues(randomBuffer);
          return randomBuffer[0]
        })
      } else if (ENVIRONMENT_IS_NODE) {
        random_device = (function() {
          return require("crypto")["randomBytes"](1)[0]
        })
      } else {
        random_device = (function() {
          return Math.random() * 256 | 0
        })
      }
      FS.createDevice("/dev", "random", random_device);
      FS.createDevice("/dev", "urandom", random_device);
      FS.mkdir("/dev/shm");
      FS.mkdir("/dev/shm/tmp")
    }),
    createSpecialDirectories: (function() {
      FS.mkdir("/proc");
      FS.mkdir("/proc/self");
      FS.mkdir("/proc/self/fd");
      FS.mount({
        mount: (function() {
          var node = FS.createNode("/proc/self", "fd", 16384 | 511, 73);
          node.node_ops = {
            lookup: (function(parent, name) {
              var fd = +name;
              var stream = FS.getStream(fd);
              if (!stream) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
              var ret = {
                parent: null,
                mount: {
                  mountpoint: "fake"
                },
                node_ops: {
                  readlink: (function() {
                    return stream.path
                  })
                }
              };
              ret.parent = ret;
              return ret
            })
          };
          return node
        })
      }, {}, "/proc/self/fd")
    }),
    createStandardStreams: (function() {
      if (Module["stdin"]) {
        FS.createDevice("/dev", "stdin", Module["stdin"])
      } else {
        FS.symlink("/dev/tty", "/dev/stdin")
      }
      if (Module["stdout"]) {
        FS.createDevice("/dev", "stdout", null, Module["stdout"])
      } else {
        FS.symlink("/dev/tty", "/dev/stdout")
      }
      if (Module["stderr"]) {
        FS.createDevice("/dev", "stderr", null, Module["stderr"])
      } else {
        FS.symlink("/dev/tty1", "/dev/stderr")
      }
      var stdin = FS.open("/dev/stdin", "r");
      assert(stdin.fd === 0, "invalid handle for stdin (" + stdin.fd + ")");
      var stdout = FS.open("/dev/stdout", "w");
      assert(stdout.fd === 1, "invalid handle for stdout (" + stdout.fd + ")");
      var stderr = FS.open("/dev/stderr", "w");
      assert(stderr.fd === 2, "invalid handle for stderr (" + stderr.fd + ")")
    }),
    ensureErrnoError: (function() {
      if (FS.ErrnoError) return;
      FS.ErrnoError = function ErrnoError(errno, node) {
        this.node = node;
        this.setErrno = (function(errno) {
          this.errno = errno;
          for (var key in ERRNO_CODES) {
            if (ERRNO_CODES[key] === errno) {
              this.code = key;
              break
            }
          }
        });
        this.setErrno(errno);
        this.message = ERRNO_MESSAGES[errno];
        if (this.stack) Object.defineProperty(this, "stack", {
          value: (new Error).stack,
          writable: true
        })
      };
      FS.ErrnoError.prototype = new Error;
      FS.ErrnoError.prototype.constructor = FS.ErrnoError;
      [ERRNO_CODES.ENOENT].forEach((function(code) {
        FS.genericErrors[code] = new FS.ErrnoError(code);
        FS.genericErrors[code].stack = "<generic error, no stack>"
      }))
    }),
    staticInit: (function() {
      FS.ensureErrnoError();
      FS.nameTable = new Array(4096);
      FS.mount(MEMFS, {}, "/");
      FS.createDefaultDirectories();
      FS.createDefaultDevices();
      FS.createSpecialDirectories();
      FS.filesystems = {
        "MEMFS": MEMFS,
        "IDBFS": IDBFS,
        "NODEFS": NODEFS,
        "WORKERFS": WORKERFS
      }
    }),
    init: (function(input, output, error) {
      assert(!FS.init.initialized, "FS.init was previously called. If you want to initialize later with custom parameters, remove any earlier calls (note that one is automatically added to the generated code)");
      FS.init.initialized = true;
      FS.ensureErrnoError();
      Module["stdin"] = input || Module["stdin"];
      Module["stdout"] = output || Module["stdout"];
      Module["stderr"] = error || Module["stderr"];
      FS.createStandardStreams()
    }),
    quit: (function() {
      FS.init.initialized = false;
      var fflush = Module["_fflush"];
      if (fflush) fflush(0);
      for (var i = 0; i < FS.streams.length; i++) {
        var stream = FS.streams[i];
        if (!stream) {
          continue
        }
        FS.close(stream)
      }
    }),
    getMode: (function(canRead, canWrite) {
      var mode = 0;
      if (canRead) mode |= 292 | 73;
      if (canWrite) mode |= 146;
      return mode
    }),
    joinPath: (function(parts, forceRelative) {
      var path = PATH.join.apply(null, parts);
      if (forceRelative && path[0] == "/") path = path.substr(1);
      return path
    }),
    absolutePath: (function(relative, base) {
      return PATH.resolve(base, relative)
    }),
    standardizePath: (function(path) {
      return PATH.normalize(path)
    }),
    findObject: (function(path, dontResolveLastLink) {
      var ret = FS.analyzePath(path, dontResolveLastLink);
      if (ret.exists) {
        return ret.object
      } else {
        ___setErrNo(ret.error);
        return null
      }
    }),
    analyzePath: (function(path, dontResolveLastLink) {
      try {
        var lookup = FS.lookupPath(path, {
          follow: !dontResolveLastLink
        });
        path = lookup.path
      } catch (e) {}
      var ret = {
        isRoot: false,
        exists: false,
        error: 0,
        name: null,
        path: null,
        object: null,
        parentExists: false,
        parentPath: null,
        parentObject: null
      };
      try {
        var lookup = FS.lookupPath(path, {
          parent: true
        });
        ret.parentExists = true;
        ret.parentPath = lookup.path;
        ret.parentObject = lookup.node;
        ret.name = PATH.basename(path);
        lookup = FS.lookupPath(path, {
          follow: !dontResolveLastLink
        });
        ret.exists = true;
        ret.path = lookup.path;
        ret.object = lookup.node;
        ret.name = lookup.node.name;
        ret.isRoot = lookup.path === "/"
      } catch (e) {
        ret.error = e.errno
      }
      return ret
    }),
    createFolder: (function(parent, name, canRead, canWrite) {
      var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
      var mode = FS.getMode(canRead, canWrite);
      return FS.mkdir(path, mode)
    }),
    createPath: (function(parent, path, canRead, canWrite) {
      parent = typeof parent === "string" ? parent : FS.getPath(parent);
      var parts = path.split("/").reverse();
      while (parts.length) {
        var part = parts.pop();
        if (!part) continue;
        var current = PATH.join2(parent, part);
        try {
          FS.mkdir(current)
        } catch (e) {}
        parent = current
      }
      return current
    }),
    createFile: (function(parent, name, properties, canRead, canWrite) {
      var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
      var mode = FS.getMode(canRead, canWrite);
      return FS.create(path, mode)
    }),
    createDataFile: (function(parent, name, data, canRead, canWrite, canOwn) {
      var path = name ? PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name) : parent;
      var mode = FS.getMode(canRead, canWrite);
      var node = FS.create(path, mode);
      if (data) {
        if (typeof data === "string") {
          var arr = new Array(data.length);
          for (var i = 0, len = data.length; i < len; ++i) arr[i] = data.charCodeAt(i);
          data = arr
        }
        FS.chmod(node, mode | 146);
        var stream = FS.open(node, "w");
        FS.write(stream, data, 0, data.length, 0, canOwn);
        FS.close(stream);
        FS.chmod(node, mode)
      }
      return node
    }),
    createDevice: (function(parent, name, input, output) {
      var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
      var mode = FS.getMode(!!input, !!output);
      if (!FS.createDevice.major) FS.createDevice.major = 64;
      var dev = FS.makedev(FS.createDevice.major++, 0);
      FS.registerDevice(dev, {
        open: (function(stream) {
          stream.seekable = false
        }),
        close: (function(stream) {
          if (output && output.buffer && output.buffer.length) {
            output(10)
          }
        }),
        read: (function(stream, buffer, offset, length, pos) {
          var bytesRead = 0;
          for (var i = 0; i < length; i++) {
            var result;
            try {
              result = input()
            } catch (e) {
              throw new FS.ErrnoError(ERRNO_CODES.EIO)
            }
            if (result === undefined && bytesRead === 0) {
              throw new FS.ErrnoError(ERRNO_CODES.EAGAIN)
            }
            if (result === null || result === undefined) break;
            bytesRead++;
            buffer[offset + i] = result
          }
          if (bytesRead) {
            stream.node.timestamp = Date.now()
          }
          return bytesRead
        }),
        write: (function(stream, buffer, offset, length, pos) {
          for (var i = 0; i < length; i++) {
            try {
              output(buffer[offset + i])
            } catch (e) {
              throw new FS.ErrnoError(ERRNO_CODES.EIO)
            }
          }
          if (length) {
            stream.node.timestamp = Date.now()
          }
          return i
        })
      });
      return FS.mkdev(path, mode, dev)
    }),
    createLink: (function(parent, name, target, canRead, canWrite) {
      var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
      return FS.symlink(target, path)
    }),
    forceLoadFile: (function(obj) {
      if (obj.isDevice || obj.isFolder || obj.link || obj.contents) return true;
      var success = true;
      if (typeof XMLHttpRequest !== "undefined") {
        throw new Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.")
      } else if (Module["read"]) {
        try {
          obj.contents = intArrayFromString(Module["read"](obj.url), true);
          obj.usedBytes = obj.contents.length
        } catch (e) {
          success = false
        }
      } else {
        throw new Error("Cannot load without read() or XMLHttpRequest.")
      }
      if (!success) ___setErrNo(ERRNO_CODES.EIO);
      return success
    }),
    createLazyFile: (function(parent, name, url, canRead, canWrite) {
      function LazyUint8Array() {
        this.lengthKnown = false;
        this.chunks = []
      }
      LazyUint8Array.prototype.get = function LazyUint8Array_get(idx) {
        if (idx > this.length - 1 || idx < 0) {
          return undefined
        }
        var chunkOffset = idx % this.chunkSize;
        var chunkNum = idx / this.chunkSize | 0;
        return this.getter(chunkNum)[chunkOffset]
      };
      LazyUint8Array.prototype.setDataGetter = function LazyUint8Array_setDataGetter(getter) {
        this.getter = getter
      };
      LazyUint8Array.prototype.cacheLength = function LazyUint8Array_cacheLength() {
        var xhr = new XMLHttpRequest;
        xhr.open("HEAD", url, false);
        xhr.send(null);
        if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
        var datalength = Number(xhr.getResponseHeader("Content-length"));
        var header;
        var hasByteServing = (header = xhr.getResponseHeader("Accept-Ranges")) && header === "bytes";
        var usesGzip = (header = xhr.getResponseHeader("Content-Encoding")) && header === "gzip";
        var chunkSize = 1024 * 1024;
        if (!hasByteServing) chunkSize = datalength;
        var doXHR = (function(from, to) {
          if (from > to) throw new Error("invalid range (" + from + ", " + to + ") or no bytes requested!");
          if (to > datalength - 1) throw new Error("only " + datalength + " bytes available! programmer error!");
          var xhr = new XMLHttpRequest;
          xhr.open("GET", url, false);
          if (datalength !== chunkSize) xhr.setRequestHeader("Range", "bytes=" + from + "-" + to);
          if (typeof Uint8Array != "undefined") xhr.responseType = "arraybuffer";
          if (xhr.overrideMimeType) {
            xhr.overrideMimeType("text/plain; charset=x-user-defined")
          }
          xhr.send(null);
          if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
          if (xhr.response !== undefined) {
            return new Uint8Array(xhr.response || [])
          } else {
            return intArrayFromString(xhr.responseText || "", true)
          }
        });
        var lazyArray = this;
        lazyArray.setDataGetter((function(chunkNum) {
          var start = chunkNum * chunkSize;
          var end = (chunkNum + 1) * chunkSize - 1;
          end = Math.min(end, datalength - 1);
          if (typeof lazyArray.chunks[chunkNum] === "undefined") {
            lazyArray.chunks[chunkNum] = doXHR(start, end)
          }
          if (typeof lazyArray.chunks[chunkNum] === "undefined") throw new Error("doXHR failed!");
          return lazyArray.chunks[chunkNum]
        }));
        if (usesGzip || !datalength) {
          chunkSize = datalength = 1;
          datalength = this.getter(0).length;
          chunkSize = datalength;
          console.log("LazyFiles on gzip forces download of the whole file when length is accessed")
        }
        this._length = datalength;
        this._chunkSize = chunkSize;
        this.lengthKnown = true
      };
      if (typeof XMLHttpRequest !== "undefined") {
        if (!ENVIRONMENT_IS_WORKER) throw "Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc";
        var lazyArray = new LazyUint8Array;
        Object.defineProperties(lazyArray, {
          length: {
            get: (function() {
              if (!this.lengthKnown) {
                this.cacheLength()
              }
              return this._length
            })
          },
          chunkSize: {
            get: (function() {
              if (!this.lengthKnown) {
                this.cacheLength()
              }
              return this._chunkSize
            })
          }
        });
        var properties = {
          isDevice: false,
          contents: lazyArray
        }
      } else {
        var properties = {
          isDevice: false,
          url: url
        }
      }
      var node = FS.createFile(parent, name, properties, canRead, canWrite);
      if (properties.contents) {
        node.contents = properties.contents
      } else if (properties.url) {
        node.contents = null;
        node.url = properties.url
      }
      Object.defineProperties(node, {
        usedBytes: {
          get: (function() {
            return this.contents.length
          })
        }
      });
      var stream_ops = {};
      var keys = Object.keys(node.stream_ops);
      keys.forEach((function(key) {
        var fn = node.stream_ops[key];
        stream_ops[key] = function forceLoadLazyFile() {
          if (!FS.forceLoadFile(node)) {
            throw new FS.ErrnoError(ERRNO_CODES.EIO)
          }
          return fn.apply(null, arguments)
        }
      }));
      stream_ops.read = function stream_ops_read(stream, buffer, offset, length, position) {
        if (!FS.forceLoadFile(node)) {
          throw new FS.ErrnoError(ERRNO_CODES.EIO)
        }
        var contents = stream.node.contents;
        if (position >= contents.length) return 0;
        var size = Math.min(contents.length - position, length);
        assert(size >= 0);
        if (contents.slice) {
          for (var i = 0; i < size; i++) {
            buffer[offset + i] = contents[position + i]
          }
        } else {
          for (var i = 0; i < size; i++) {
            buffer[offset + i] = contents.get(position + i)
          }
        }
        return size
      };
      node.stream_ops = stream_ops;
      return node
    }),
    createPreloadedFile: (function(parent, name, url, canRead, canWrite, onload, onerror, dontCreateFile, canOwn, preFinish) {
      Browser.init();
      var fullname = name ? PATH.resolve(PATH.join2(parent, name)) : parent;
      var dep = getUniqueRunDependency("cp " + fullname);

      function processData(byteArray) {
        function finish(byteArray) {
          if (preFinish) preFinish();
          if (!dontCreateFile) {
            FS.createDataFile(parent, name, byteArray, canRead, canWrite, canOwn)
          }
          if (onload) onload();
          removeRunDependency(dep)
        }
        var handled = false;
        Module["preloadPlugins"].forEach((function(plugin) {
          if (handled) return;
          if (plugin["canHandle"](fullname)) {
            plugin["handle"](byteArray, fullname, finish, (function() {
              if (onerror) onerror();
              removeRunDependency(dep)
            }));
            handled = true
          }
        }));
        if (!handled) finish(byteArray)
      }
      addRunDependency(dep);
      if (typeof url == "string") {
        Browser.asyncLoad(url, (function(byteArray) {
          processData(byteArray)
        }), onerror)
      } else {
        processData(url)
      }
    }),
    indexedDB: (function() {
      return window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB
    }),
    DB_NAME: (function() {
      return "EM_FS_" + window.location.pathname
    }),
    DB_VERSION: 20,
    DB_STORE_NAME: "FILE_DATA",
    saveFilesToDB: (function(paths, onload, onerror) {
      onload = onload || (function() {});
      onerror = onerror || (function() {});
      var indexedDB = FS.indexedDB();
      try {
        var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION)
      } catch (e) {
        return onerror(e)
      }
      openRequest.onupgradeneeded = function openRequest_onupgradeneeded() {
        console.log("creating db");
        var db = openRequest.result;
        db.createObjectStore(FS.DB_STORE_NAME)
      };
      openRequest.onsuccess = function openRequest_onsuccess() {
        var db = openRequest.result;
        var transaction = db.transaction([FS.DB_STORE_NAME], "readwrite");
        var files = transaction.objectStore(FS.DB_STORE_NAME);
        var ok = 0,
          fail = 0,
          total = paths.length;

        function finish() {
          if (fail == 0) onload();
          else onerror()
        }
        paths.forEach((function(path) {
          var putRequest = files.put(FS.analyzePath(path).object.contents, path);
          putRequest.onsuccess = function putRequest_onsuccess() {
            ok++;
            if (ok + fail == total) finish()
          };
          putRequest.onerror = function putRequest_onerror() {
            fail++;
            if (ok + fail == total) finish()
          }
        }));
        transaction.onerror = onerror
      };
      openRequest.onerror = onerror
    }),
    loadFilesFromDB: (function(paths, onload, onerror) {
      onload = onload || (function() {});
      onerror = onerror || (function() {});
      var indexedDB = FS.indexedDB();
      try {
        var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION)
      } catch (e) {
        return onerror(e)
      }
      openRequest.onupgradeneeded = onerror;
      openRequest.onsuccess = function openRequest_onsuccess() {
        var db = openRequest.result;
        try {
          var transaction = db.transaction([FS.DB_STORE_NAME], "readonly")
        } catch (e) {
          onerror(e);
          return
        }
        var files = transaction.objectStore(FS.DB_STORE_NAME);
        var ok = 0,
          fail = 0,
          total = paths.length;

        function finish() {
          if (fail == 0) onload();
          else onerror()
        }
        paths.forEach((function(path) {
          var getRequest = files.get(path);
          getRequest.onsuccess = function getRequest_onsuccess() {
            if (FS.analyzePath(path).exists) {
              FS.unlink(path)
            }
            FS.createDataFile(PATH.dirname(path), PATH.basename(path), getRequest.result, true, true, true);
            ok++;
            if (ok + fail == total) finish()
          };
          getRequest.onerror = function getRequest_onerror() {
            fail++;
            if (ok + fail == total) finish()
          }
        }));
        transaction.onerror = onerror
      };
      openRequest.onerror = onerror
    })
  };
  Module["FS"] = FS;
  var SYSCALLS = {
    DEFAULT_POLLMASK: 5,
    mappings: {},
    umask: 511,
    calculateAt: (function(dirfd, path) {
      if (path[0] !== "/") {
        var dir;
        if (dirfd === -100) {
          dir = FS.cwd()
        } else {
          var dirstream = FS.getStream(dirfd);
          if (!dirstream) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
          dir = dirstream.path
        }
        path = PATH.join2(dir, path)
      }
      return path
    }),
    doStat: (function(func, path, buf) {
      try {
        var stat = func(path)
      } catch (e) {
        if (e && e.node && PATH.normalize(path) !== PATH.normalize(FS.getPath(e.node))) {
          return -ERRNO_CODES.ENOTDIR
        }
        throw e
      }
      HEAP32[buf >> 2] = stat.dev;
      HEAP32[buf + 4 >> 2] = 0;
      HEAP32[buf + 8 >> 2] = stat.ino;
      HEAP32[buf + 12 >> 2] = stat.mode;
      HEAP32[buf + 16 >> 2] = stat.nlink;
      HEAP32[buf + 20 >> 2] = stat.uid;
      HEAP32[buf + 24 >> 2] = stat.gid;
      HEAP32[buf + 28 >> 2] = stat.rdev;
      HEAP32[buf + 32 >> 2] = 0;
      HEAP32[buf + 36 >> 2] = stat.size;
      HEAP32[buf + 40 >> 2] = 4096;
      HEAP32[buf + 44 >> 2] = stat.blocks;
      HEAP32[buf + 48 >> 2] = stat.atime.getTime() / 1e3 | 0;
      HEAP32[buf + 52 >> 2] = 0;
      HEAP32[buf + 56 >> 2] = stat.mtime.getTime() / 1e3 | 0;
      HEAP32[buf + 60 >> 2] = 0;
      HEAP32[buf + 64 >> 2] = stat.ctime.getTime() / 1e3 | 0;
      HEAP32[buf + 68 >> 2] = 0;
      HEAP32[buf + 72 >> 2] = stat.ino;
      return 0
    }),
    doMsync: (function(addr, stream, len, flags) {
      var buffer = new Uint8Array(HEAPU8.subarray(addr, addr + len));
      FS.msync(stream, buffer, 0, len, flags)
    }),
    doMkdir: (function(path, mode) {
      path = PATH.normalize(path);
      if (path[path.length - 1] === "/") path = path.substr(0, path.length - 1);
      FS.mkdir(path, mode, 0);
      return 0
    }),
    doMknod: (function(path, mode, dev) {
      switch (mode & 61440) {
        case 32768:
        case 8192:
        case 24576:
        case 4096:
        case 49152:
          break;
        default:
          return -ERRNO_CODES.EINVAL
      }
      FS.mknod(path, mode, dev);
      return 0
    }),
    doReadlink: (function(path, buf, bufsize) {
      if (bufsize <= 0) return -ERRNO_CODES.EINVAL;
      var ret = FS.readlink(path);
      var len = Math.min(bufsize, lengthBytesUTF8(ret));
      var endChar = HEAP8[buf + len];
      stringToUTF8(ret, buf, bufsize + 1);
      HEAP8[buf + len] = endChar;
      return len
    }),
    doAccess: (function(path, amode) {
      if (amode & ~7) {
        return -ERRNO_CODES.EINVAL
      }
      var node;
      var lookup = FS.lookupPath(path, {
        follow: true
      });
      node = lookup.node;
      var perms = "";
      if (amode & 4) perms += "r";
      if (amode & 2) perms += "w";
      if (amode & 1) perms += "x";
      if (perms && FS.nodePermissions(node, perms)) {
        return -ERRNO_CODES.EACCES
      }
      return 0
    }),
    doDup: (function(path, flags, suggestFD) {
      var suggest = FS.getStream(suggestFD);
      if (suggest) FS.close(suggest);
      return FS.open(path, flags, 0, suggestFD, suggestFD).fd
    }),
    doReadv: (function(stream, iov, iovcnt, offset) {
      var ret = 0;
      for (var i = 0; i < iovcnt; i++) {
        var ptr = HEAP32[iov + i * 8 >> 2];
        var len = HEAP32[iov + (i * 8 + 4) >> 2];
        var curr = FS.read(stream, HEAP8, ptr, len, offset);
        if (curr < 0) return -1;
        ret += curr;
        if (curr < len) break
      }
      return ret
    }),
    doWritev: (function(stream, iov, iovcnt, offset) {
      var ret = 0;
      for (var i = 0; i < iovcnt; i++) {
        var ptr = HEAP32[iov + i * 8 >> 2];
        var len = HEAP32[iov + (i * 8 + 4) >> 2];
        var curr = FS.write(stream, HEAP8, ptr, len, offset);
        if (curr < 0) return -1;
        ret += curr
      }
      return ret
    }),
    varargs: 0,
    get: (function(varargs) {
      SYSCALLS.varargs += 4;
      var ret = HEAP32[SYSCALLS.varargs - 4 >> 2];
      return ret
    }),
    getStr: (function() {
      var ret = Pointer_stringify(SYSCALLS.get());
      return ret
    }),
    getStreamFromFD: (function() {
      var stream = FS.getStream(SYSCALLS.get());
      if (!stream) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
      return stream
    }),
    getSocketFromFD: (function() {
      var socket = SOCKFS.getSocket(SYSCALLS.get());
      if (!socket) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
      return socket
    }),
    getSocketAddress: (function(allowNull) {
      var addrp = SYSCALLS.get(),
        addrlen = SYSCALLS.get();
      if (allowNull && addrp === 0) return null;
      var info = __read_sockaddr(addrp, addrlen);
      if (info.errno) throw new FS.ErrnoError(info.errno);
      info.addr = DNS.lookup_addr(info.addr) || info.addr;
      return info
    }),
    get64: (function() {
      var low = SYSCALLS.get(),
        high = SYSCALLS.get();
      if (low >= 0) assert(high === 0);
      else assert(high === -1);
      return low
    }),
    getZero: (function() {
      assert(SYSCALLS.get() === 0)
    })
  };

  function ___syscall140(which, varargs) {
    SYSCALLS.varargs = varargs;
    try {
      var stream = SYSCALLS.getStreamFromFD(),
        offset_high = SYSCALLS.get(),
        offset_low = SYSCALLS.get(),
        result = SYSCALLS.get(),
        whence = SYSCALLS.get();
      var offset = offset_low;
      FS.llseek(stream, offset, whence);
      HEAP32[result >> 2] = stream.position;
      if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null;
      return 0
    } catch (e) {
      if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
      return -e.errno
    }
  }

  function ___syscall146(which, varargs) {
    SYSCALLS.varargs = varargs;
    try {
      var stream = SYSCALLS.getStreamFromFD(),
        iov = SYSCALLS.get(),
        iovcnt = SYSCALLS.get();
      return SYSCALLS.doWritev(stream, iov, iovcnt)
    } catch (e) {
      if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
      return -e.errno
    }
  }

  function ___syscall183(which, varargs) {
    SYSCALLS.varargs = varargs;
    try {
      var buf = SYSCALLS.get(),
        size = SYSCALLS.get();
      if (size === 0) return -ERRNO_CODES.EINVAL;
      var cwd = FS.cwd();
      var cwdLengthInBytes = lengthBytesUTF8(cwd);
      if (size < cwdLengthInBytes + 1) return -ERRNO_CODES.ERANGE;
      stringToUTF8(cwd, buf, size);
      return buf
    } catch (e) {
      if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
      return -e.errno
    }
  }

  function ___syscall195(which, varargs) {
    SYSCALLS.varargs = varargs;
    try {
      var path = SYSCALLS.getStr(),
        buf = SYSCALLS.get();
      return SYSCALLS.doStat(FS.stat, path, buf)
    } catch (e) {
      if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
      return -e.errno
    }
  }

  function ___syscall202(which, varargs) {
    SYSCALLS.varargs = varargs;
    try {
      return 0
    } catch (e) {
      if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
      return -e.errno
    }
  }

  function ___syscall199() {
    return ___syscall202.apply(null, arguments)
  }

  function ___syscall221(which, varargs) {
    SYSCALLS.varargs = varargs;
    try {
      var stream = SYSCALLS.getStreamFromFD(),
        cmd = SYSCALLS.get();
      switch (cmd) {
        case 0:
          {
            var arg = SYSCALLS.get();
            if (arg < 0) {
              return -ERRNO_CODES.EINVAL
            }
            var newStream;newStream = FS.open(stream.path, stream.flags, 0, arg);
            return newStream.fd
          };
        case 1:
        case 2:
          return 0;
        case 3:
          return stream.flags;
        case 4:
          {
            var arg = SYSCALLS.get();stream.flags |= arg;
            return 0
          };
        case 12:
        case 12:
          {
            var arg = SYSCALLS.get();
            var offset = 0;HEAP16[arg + offset >> 1] = 2;
            return 0
          };
        case 13:
        case 14:
        case 13:
        case 14:
          return 0;
        case 16:
        case 8:
          return -ERRNO_CODES.EINVAL;
        case 9:
          ___setErrNo(ERRNO_CODES.EINVAL);
          return -1;
        default:
          {
            return -ERRNO_CODES.EINVAL
          }
      }
    } catch (e) {
      if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
      return -e.errno
    }
  }

  function ___syscall3(which, varargs) {
    SYSCALLS.varargs = varargs;
    try {
      var stream = SYSCALLS.getStreamFromFD(),
        buf = SYSCALLS.get(),
        count = SYSCALLS.get();
      return FS.read(stream, HEAP8, buf, count)
    } catch (e) {
      if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
      return -e.errno
    }
  }

  function ___syscall4(which, varargs) {
    SYSCALLS.varargs = varargs;
    try {
      var stream = SYSCALLS.getStreamFromFD(),
        buf = SYSCALLS.get(),
        count = SYSCALLS.get();
      return FS.write(stream, HEAP8, buf, count)
    } catch (e) {
      if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
      return -e.errno
    }
  }

  function ___syscall5(which, varargs) {
    SYSCALLS.varargs = varargs;
    try {
      var pathname = SYSCALLS.getStr(),
        flags = SYSCALLS.get(),
        mode = SYSCALLS.get();
      var stream = FS.open(pathname, flags, mode);
      return stream.fd
    } catch (e) {
      if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
      return -e.errno
    }
  }

  function ___syscall54(which, varargs) {
    SYSCALLS.varargs = varargs;
    try {
      var stream = SYSCALLS.getStreamFromFD(),
        op = SYSCALLS.get();
      switch (op) {
        case 21509:
        case 21505:
          {
            if (!stream.tty) return -ERRNO_CODES.ENOTTY;
            return 0
          };
        case 21510:
        case 21511:
        case 21512:
        case 21506:
        case 21507:
        case 21508:
          {
            if (!stream.tty) return -ERRNO_CODES.ENOTTY;
            return 0
          };
        case 21519:
          {
            if (!stream.tty) return -ERRNO_CODES.ENOTTY;
            var argp = SYSCALLS.get();HEAP32[argp >> 2] = 0;
            return 0
          };
        case 21520:
          {
            if (!stream.tty) return -ERRNO_CODES.ENOTTY;
            return -ERRNO_CODES.EINVAL
          };
        case 21531:
          {
            var argp = SYSCALLS.get();
            return FS.ioctl(stream, op, argp)
          };
        case 21523:
          {
            if (!stream.tty) return -ERRNO_CODES.ENOTTY;
            return 0
          };
        default:
          abort("bad ioctl syscall " + op)
      }
    } catch (e) {
      if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
      return -e.errno
    }
  }

  function ___syscall6(which, varargs) {
    SYSCALLS.varargs = varargs;
    try {
      var stream = SYSCALLS.getStreamFromFD();
      FS.close(stream);
      return 0
    } catch (e) {
      if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
      return -e.errno
    }
  }
  var cttz_i8 = allocate([8, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 5, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 6, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 5, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 7, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 5, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 6, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 5, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0], "i8", ALLOC_STATIC);

  function _emscripten_set_main_loop_timing(mode, value) {
    Browser.mainLoop.timingMode = mode;
    Browser.mainLoop.timingValue = value;
    if (!Browser.mainLoop.func) {
      return 1
    }
    if (mode == 0) {
      Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_setTimeout() {
        var timeUntilNextTick = Math.max(0, Browser.mainLoop.tickStartTime + value - _emscripten_get_now()) | 0;
        setTimeout(Browser.mainLoop.runner, timeUntilNextTick)
      };
      Browser.mainLoop.method = "timeout"
    } else if (mode == 1) {
      Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_rAF() {
        Browser.requestAnimationFrame(Browser.mainLoop.runner)
      };
      Browser.mainLoop.method = "rAF"
    } else if (mode == 2) {
      if (typeof setImmediate === "undefined") {
        var setImmediates = [];
        var emscriptenMainLoopMessageId = "setimmediate";

        function Browser_setImmediate_messageHandler(event) {
          if (event.data === emscriptenMainLoopMessageId || event.data.target === emscriptenMainLoopMessageId) {
            event.stopPropagation();
            setImmediates.shift()()
          }
        }
        addEventListener("message", Browser_setImmediate_messageHandler, true);
        setImmediate = function Browser_emulated_setImmediate(func) {
          setImmediates.push(func);
          if (ENVIRONMENT_IS_WORKER) {
            if (Module["setImmediates"] === undefined) Module["setImmediates"] = [];
            Module["setImmediates"].push(func);
            postMessage({
              target: emscriptenMainLoopMessageId
            })
          } else postMessage(emscriptenMainLoopMessageId, "*")
        }
      }
      Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_setImmediate() {
        setImmediate(Browser.mainLoop.runner)
      };
      Browser.mainLoop.method = "immediate"
    }
    return 0
  }

  function _emscripten_get_now() {
    abort()
  }

  function _emscripten_set_main_loop(func, fps, simulateInfiniteLoop, arg, noSetTiming) {
    Module["noExitRuntime"] = true;
    assert(!Browser.mainLoop.func, "emscripten_set_main_loop: there can only be one main loop function at once: call emscripten_cancel_main_loop to cancel the previous one before setting a new one with different parameters.");
    Browser.mainLoop.func = func;
    Browser.mainLoop.arg = arg;
    var browserIterationFunc;
    if (typeof arg !== "undefined") {
      browserIterationFunc = (function() {
        Module["dynCall_vi"](func, arg)
      })
    } else {
      browserIterationFunc = (function() {
        Module["dynCall_v"](func)
      })
    }
    var thisMainLoopId = Browser.mainLoop.currentlyRunningMainloop;
    Browser.mainLoop.runner = function Browser_mainLoop_runner() {
      if (ABORT) return;
      if (Browser.mainLoop.queue.length > 0) {
        var start = Date.now();
        var blocker = Browser.mainLoop.queue.shift();
        blocker.func(blocker.arg);
        if (Browser.mainLoop.remainingBlockers) {
          var remaining = Browser.mainLoop.remainingBlockers;
          var next = remaining % 1 == 0 ? remaining - 1 : Math.floor(remaining);
          if (blocker.counted) {
            Browser.mainLoop.remainingBlockers = next
          } else {
            next = next + .5;
            Browser.mainLoop.remainingBlockers = (8 * remaining + next) / 9
          }
        }
        console.log('main loop blocker "' + blocker.name + '" took ' + (Date.now() - start) + " ms");
        Browser.mainLoop.updateStatus();
        if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
        setTimeout(Browser.mainLoop.runner, 0);
        return
      }
      if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
      Browser.mainLoop.currentFrameNumber = Browser.mainLoop.currentFrameNumber + 1 | 0;
      if (Browser.mainLoop.timingMode == 1 && Browser.mainLoop.timingValue > 1 && Browser.mainLoop.currentFrameNumber % Browser.mainLoop.timingValue != 0) {
        Browser.mainLoop.scheduler();
        return
      } else if (Browser.mainLoop.timingMode == 0) {
        Browser.mainLoop.tickStartTime = _emscripten_get_now()
      }
      if (Browser.mainLoop.method === "timeout" && Module.ctx) {
        Module.printErr("Looks like you are rendering without using requestAnimationFrame for the main loop. You should use 0 for the frame rate in emscripten_set_main_loop in order to use requestAnimationFrame, as that can greatly improve your frame rates!");
        Browser.mainLoop.method = ""
      }
      Browser.mainLoop.runIter(browserIterationFunc);
      if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
      if (typeof SDL === "object" && SDL.audio && SDL.audio.queueNewAudioData) SDL.audio.queueNewAudioData();
      Browser.mainLoop.scheduler()
    };
    if (!noSetTiming) {
      if (fps && fps > 0) _emscripten_set_main_loop_timing(0, 1e3 / fps);
      else _emscripten_set_main_loop_timing(1, 1);
      Browser.mainLoop.scheduler()
    }
    if (simulateInfiniteLoop) {
      throw "SimulateInfiniteLoop"
    }
  }
  var Browser = {
    mainLoop: {
      scheduler: null,
      method: "",
      currentlyRunningMainloop: 0,
      func: null,
      arg: 0,
      timingMode: 0,
      timingValue: 0,
      currentFrameNumber: 0,
      queue: [],
      pause: (function() {
        Browser.mainLoop.scheduler = null;
        Browser.mainLoop.currentlyRunningMainloop++
      }),
      resume: (function() {
        Browser.mainLoop.currentlyRunningMainloop++;
        var timingMode = Browser.mainLoop.timingMode;
        var timingValue = Browser.mainLoop.timingValue;
        var func = Browser.mainLoop.func;
        Browser.mainLoop.func = null;
        _emscripten_set_main_loop(func, 0, false, Browser.mainLoop.arg, true);
        _emscripten_set_main_loop_timing(timingMode, timingValue);
        Browser.mainLoop.scheduler()
      }),
      updateStatus: (function() {
        if (Module["setStatus"]) {
          var message = Module["statusMessage"] || "Please wait...";
          var remaining = Browser.mainLoop.remainingBlockers;
          var expected = Browser.mainLoop.expectedBlockers;
          if (remaining) {
            if (remaining < expected) {
              Module["setStatus"](message + " (" + (expected - remaining) + "/" + expected + ")")
            } else {
              Module["setStatus"](message)
            }
          } else {
            Module["setStatus"]("")
          }
        }
      }),
      runIter: (function(func) {
        if (ABORT) return;
        if (Module["preMainLoop"]) {
          var preRet = Module["preMainLoop"]();
          if (preRet === false) {
            return
          }
        }
        try {
          func()
        } catch (e) {
          if (e instanceof ExitStatus) {
            return
          } else {
            if (e && typeof e === "object" && e.stack) Module.printErr("exception thrown: " + [e, e.stack]);
            throw e
          }
        }
        if (Module["postMainLoop"]) Module["postMainLoop"]()
      })
    },
    isFullscreen: false,
    pointerLock: false,
    moduleContextCreatedCallbacks: [],
    workers: [],
    init: (function() {
      if (!Module["preloadPlugins"]) Module["preloadPlugins"] = [];
      if (Browser.initted) return;
      Browser.initted = true;
      try {
        new Blob;
        Browser.hasBlobConstructor = true
      } catch (e) {
        Browser.hasBlobConstructor = false;
        console.log("warning: no blob constructor, cannot create blobs with mimetypes")
      }
      Browser.BlobBuilder = typeof MozBlobBuilder != "undefined" ? MozBlobBuilder : typeof WebKitBlobBuilder != "undefined" ? WebKitBlobBuilder : !Browser.hasBlobConstructor ? console.log("warning: no BlobBuilder") : null;
      Browser.URLObject = typeof window != "undefined" ? window.URL ? window.URL : window.webkitURL : undefined;
      if (!Module.noImageDecoding && typeof Browser.URLObject === "undefined") {
        console.log("warning: Browser does not support creating object URLs. Built-in browser image decoding will not be available.");
        Module.noImageDecoding = true
      }
      var imagePlugin = {};
      imagePlugin["canHandle"] = function imagePlugin_canHandle(name) {
        return !Module.noImageDecoding && /\.(jpg|jpeg|png|bmp)$/i.test(name)
      };
      imagePlugin["handle"] = function imagePlugin_handle(byteArray, name, onload, onerror) {
        var b = null;
        if (Browser.hasBlobConstructor) {
          try {
            b = new Blob([byteArray], {
              type: Browser.getMimetype(name)
            });
            if (b.size !== byteArray.length) {
              b = new Blob([(new Uint8Array(byteArray)).buffer], {
                type: Browser.getMimetype(name)
              })
            }
          } catch (e) {
            warnOnce("Blob constructor present but fails: " + e + "; falling back to blob builder")
          }
        }
        if (!b) {
          var bb = new Browser.BlobBuilder;
          bb.append((new Uint8Array(byteArray)).buffer);
          b = bb.getBlob()
        }
        var url = Browser.URLObject.createObjectURL(b);
        var img = new Image;
        img.onload = function img_onload() {
          assert(img.complete, "Image " + name + " could not be decoded");
          var canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          var ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          Module["preloadedImages"][name] = canvas;
          Browser.URLObject.revokeObjectURL(url);
          if (onload) onload(byteArray)
        };
        img.onerror = function img_onerror(event) {
          console.log("Image " + url + " could not be decoded");
          if (onerror) onerror()
        };
        img.src = url
      };
      Module["preloadPlugins"].push(imagePlugin);
      var audioPlugin = {};
      audioPlugin["canHandle"] = function audioPlugin_canHandle(name) {
        return !Module.noAudioDecoding && name.substr(-4) in {
          ".ogg": 1,
          ".wav": 1,
          ".mp3": 1
        }
      };
      audioPlugin["handle"] = function audioPlugin_handle(byteArray, name, onload, onerror) {
        var done = false;

        function finish(audio) {
          if (done) return;
          done = true;
          Module["preloadedAudios"][name] = audio;
          if (onload) onload(byteArray)
        }

        function fail() {
          if (done) return;
          done = true;
          Module["preloadedAudios"][name] = new Audio;
          if (onerror) onerror()
        }
        if (Browser.hasBlobConstructor) {
          try {
            var b = new Blob([byteArray], {
              type: Browser.getMimetype(name)
            })
          } catch (e) {
            return fail()
          }
          var url = Browser.URLObject.createObjectURL(b);
          var audio = new Audio;
          audio.addEventListener("canplaythrough", (function() {
            finish(audio)
          }), false);
          audio.onerror = function audio_onerror(event) {
            if (done) return;
            console.log("warning: browser could not fully decode audio " + name + ", trying slower base64 approach");

            function encode64(data) {
              var BASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
              var PAD = "=";
              var ret = "";
              var leftchar = 0;
              var leftbits = 0;
              for (var i = 0; i < data.length; i++) {
                leftchar = leftchar << 8 | data[i];
                leftbits += 8;
                while (leftbits >= 6) {
                  var curr = leftchar >> leftbits - 6 & 63;
                  leftbits -= 6;
                  ret += BASE[curr]
                }
              }
              if (leftbits == 2) {
                ret += BASE[(leftchar & 3) << 4];
                ret += PAD + PAD
              } else if (leftbits == 4) {
                ret += BASE[(leftchar & 15) << 2];
                ret += PAD
              }
              return ret
            }
            audio.src = "data:audio/x-" + name.substr(-3) + ";base64," + encode64(byteArray);
            finish(audio)
          };
          audio.src = url;
          Browser.safeSetTimeout((function() {
            finish(audio)
          }), 1e4)
        } else {
          return fail()
        }
      };
      Module["preloadPlugins"].push(audioPlugin);

      function pointerLockChange() {
        Browser.pointerLock = document["pointerLockElement"] === Module["canvas"] || document["mozPointerLockElement"] === Module["canvas"] || document["webkitPointerLockElement"] === Module["canvas"] || document["msPointerLockElement"] === Module["canvas"]
      }
      var canvas = Module["canvas"];
      if (canvas) {
        canvas.requestPointerLock = canvas["requestPointerLock"] || canvas["mozRequestPointerLock"] || canvas["webkitRequestPointerLock"] || canvas["msRequestPointerLock"] || (function() {});
        canvas.exitPointerLock = document["exitPointerLock"] || document["mozExitPointerLock"] || document["webkitExitPointerLock"] || document["msExitPointerLock"] || (function() {});
        canvas.exitPointerLock = canvas.exitPointerLock.bind(document);
        document.addEventListener("pointerlockchange", pointerLockChange, false);
        document.addEventListener("mozpointerlockchange", pointerLockChange, false);
        document.addEventListener("webkitpointerlockchange", pointerLockChange, false);
        document.addEventListener("mspointerlockchange", pointerLockChange, false);
        if (Module["elementPointerLock"]) {
          canvas.addEventListener("click", (function(ev) {
            if (!Browser.pointerLock && Module["canvas"].requestPointerLock) {
              Module["canvas"].requestPointerLock();
              ev.preventDefault()
            }
          }), false)
        }
      }
    }),
    createContext: (function(canvas, useWebGL, setInModule, webGLContextAttributes) {
      if (useWebGL && Module.ctx && canvas == Module.canvas) return Module.ctx;
      var ctx;
      var contextHandle;
      if (useWebGL) {
        var contextAttributes = {
          antialias: false,
          alpha: false
        };
        if (webGLContextAttributes) {
          for (var attribute in webGLContextAttributes) {
            contextAttributes[attribute] = webGLContextAttributes[attribute]
          }
        }
        contextHandle = GL.createContext(canvas, contextAttributes);
        if (contextHandle) {
          ctx = GL.getContext(contextHandle).GLctx
        }
      } else {
        ctx = canvas.getContext("2d")
      }
      if (!ctx) return null;
      if (setInModule) {
        if (!useWebGL) assert(typeof GLctx === "undefined", "cannot set in module if GLctx is used, but we are a non-GL context that would replace it");
        Module.ctx = ctx;
        if (useWebGL) GL.makeContextCurrent(contextHandle);
        Module.useWebGL = useWebGL;
        Browser.moduleContextCreatedCallbacks.forEach((function(callback) {
          callback()
        }));
        Browser.init()
      }
      return ctx
    }),
    destroyContext: (function(canvas, useWebGL, setInModule) {}),
    fullscreenHandlersInstalled: false,
    lockPointer: undefined,
    resizeCanvas: undefined,
    requestFullscreen: (function(lockPointer, resizeCanvas, vrDevice) {
      Browser.lockPointer = lockPointer;
      Browser.resizeCanvas = resizeCanvas;
      Browser.vrDevice = vrDevice;
      if (typeof Browser.lockPointer === "undefined") Browser.lockPointer = true;
      if (typeof Browser.resizeCanvas === "undefined") Browser.resizeCanvas = false;
      if (typeof Browser.vrDevice === "undefined") Browser.vrDevice = null;
      var canvas = Module["canvas"];

      function fullscreenChange() {
        Browser.isFullscreen = false;
        var canvasContainer = canvas.parentNode;
        if ((document["fullscreenElement"] || document["mozFullScreenElement"] || document["msFullscreenElement"] || document["webkitFullscreenElement"] || document["webkitCurrentFullScreenElement"]) === canvasContainer) {
          canvas.exitFullscreen = document["exitFullscreen"] || document["cancelFullScreen"] || document["mozCancelFullScreen"] || document["msExitFullscreen"] || document["webkitCancelFullScreen"] || (function() {});
          canvas.exitFullscreen = canvas.exitFullscreen.bind(document);
          if (Browser.lockPointer) canvas.requestPointerLock();
          Browser.isFullscreen = true;
          if (Browser.resizeCanvas) Browser.setFullscreenCanvasSize()
        } else {
          canvasContainer.parentNode.insertBefore(canvas, canvasContainer);
          canvasContainer.parentNode.removeChild(canvasContainer);
          if (Browser.resizeCanvas) Browser.setWindowedCanvasSize()
        }
        if (Module["onFullScreen"]) Module["onFullScreen"](Browser.isFullscreen);
        if (Module["onFullscreen"]) Module["onFullscreen"](Browser.isFullscreen);
        Browser.updateCanvasDimensions(canvas)
      }
      if (!Browser.fullscreenHandlersInstalled) {
        Browser.fullscreenHandlersInstalled = true;
        document.addEventListener("fullscreenchange", fullscreenChange, false);
        document.addEventListener("mozfullscreenchange", fullscreenChange, false);
        document.addEventListener("webkitfullscreenchange", fullscreenChange, false);
        document.addEventListener("MSFullscreenChange", fullscreenChange, false)
      }
      var canvasContainer = document.createElement("div");
      canvas.parentNode.insertBefore(canvasContainer, canvas);
      canvasContainer.appendChild(canvas);
      canvasContainer.requestFullscreen = canvasContainer["requestFullscreen"] || canvasContainer["mozRequestFullScreen"] || canvasContainer["msRequestFullscreen"] || (canvasContainer["webkitRequestFullscreen"] ? (function() {
        canvasContainer["webkitRequestFullscreen"](Element["ALLOW_KEYBOARD_INPUT"])
      }) : null) || (canvasContainer["webkitRequestFullScreen"] ? (function() {
        canvasContainer["webkitRequestFullScreen"](Element["ALLOW_KEYBOARD_INPUT"])
      }) : null);
      if (vrDevice) {
        canvasContainer.requestFullscreen({
          vrDisplay: vrDevice
        })
      } else {
        canvasContainer.requestFullscreen()
      }
    }),
    requestFullScreen: (function(lockPointer, resizeCanvas, vrDevice) {
      Module.printErr("Browser.requestFullScreen() is deprecated. Please call Browser.requestFullscreen instead.");
      Browser.requestFullScreen = (function(lockPointer, resizeCanvas, vrDevice) {
        return Browser.requestFullscreen(lockPointer, resizeCanvas, vrDevice)
      });
      return Browser.requestFullscreen(lockPointer, resizeCanvas, vrDevice)
    }),
    nextRAF: 0,
    fakeRequestAnimationFrame: (function(func) {
      var now = Date.now();
      if (Browser.nextRAF === 0) {
        Browser.nextRAF = now + 1e3 / 60
      } else {
        while (now + 2 >= Browser.nextRAF) {
          Browser.nextRAF += 1e3 / 60
        }
      }
      var delay = Math.max(Browser.nextRAF - now, 0);
      setTimeout(func, delay)
    }),
    requestAnimationFrame: function requestAnimationFrame(func) {
      if (typeof window === "undefined") {
        Browser.fakeRequestAnimationFrame(func)
      } else {
        if (!window.requestAnimationFrame) {
          window.requestAnimationFrame = window["requestAnimationFrame"] || window["mozRequestAnimationFrame"] || window["webkitRequestAnimationFrame"] || window["msRequestAnimationFrame"] || window["oRequestAnimationFrame"] || Browser.fakeRequestAnimationFrame
        }
        window.requestAnimationFrame(func)
      }
    },
    safeCallback: (function(func) {
      return (function() {
        if (!ABORT) return func.apply(null, arguments)
      })
    }),
    allowAsyncCallbacks: true,
    queuedAsyncCallbacks: [],
    pauseAsyncCallbacks: (function() {
      Browser.allowAsyncCallbacks = false
    }),
    resumeAsyncCallbacks: (function() {
      Browser.allowAsyncCallbacks = true;
      if (Browser.queuedAsyncCallbacks.length > 0) {
        var callbacks = Browser.queuedAsyncCallbacks;
        Browser.queuedAsyncCallbacks = [];
        callbacks.forEach((function(func) {
          func()
        }))
      }
    }),
    safeRequestAnimationFrame: (function(func) {
      return Browser.requestAnimationFrame((function() {
        if (ABORT) return;
        if (Browser.allowAsyncCallbacks) {
          func()
        } else {
          Browser.queuedAsyncCallbacks.push(func)
        }
      }))
    }),
    safeSetTimeout: (function(func, timeout) {
      Module["noExitRuntime"] = true;
      return setTimeout((function() {
        if (ABORT) return;
        if (Browser.allowAsyncCallbacks) {
          func()
        } else {
          Browser.queuedAsyncCallbacks.push(func)
        }
      }), timeout)
    }),
    safeSetInterval: (function(func, timeout) {
      Module["noExitRuntime"] = true;
      return setInterval((function() {
        if (ABORT) return;
        if (Browser.allowAsyncCallbacks) {
          func()
        }
      }), timeout)
    }),
    getMimetype: (function(name) {
      return {
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "png": "image/png",
        "bmp": "image/bmp",
        "ogg": "audio/ogg",
        "wav": "audio/wav",
        "mp3": "audio/mpeg"
      }[name.substr(name.lastIndexOf(".") + 1)]
    }),
    getUserMedia: (function(func) {
      if (!window.getUserMedia) {
        window.getUserMedia = navigator["getUserMedia"] || navigator["mozGetUserMedia"]
      }
      window.getUserMedia(func)
    }),
    getMovementX: (function(event) {
      return event["movementX"] || event["mozMovementX"] || event["webkitMovementX"] || 0
    }),
    getMovementY: (function(event) {
      return event["movementY"] || event["mozMovementY"] || event["webkitMovementY"] || 0
    }),
    getMouseWheelDelta: (function(event) {
      var delta = 0;
      switch (event.type) {
        case "DOMMouseScroll":
          delta = event.detail;
          break;
        case "mousewheel":
          delta = event.wheelDelta;
          break;
        case "wheel":
          delta = event["deltaY"];
          break;
        default:
          throw "unrecognized mouse wheel event: " + event.type
      }
      return delta
    }),
    mouseX: 0,
    mouseY: 0,
    mouseMovementX: 0,
    mouseMovementY: 0,
    touches: {},
    lastTouches: {},
    calculateMouseEvent: (function(event) {
      if (Browser.pointerLock) {
        if (event.type != "mousemove" && "mozMovementX" in event) {
          Browser.mouseMovementX = Browser.mouseMovementY = 0
        } else {
          Browser.mouseMovementX = Browser.getMovementX(event);
          Browser.mouseMovementY = Browser.getMovementY(event)
        }
        if (typeof SDL != "undefined") {
          Browser.mouseX = SDL.mouseX + Browser.mouseMovementX;
          Browser.mouseY = SDL.mouseY + Browser.mouseMovementY
        } else {
          Browser.mouseX += Browser.mouseMovementX;
          Browser.mouseY += Browser.mouseMovementY
        }
      } else {
        var rect = Module["canvas"].getBoundingClientRect();
        var cw = Module["canvas"].width;
        var ch = Module["canvas"].height;
        var scrollX = typeof window.scrollX !== "undefined" ? window.scrollX : window.pageXOffset;
        var scrollY = typeof window.scrollY !== "undefined" ? window.scrollY : window.pageYOffset;
        if (event.type === "touchstart" || event.type === "touchend" || event.type === "touchmove") {
          var touch = event.touch;
          if (touch === undefined) {
            return
          }
          var adjustedX = touch.pageX - (scrollX + rect.left);
          var adjustedY = touch.pageY - (scrollY + rect.top);
          adjustedX = adjustedX * (cw / rect.width);
          adjustedY = adjustedY * (ch / rect.height);
          var coords = {
            x: adjustedX,
            y: adjustedY
          };
          if (event.type === "touchstart") {
            Browser.lastTouches[touch.identifier] = coords;
            Browser.touches[touch.identifier] = coords
          } else if (event.type === "touchend" || event.type === "touchmove") {
            var last = Browser.touches[touch.identifier];
            if (!last) last = coords;
            Browser.lastTouches[touch.identifier] = last;
            Browser.touches[touch.identifier] = coords
          }
          return
        }
        var x = event.pageX - (scrollX + rect.left);
        var y = event.pageY - (scrollY + rect.top);
        x = x * (cw / rect.width);
        y = y * (ch / rect.height);
        Browser.mouseMovementX = x - Browser.mouseX;
        Browser.mouseMovementY = y - Browser.mouseY;
        Browser.mouseX = x;
        Browser.mouseY = y
      }
    }),
    asyncLoad: (function(url, onload, onerror, noRunDep) {
      var dep = !noRunDep ? getUniqueRunDependency("al " + url) : "";
      Module["readAsync"](url, (function(arrayBuffer) {
        assert(arrayBuffer, 'Loading data file "' + url + '" failed (no arrayBuffer).');
        onload(new Uint8Array(arrayBuffer));
        if (dep) removeRunDependency(dep)
      }), (function(event) {
        if (onerror) {
          onerror()
        } else {
          throw 'Loading data file "' + url + '" failed.'
        }
      }));
      if (dep) addRunDependency(dep)
    }),
    resizeListeners: [],
    updateResizeListeners: (function() {
      var canvas = Module["canvas"];
      Browser.resizeListeners.forEach((function(listener) {
        listener(canvas.width, canvas.height)
      }))
    }),
    setCanvasSize: (function(width, height, noUpdates) {
      var canvas = Module["canvas"];
      Browser.updateCanvasDimensions(canvas, width, height);
      if (!noUpdates) Browser.updateResizeListeners()
    }),
    windowedWidth: 0,
    windowedHeight: 0,
    setFullscreenCanvasSize: (function() {
      if (typeof SDL != "undefined") {
        var flags = HEAPU32[SDL.screen >> 2];
        flags = flags | 8388608;
        HEAP32[SDL.screen >> 2] = flags
      }
      Browser.updateResizeListeners()
    }),
    setWindowedCanvasSize: (function() {
      if (typeof SDL != "undefined") {
        var flags = HEAPU32[SDL.screen >> 2];
        flags = flags & ~8388608;
        HEAP32[SDL.screen >> 2] = flags
      }
      Browser.updateResizeListeners()
    }),
    updateCanvasDimensions: (function(canvas, wNative, hNative) {
      if (wNative && hNative) {
        canvas.widthNative = wNative;
        canvas.heightNative = hNative
      } else {
        wNative = canvas.widthNative;
        hNative = canvas.heightNative
      }
      var w = wNative;
      var h = hNative;
      if (Module["forcedAspectRatio"] && Module["forcedAspectRatio"] > 0) {
        if (w / h < Module["forcedAspectRatio"]) {
          w = Math.round(h * Module["forcedAspectRatio"])
        } else {
          h = Math.round(w / Module["forcedAspectRatio"])
        }
      }
      if ((document["fullscreenElement"] || document["mozFullScreenElement"] || document["msFullscreenElement"] || document["webkitFullscreenElement"] || document["webkitCurrentFullScreenElement"]) === canvas.parentNode && typeof screen != "undefined") {
        var factor = Math.min(screen.width / w, screen.height / h);
        w = Math.round(w * factor);
        h = Math.round(h * factor)
      }
      if (Browser.resizeCanvas) {
        if (canvas.width != w) canvas.width = w;
        if (canvas.height != h) canvas.height = h;
        if (typeof canvas.style != "undefined") {
          canvas.style.removeProperty("width");
          canvas.style.removeProperty("height")
        }
      } else {
        if (canvas.width != wNative) canvas.width = wNative;
        if (canvas.height != hNative) canvas.height = hNative;
        if (typeof canvas.style != "undefined") {
          if (w != wNative || h != hNative) {
            canvas.style.setProperty("width", w + "px", "important");
            canvas.style.setProperty("height", h + "px", "important")
          } else {
            canvas.style.removeProperty("width");
            canvas.style.removeProperty("height")
          }
        }
      }
    }),
    wgetRequests: {},
    nextWgetRequestHandle: 0,
    getNextWgetRequestHandle: (function() {
      var handle = Browser.nextWgetRequestHandle;
      Browser.nextWgetRequestHandle++;
      return handle
    })
  };
  var EmterpreterAsync = {
    initted: false,
    state: 0,
    saveStack: "",
    yieldCallbacks: [],
    postAsync: null,
    asyncFinalizers: [],
    ensureInit: (function() {
      if (this.initted) return;
      this.initted = true
    }),
    setState: (function(s) {
      this.ensureInit();
      this.state = s;
      Module["setAsyncState"](s)
    }),
    handle: (function(doAsyncOp, yieldDuring) {
      Module["noExitRuntime"] = true;
      if (EmterpreterAsync.state === 0) {
        var stack = new Int32Array(HEAP32.subarray(EMTSTACKTOP >> 2, Module["emtStackSave"]() >> 2));
        var stacktop = Module["stackSave"]();
        var resumedCallbacksForYield = false;

        function resumeCallbacksForYield() {
          if (resumedCallbacksForYield) return;
          resumedCallbacksForYield = true;
          EmterpreterAsync.yieldCallbacks.forEach((function(func) {
            func()
          }));
          Browser.resumeAsyncCallbacks()
        }
        var callingDoAsyncOp = 1;
        doAsyncOp(function resume(post) {
          if (ABORT) {
            return
          }
          if (callingDoAsyncOp) {
            assert(callingDoAsyncOp === 1);
            callingDoAsyncOp++;
            setTimeout((function() {
              resume(post)
            }), 0);
            return
          }
          assert(EmterpreterAsync.state === 1 || EmterpreterAsync.state === 3);
          EmterpreterAsync.setState(3);
          if (yieldDuring) {
            resumeCallbacksForYield()
          }
          HEAP32.set(stack, EMTSTACKTOP >> 2);
          EmterpreterAsync.setState(2);
          if (Browser.mainLoop.func) {
            Browser.mainLoop.resume()
          }
          assert(!EmterpreterAsync.postAsync);
          EmterpreterAsync.postAsync = post || null;
          Module["emterpret"](stack[0]);
          if (!yieldDuring && EmterpreterAsync.state === 0) {
            Browser.resumeAsyncCallbacks()
          }
          if (EmterpreterAsync.state === 0) {
            EmterpreterAsync.asyncFinalizers.forEach((function(func) {
              func()
            }));
            EmterpreterAsync.asyncFinalizers.length = 0
          }
        });
        callingDoAsyncOp = 0;
        EmterpreterAsync.setState(1);
        if (Browser.mainLoop.func) {
          Browser.mainLoop.pause()
        }
        if (yieldDuring) {
          setTimeout((function() {
            resumeCallbacksForYield()
          }), 0)
        } else {
          Browser.pauseAsyncCallbacks()
        }
      } else {
        assert(EmterpreterAsync.state === 2);
        EmterpreterAsync.setState(0);
        if (EmterpreterAsync.postAsync) {
          var ret = EmterpreterAsync.postAsync();
          EmterpreterAsync.postAsync = null;
          return ret
        }
      }
    })
  };

  function _emscripten_sleep(ms) {
    EmterpreterAsync.handle((function(resume) {
      setTimeout((function() {
        resume()
      }), ms)
    }))
  }
  var _environ = STATICTOP;
  STATICTOP += 16;

  function ___buildEnvironment(env) {
    var MAX_ENV_VALUES = 64;
    var TOTAL_ENV_SIZE = 1024;
    var poolPtr;
    var envPtr;
    if (!___buildEnvironment.called) {
      ___buildEnvironment.called = true;
      ENV["USER"] = ENV["LOGNAME"] = "web_user";
      ENV["PATH"] = "/";
      ENV["PWD"] = "/";
      ENV["HOME"] = "/home/web_user";
      ENV["LANG"] = "C.UTF-8";
      ENV["_"] = Module["thisProgram"];
      poolPtr = staticAlloc(TOTAL_ENV_SIZE);
      envPtr = staticAlloc(MAX_ENV_VALUES * 4);
      HEAP32[envPtr >> 2] = poolPtr;
      HEAP32[_environ >> 2] = envPtr
    } else {
      envPtr = HEAP32[_environ >> 2];
      poolPtr = HEAP32[envPtr >> 2]
    }
    var strings = [];
    var totalSize = 0;
    for (var key in env) {
      if (typeof env[key] === "string") {
        var line = key + "=" + env[key];
        strings.push(line);
        totalSize += line.length
      }
    }
    if (totalSize > TOTAL_ENV_SIZE) {
      throw new Error("Environment size exceeded TOTAL_ENV_SIZE!")
    }
    var ptrSize = 4;
    for (var i = 0; i < strings.length; i++) {
      var line = strings[i];
      writeAsciiToMemory(line, poolPtr);
      HEAP32[envPtr + i * ptrSize >> 2] = poolPtr;
      poolPtr += line.length + 1
    }
    HEAP32[envPtr + strings.length * ptrSize >> 2] = 0
  }
  var ENV = {};

  function _getenv(name) {
    if (name === 0) return 0;
    name = Pointer_stringify(name);
    if (!ENV.hasOwnProperty(name)) return 0;
    if (_getenv.ret) _free(_getenv.ret);
    _getenv.ret = allocateUTF8(ENV[name]);
    return _getenv.ret
  }

  function _getpwuid(uid) {
    return 0
  }
  var _llvm_fabs_f64 = Math_abs;
  var _llvm_pow_f32 = Math_pow;
  var _llvm_pow_f64 = Math_pow;

  function _emscripten_memcpy_big(dest, src, num) {
    HEAPU8.set(HEAPU8.subarray(src, src + num), dest);
    return dest
  }

  function _usleep(useconds) {
    var msec = useconds / 1e3;
    if ((ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) && self["performance"] && self["performance"]["now"]) {
      var start = self["performance"]["now"]();
      while (self["performance"]["now"]() - start < msec) {}
    } else {
      var start = Date.now();
      while (Date.now() - start < msec) {}
    }
    return 0
  }
  FS.staticInit();
  __ATINIT__.unshift((function() {
    if (!Module["noFSInit"] && !FS.init.initialized) FS.init()
  }));
  __ATMAIN__.push((function() {
    FS.ignorePermissions = false
  }));
  __ATEXIT__.push((function() {
    FS.quit()
  }));
  Module["FS_createFolder"] = FS.createFolder;
  Module["FS_createPath"] = FS.createPath;
  Module["FS_createDataFile"] = FS.createDataFile;
  Module["FS_createPreloadedFile"] = FS.createPreloadedFile;
  Module["FS_createLazyFile"] = FS.createLazyFile;
  Module["FS_createLink"] = FS.createLink;
  Module["FS_createDevice"] = FS.createDevice;
  Module["FS_unlink"] = FS.unlink;
  __ATINIT__.unshift((function() {
    TTY.init()
  }));
  __ATEXIT__.push((function() {
    TTY.shutdown()
  }));
  if (ENVIRONMENT_IS_NODE) {
    var fs = require("fs");
    var NODEJS_PATH = require("path");
    NODEFS.staticInit()
  }
  Module["requestFullScreen"] = function Module_requestFullScreen(lockPointer, resizeCanvas, vrDevice) {
    Module.printErr("Module.requestFullScreen is deprecated. Please call Module.requestFullscreen instead.");
    Module["requestFullScreen"] = Module["requestFullscreen"];
    Browser.requestFullScreen(lockPointer, resizeCanvas, vrDevice)
  };
  Module["requestFullscreen"] = function Module_requestFullscreen(lockPointer, resizeCanvas, vrDevice) {
    Browser.requestFullscreen(lockPointer, resizeCanvas, vrDevice)
  };
  Module["requestAnimationFrame"] = function Module_requestAnimationFrame(func) {
    Browser.requestAnimationFrame(func)
  };
  Module["setCanvasSize"] = function Module_setCanvasSize(width, height, noUpdates) {
    Browser.setCanvasSize(width, height, noUpdates)
  };
  Module["pauseMainLoop"] = function Module_pauseMainLoop() {
    Browser.mainLoop.pause()
  };
  Module["resumeMainLoop"] = function Module_resumeMainLoop() {
    Browser.mainLoop.resume()
  };
  Module["getUserMedia"] = function Module_getUserMedia() {
    Browser.getUserMedia()
  };
  Module["createContext"] = function Module_createContext(canvas, useWebGL, setInModule, webGLContextAttributes) {
    return Browser.createContext(canvas, useWebGL, setInModule, webGLContextAttributes)
  };
  if (ENVIRONMENT_IS_NODE) {
    _emscripten_get_now = function _emscripten_get_now_actual() {
      var t = process["hrtime"]();
      return t[0] * 1e3 + t[1] / 1e6
    }
  } else if (typeof dateNow !== "undefined") {
    _emscripten_get_now = dateNow
  } else if (typeof self === "object" && self["performance"] && typeof self["performance"]["now"] === "function") {
    _emscripten_get_now = (function() {
      return self["performance"]["now"]()
    })
  } else if (typeof performance === "object" && typeof performance["now"] === "function") {
    _emscripten_get_now = (function() {
      return performance["now"]()
    })
  } else {
    _emscripten_get_now = Date.now
  }
  ___buildEnvironment(ENV);
  DYNAMICTOP_PTR = staticAlloc(4);
  STACK_BASE = STACKTOP = alignMemory(STATICTOP);
  STACK_MAX = STACK_BASE + TOTAL_STACK;
  DYNAMIC_BASE = alignMemory(STACK_MAX);
  HEAP32[DYNAMICTOP_PTR >> 2] = DYNAMIC_BASE;
  staticSealed = true;
  var ASSERTIONS = false;

  function intArrayFromString(stringy, dontAddNull, length) {
    var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1;
    var u8array = new Array(len);
    var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
    if (dontAddNull) u8array.length = numBytesWritten;
    return u8array
  }

  function intArrayToString(array) {
    var ret = [];
    for (var i = 0; i < array.length; i++) {
      var chr = array[i];
      if (chr > 255) {
        if (ASSERTIONS) {
          assert(false, "Character code " + chr + " (" + String.fromCharCode(chr) + ")  at offset " + i + " not in 0x00-0xFF.")
        }
        chr &= 255
      }
      ret.push(String.fromCharCode(chr))
    }
    return ret.join("")
  }
  var decodeBase64 = typeof atob === "function" ? atob : (function(input) {
    var keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    var output = "";
    var chr1, chr2, chr3;
    var enc1, enc2, enc3, enc4;
    var i = 0;
    input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");
    do {
      enc1 = keyStr.indexOf(input.charAt(i++));
      enc2 = keyStr.indexOf(input.charAt(i++));
      enc3 = keyStr.indexOf(input.charAt(i++));
      enc4 = keyStr.indexOf(input.charAt(i++));
      chr1 = enc1 << 2 | enc2 >> 4;
      chr2 = (enc2 & 15) << 4 | enc3 >> 2;
      chr3 = (enc3 & 3) << 6 | enc4;
      output = output + String.fromCharCode(chr1);
      if (enc3 !== 64) {
        output = output + String.fromCharCode(chr2)
      }
      if (enc4 !== 64) {
        output = output + String.fromCharCode(chr3)
      }
    } while (i < input.length);
    return output
  });

  function intArrayFromBase64(s) {
    if (typeof ENVIRONMENT_IS_NODE === "boolean" && ENVIRONMENT_IS_NODE) {
      var buf;
      try {
        buf = Buffer.from(s, "base64")
      } catch (_) {
        buf = new Buffer(s, "base64")
      }
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
    }
    try {
      var decoded = decodeBase64(s);
      var bytes = new Uint8Array(decoded.length);
      for (var i = 0; i < decoded.length; ++i) {
        bytes[i] = decoded.charCodeAt(i)
      }
      return bytes
    } catch (_) {
      throw new Error("Converting base64 string to bytes failed.")
    }
  }

  function tryParseAsDataURI(filename) {
    if (!isDataURI(filename)) {
      return
    }
    return intArrayFromBase64(filename.slice(dataURIPrefix.length))
  }

  function invoke_ii(index, a1) {
    try {
      return Module["dynCall_ii"](index, a1)
    } catch (e) {
      if (typeof e !== "number" && e !== "longjmp") throw e;
      Module["setThrew"](1, 0)
    }
  }

  function invoke_iii(index, a1, a2) {
    try {
      return Module["dynCall_iii"](index, a1, a2)
    } catch (e) {
      if (typeof e !== "number" && e !== "longjmp") throw e;
      Module["setThrew"](1, 0)
    }
  }

  function invoke_iiii(index, a1, a2, a3) {
    try {
      return Module["dynCall_iiii"](index, a1, a2, a3)
    } catch (e) {
      if (typeof e !== "number" && e !== "longjmp") throw e;
      Module["setThrew"](1, 0)
    }
  }

  function invoke_vii(index, a1, a2) {
    try {
      Module["dynCall_vii"](index, a1, a2)
    } catch (e) {
      if (typeof e !== "number" && e !== "longjmp") throw e;
      Module["setThrew"](1, 0)
    }
  }
  Module.asmGlobalArg = {
    "Math": Math,
    "Int8Array": Int8Array,
    "Int16Array": Int16Array,
    "Int32Array": Int32Array,
    "Uint8Array": Uint8Array,
    "Uint16Array": Uint16Array,
    "Uint32Array": Uint32Array,
    "Float32Array": Float32Array,
    "Float64Array": Float64Array,
    "NaN": NaN,
    "Infinity": Infinity
  };
  Module.asmLibraryArg = {
    "abort": abort,
    "assert": assert,
    "enlargeMemory": enlargeMemory,
    "getTotalMemory": getTotalMemory,
    "abortOnCannotGrowMemory": abortOnCannotGrowMemory,
    "invoke_ii": invoke_ii,
    "invoke_iii": invoke_iii,
    "invoke_iiii": invoke_iiii,
    "invoke_vii": invoke_vii,
    "___buildEnvironment": ___buildEnvironment,
    "___setErrNo": ___setErrNo,
    "___syscall140": ___syscall140,
    "___syscall146": ___syscall146,
    "___syscall183": ___syscall183,
    "___syscall195": ___syscall195,
    "___syscall199": ___syscall199,
    "___syscall202": ___syscall202,
    "___syscall221": ___syscall221,
    "___syscall3": ___syscall3,
    "___syscall4": ___syscall4,
    "___syscall5": ___syscall5,
    "___syscall54": ___syscall54,
    "___syscall6": ___syscall6,
    "_emscripten_asm_const_i": _emscripten_asm_const_i,
    "_emscripten_asm_const_iii": _emscripten_asm_const_iii,
    "_emscripten_asm_const_iiii": _emscripten_asm_const_iiii,
    "_emscripten_get_now": _emscripten_get_now,
    "_emscripten_memcpy_big": _emscripten_memcpy_big,
    "_emscripten_set_main_loop": _emscripten_set_main_loop,
    "_emscripten_set_main_loop_timing": _emscripten_set_main_loop_timing,
    "_emscripten_sleep": _emscripten_sleep,
    "_getenv": _getenv,
    "_getpwuid": _getpwuid,
    "_llvm_fabs_f64": _llvm_fabs_f64,
    "_llvm_pow_f32": _llvm_pow_f32,
    "_llvm_pow_f64": _llvm_pow_f64,
    "_usleep": _usleep,
    "DYNAMICTOP_PTR": DYNAMICTOP_PTR,
    "tempDoublePtr": tempDoublePtr,
    "ABORT": ABORT,
    "STACKTOP": STACKTOP,
    "STACK_MAX": STACK_MAX,
    "cttz_i8": cttz_i8
  };
  Module.asmLibraryArg["EMTSTACKTOP"] = EMTSTACKTOP;
  Module.asmLibraryArg["EMT_STACK_MAX"] = EMT_STACK_MAX;
  Module.asmLibraryArg["eb"] = eb; // EMSCRIPTEN_START_ASM
  var asm = ( /** @suppress {uselessCode} */ function(global, env, buffer) {
    "use asm";
    var a = new global.Int8Array(buffer);
    var b = new global.Int16Array(buffer);
    var c = new global.Int32Array(buffer);
    var d = new global.Uint8Array(buffer);
    var e = new global.Uint16Array(buffer);
    var f = new global.Uint32Array(buffer);
    var g = new global.Float32Array(buffer);
    var h = new global.Float64Array(buffer);
    var i = env.DYNAMICTOP_PTR | 0;
    var j = env.tempDoublePtr | 0;
    var k = env.ABORT | 0;
    var l = env.STACKTOP | 0;
    var m = env.STACK_MAX | 0;
    var n = env.cttz_i8 | 0;
    var o = 0;
    var p = 0;
    var q = 0;
    var r = 0;
    var s = global.NaN,
      t = global.Infinity;
    var u = 0,
      v = 0,
      w = 0,
      x = 0,
      y = 0.0;
    var z = 0;
    var A = global.Math.floor;
    var B = global.Math.abs;
    var C = global.Math.sqrt;
    var D = global.Math.pow;
    var E = global.Math.cos;
    var F = global.Math.sin;
    var G = global.Math.tan;
    var H = global.Math.acos;
    var I = global.Math.asin;
    var J = global.Math.atan;
    var K = global.Math.atan2;
    var L = global.Math.exp;
    var M = global.Math.log;
    var N = global.Math.ceil;
    var O = global.Math.imul;
    var P = global.Math.min;
    var Q = global.Math.max;
    var R = global.Math.clz32;
    var S = env.abort;
    var T = env.assert;
    var U = env.enlargeMemory;
    var V = env.getTotalMemory;
    var W = env.abortOnCannotGrowMemory;
    var X = env.invoke_ii;
    var Y = env.invoke_iii;
    var Z = env.invoke_iiii;
    var _ = env.invoke_vii;
    var $ = env.___buildEnvironment;
    var aa = env.___setErrNo;
    var ba = env.___syscall140;
    var ca = env.___syscall146;
    var da = env.___syscall183;
    var ea = env.___syscall195;
    var fa = env.___syscall199;
    var ga = env.___syscall202;
    var ha = env.___syscall221;
    var ia = env.___syscall3;
    var ja = env.___syscall4;
    var ka = env.___syscall5;
    var la = env.___syscall54;
    var ma = env.___syscall6;
    var na = env._emscripten_asm_const_i;
    var oa = env._emscripten_asm_const_iii;
    var pa = env._emscripten_asm_const_iiii;
    var qa = env._emscripten_get_now;
    var ra = env._emscripten_memcpy_big;
    var sa = env._emscripten_set_main_loop;
    var ta = env._emscripten_set_main_loop_timing;
    var ua = env._emscripten_sleep;
    var va = env._getenv;
    var wa = env._getpwuid;
    var xa = env._llvm_fabs_f64;
    var ya = env._llvm_pow_f32;
    var za = env._llvm_pow_f64;
    var Aa = env._usleep;
    var Ba = 0.0;
    var Ca = 0;
    var Da = env.EMTSTACKTOP | 0;
    var Ea = env.EMT_STACK_MAX | 0;
    var Fa = env.eb | 0;
    // EMSCRIPTEN_START_FUNCS
    function Ka(b) {
      b = b | 0;
      var f = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0.0;
      c[Da >> 2] = b;
      f = Da + 8 | 0;
      h = e[b + 2 >> 1] | 0;
      Da = Da + (h + 1 << 3) | 0;
      if ((Ca | 0) != 2) {} else {
        b = (c[f - 4 >> 2] | 0) - 8 | 0
      }
      b = b + 4 | 0;
      while (1) {
        b = b + 4 | 0;
        g = c[b >> 2] | 0;
        h = g >> 8 & 255;
        i = g >> 16 & 255;
        j = g >>> 24;
        switch (g & 255) {
          case 0:
            c[f + (h << 3) >> 2] = c[f + (i << 3) >> 2] | 0;
            break;
          case 1:
            c[f + (h << 3) >> 2] = g >> 16;
            break;
          case 2:
            b = b + 4 | 0;
            c[f + (h << 3) >> 2] = c[b >> 2] | 0;
            break;
          case 4:
            c[f + (h << 3) >> 2] = (c[f + (i << 3) >> 2] | 0) - (c[f + (j << 3) >> 2] | 0) | 0;
            break;
          case 7:
            c[f + (h << 3) >> 2] = (c[f + (i << 3) >> 2] >>> 0) / (c[f + (j << 3) >> 2] >>> 0) >>> 0;
            break;
          case 9:
            c[f + (h << 3) >> 2] = (c[f + (i << 3) >> 2] >>> 0) % (c[f + (j << 3) >> 2] >>> 0) >>> 0;
            break;
          case 15:
            c[f + (h << 3) >> 2] = (c[f + (i << 3) >> 2] | 0) < (c[f + (j << 3) >> 2] | 0) | 0;
            break;
          case 19:
            c[f + (h << 3) >> 2] = (c[f + (i << 3) >> 2] | 0) & (c[f + (j << 3) >> 2] | 0);
            break;
          case 25:
            c[f + (h << 3) >> 2] = (c[f + (i << 3) >> 2] | 0) + (g >> 24) | 0;
            break;
          case 32:
            c[f + (h << 3) >> 2] = (c[f + (i << 3) >> 2] | 0) == g >> 24 | 0;
            break;
          case 33:
            c[f + (h << 3) >> 2] = (c[f + (i << 3) >> 2] | 0) != g >> 24 | 0;
            break;
          case 34:
            c[f + (h << 3) >> 2] = (c[f + (i << 3) >> 2] | 0) < g >> 24 | 0;
            break;
          case 38:
            c[f + (h << 3) >> 2] = (c[f + (i << 3) >> 2] | 0) & g >> 24;
            break;
          case 41:
            c[f + (h << 3) >> 2] = (c[f + (i << 3) >> 2] | 0) << j;
            break;
          case 43:
            c[f + (h << 3) >> 2] = (c[f + (i << 3) >> 2] | 0) >>> j;
            break;
          case 48:
            if (c[f + (i << 3) >> 2] >>> 0 < c[f + (j << 3) >> 2] >>> 0) {
              b = b + 4 | 0
            } else {
              b = c[b + 4 >> 2] | 0;
              b = b - 4 | 0;
              continue
            }
            break;
          case 78:
            c[f + (h << 3) >> 2] = a[c[f + (i << 3) >> 2] >> 0];
            break;
          case 82:
            c[f + (h << 3) >> 2] = c[c[f + (i << 3) >> 2] >> 2];
            break;
          case 85:
            c[c[f + (h << 3) >> 2] >> 2] = c[f + (i << 3) >> 2] | 0;
            break;
          case 106:
            c[f + (h << 3) >> 2] = c[(c[f + (i << 3) >> 2] | 0) + (g >> 24) >> 2];
            break;
          case 109:
            c[(c[f + (h << 3) >> 2] | 0) + (i << 24 >> 24) >> 2] = c[f + (j << 3) >> 2] | 0;
            break;
          case 119:
            b = b + (g >> 16 << 2) | 0;
            b = b - 4 | 0;
            continue;
            break;
          case 120:
            if (c[f + (h << 3) >> 2] | 0) {
              b = b + (g >> 16 << 2) | 0;
              b = b - 4 | 0;
              continue
            }
            break;
          case 121:
            if (!(c[f + (h << 3) >> 2] | 0)) {
              b = b + (g >> 16 << 2) | 0;
              b = b - 4 | 0;
              continue
            }
            break;
          case 135:
            switch (g >>> 16 | 0) {
              case 0:
                {
                  c[f - 4 >> 2] = b;j = Oc(c[f + (d[b + 4 >> 0] << 3) >> 2] | 0) | 0;
                  if ((Ca | 0) == 1) {
                    Da = f - 8 | 0;
                    return
                  } else c[f + (h << 3) >> 2] = j;b = b + 4 | 0;
                  continue
                }
              case 1:
                {
                  c[f - 4 >> 2] = b;j = Jb(c[f + (d[b + 4 >> 0] << 3) >> 2] | 0) | 0;
                  if ((Ca | 0) == 1) {
                    Da = f - 8 | 0;
                    return
                  } else c[f + (h << 3) >> 2] = j;b = b + 4 | 0;
                  continue
                }
              case 2:
                {
                  c[f - 4 >> 2] = b;j = ge(c[f + (d[b + 4 >> 0] << 3) >> 2] | 0, c[f + (d[b + 5 >> 0] << 3) >> 2] | 0) | 0;
                  if ((Ca | 0) == 1) {
                    Da = f - 8 | 0;
                    return
                  } else c[f + (h << 3) >> 2] = j;b = b + 4 | 0;
                  continue
                }
              case 3:
                {
                  c[f - 4 >> 2] = b;Ff();
                  if ((Ca | 0) == 1) {
                    Da = f - 8 | 0;
                    return
                  };
                  continue
                }
              case 4:
                {
                  c[f - 4 >> 2] = b;j = Zf() | 0;
                  if ((Ca | 0) == 1) {
                    Da = f - 8 | 0;
                    return
                  } else c[f + (h << 3) >> 2] = j;
                  continue
                }
              case 5:
                {
                  c[f - 4 >> 2] = b;j = fc(c[f + (d[b + 4 >> 0] << 3) >> 2] | 0, c[f + (d[b + 5 >> 0] << 3) >> 2] | 0, c[f + (d[b + 6 >> 0] << 3) >> 2] | 0) | 0;
                  if ((Ca | 0) == 1) {
                    Da = f - 8 | 0;
                    return
                  } else c[f + (h << 3) >> 2] = j;b = b + 4 | 0;
                  continue
                }
              case 6:
                {
                  c[f - 4 >> 2] = b;j = La(c[f + (d[b + 4 >> 0] << 3) >> 2] | 0) | 0;
                  if ((Ca | 0) == 1) {
                    Da = f - 8 | 0;
                    return
                  } else c[f + (h << 3) >> 2] = j;b = b + 4 | 0;
                  continue
                }
              case 7:
                {
                  c[f - 4 >> 2] = b;j = Ec() | 0;
                  if ((Ca | 0) == 1) {
                    Da = f - 8 | 0;
                    return
                  } else c[f + (h << 3) >> 2] = j;
                  continue
                }
              case 8:
                {
                  c[f - 4 >> 2] = b;j = Gd(c[f + (d[b + 4 >> 0] << 3) >> 2] | 0) | 0;
                  if ((Ca | 0) == 1) {
                    Da = f - 8 | 0;
                    return
                  } else c[f + (h << 3) >> 2] = j;b = b + 4 | 0;
                  continue
                }
              case 9:
                {
                  c[f - 4 >> 2] = b;Fe();
                  if ((Ca | 0) == 1) {
                    Da = f - 8 | 0;
                    return
                  };
                  continue
                }
              case 10:
                {
                  c[f - 4 >> 2] = b;j = Mb(c[f + (d[b + 4 >> 0] << 3) >> 2] | 0) | 0;
                  if ((Ca | 0) == 1) {
                    Da = f - 8 | 0;
                    return
                  } else c[f + (h << 3) >> 2] = j;b = b + 4 | 0;
                  continue
                }
              case 11:
                {
                  c[f - 4 >> 2] = b;j = Qf() | 0;
                  if ((Ca | 0) == 1) {
                    Da = f - 8 | 0;
                    return
                  } else c[f + (h << 3) >> 2] = j;
                  continue
                }
              case 12:
                {
                  c[f - 4 >> 2] = b;j = Db(c[f + (d[b + 4 >> 0] << 3) >> 2] | 0) | 0;
                  if ((Ca | 0) == 1) {
                    Da = f - 8 | 0;
                    return
                  } else c[f + (h << 3) >> 2] = j;b = b + 4 | 0;
                  continue
                }
              case 13:
                {
                  c[f - 4 >> 2] = b;j = $b(c[f + (d[b + 4 >> 0] << 3) >> 2] | 0, c[f + (d[b + 5 >> 0] << 3) >> 2] | 0, c[f + (d[b + 6 >> 0] << 3) >> 2] | 0) | 0;
                  if ((Ca | 0) == 1) {
                    Da = f - 8 | 0;
                    return
                  } else c[f + (h << 3) >> 2] = j;b = b + 4 | 0;
                  continue
                }
              case 14:
                {
                  c[f - 4 >> 2] = b;j = Zb(c[f + (d[b + 4 >> 0] << 3) >> 2] | 0, c[f + (d[b + 5 >> 0] << 3) >> 2] | 0) | 0;
                  if ((Ca | 0) == 1) {
                    Da = f - 8 | 0;
                    return
                  } else c[f + (h << 3) >> 2] = j;b = b + 4 | 0;
                  continue
                }
              case 15:
                {
                  c[f - 4 >> 2] = b;j = na(c[f + (d[b + 4 >> 0] << 3) >> 2] | 0) | 0;
                  if ((Ca | 0) == 1) {
                    Da = f - 8 | 0;
                    return
                  } else c[f + (h << 3) >> 2] = j;b = b + 4 | 0;
                  continue
                }
              case 16:
                {
                  c[f - 4 >> 2] = b;j = tb(c[f + (d[b + 4 >> 0] << 3) >> 2] | 0, c[f + (d[b + 5 >> 0] << 3) >> 2] | 0) | 0;
                  if ((Ca | 0) == 1) {
                    Da = f - 8 | 0;
                    return
                  } else c[f + (h << 3) >> 2] = j;b = b + 4 | 0;
                  continue
                }
              case 17:
                {
                  c[f - 4 >> 2] = b;Hf(c[f + (d[b + 4 >> 0] << 3) >> 2] | 0);
                  if ((Ca | 0) == 1) {
                    Da = f - 8 | 0;
                    return
                  };b = b + 4 | 0;
                  continue
                }
              case 18:
                {
                  c[f - 4 >> 2] = b;j = pc(c[f + (d[b + 4 >> 0] << 3) >> 2] | 0, c[f + (d[b + 5 >> 0] << 3) >> 2] | 0, c[f + (d[b + 6 >> 0] << 3) >> 2] | 0) | 0;
                  if ((Ca | 0) == 1) {
                    Da = f - 8 | 0;
                    return
                  } else c[f + (h << 3) >> 2] = j;b = b + 4 | 0;
                  continue
                }
              case 19:
                {
                  c[f - 4 >> 2] = b;j = pa(c[f + (d[b + 4 >> 0] << 3) >> 2] | 0, c[f + (d[b + 5 >> 0] << 3) >> 2] | 0, c[f + (d[b + 6 >> 0] << 3) >> 2] | 0, c[f + (d[b + 7 >> 0] << 3) >> 2] | 0) | 0;
                  if ((Ca | 0) == 1) {
                    Da = f - 8 | 0;
                    return
                  } else c[f + (h << 3) >> 2] = j;b = b + 4 | 0;
                  continue
                }
              case 20:
                {
                  c[f - 4 >> 2] = b;j = Ha[c[f + (d[b + 4 >> 0] << 3) >> 2] & 31](c[f + (d[b + 5 >> 0] << 3) >> 2] | 0, c[f + (d[b + 6 >> 0] << 3) >> 2] | 0) | 0;
                  if ((Ca | 0) == 1) {
                    Da = f - 8 | 0;
                    return
                  } else c[f + (h << 3) >> 2] = j;b = b + 4 | 0;
                  continue
                }
              case 21:
                {
                  c[f - 4 >> 2] = b;j = sf(c[f + (d[b + 4 >> 0] << 3) >> 2] | 0) | 0;
                  if ((Ca | 0) == 1) {
                    Da = f - 8 | 0;
                    return
                  } else c[f + (h << 3) >> 2] = j;b = b + 4 | 0;
                  continue
                }
              case 22:
                {
                  c[f - 4 >> 2] = b;j = Qb(c[f + (d[b + 4 >> 0] << 3) >> 2] | 0) | 0;
                  if ((Ca | 0) == 1) {
                    Da = f - 8 | 0;
                    return
                  } else c[f + (h << 3) >> 2] = j;b = b + 4 | 0;
                  continue
                }
              case 23:
                {
                  c[f - 4 >> 2] = b;j = ee(c[f + (d[b + 4 >> 0] << 3) >> 2] | 0, c[f + (d[b + 5 >> 0] << 3) >> 2] | 0, c[f + (d[b + 6 >> 0] << 3) >> 2] | 0) | 0;
                  if ((Ca | 0) == 1) {
                    Da = f - 8 | 0;
                    return
                  } else c[f + (h << 3) >> 2] = j;b = b + 4 | 0;
                  continue
                }
              case 24:
                {
                  c[f - 4 >> 2] = b;j = Tb(c[f + (d[b + 4 >> 0] << 3) >> 2] | 0, c[f + (d[b + 5 >> 0] << 3) >> 2] | 0, c[f + (d[b + 6 >> 0] << 3) >> 2] | 0) | 0;
                  if ((Ca | 0) == 1) {
                    Da = f - 8 | 0;
                    return
                  } else c[f + (h << 3) >> 2] = j;b = b + 4 | 0;
                  continue
                }
              case 25:
                {
                  c[f - 4 >> 2] = b;Ib();
                  if ((Ca | 0) == 1) {
                    Da = f - 8 | 0;
                    return
                  };
                  continue
                }
              case 26:
                {
                  c[f - 4 >> 2] = b;Xa(c[f + (d[b + 4 >> 0] << 3) >> 2] | 0);
                  if ((Ca | 0) == 1) {
                    Da = f - 8 | 0;
                    return
                  };b = b + 4 | 0;
                  continue
                }
              default:
            }
            break;
          case 136:
            c[f + (h << 3) >> 2] = l;
            break;
          case 137:
            l = c[f + (h << 3) >> 2] | 0;
            break;
          case 139:
            Da = f - 8 | 0;
            c[Da >> 2] = c[f + (h << 3) >> 2] | 0;
            c[Da + 4 >> 2] = c[f + (h << 3) + 4 >> 2] | 0;
            return;
            break;
          default:
        }
      }
    }

    function La(a) {
      a = a | 0;
      var b = 0,
        d = 0,
        e = 0,
        f = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0;
      p = 0;
      q = l;
      l = l + 16 | 0;
      o = q;
      do
        if (a >>> 0 < 245) {
          k = a >>> 0 < 11 ? 16 : a + 11 & -8;
          a = k >>> 3;
          n = c[10501] | 0;
          b = n >>> a;
          if (b & 3 | 0) {
            a = (b & 1 ^ 1) + a | 0;
            b = 42044 + (a << 1 << 2) | 0;
            d = b + 8 | 0;
            e = c[d >> 2] | 0;
            f = e + 8 | 0;
            g = c[f >> 2] | 0;
            if ((g | 0) == (b | 0)) c[10501] = n & ~(1 << a);
            else {
              c[g + 12 >> 2] = b;
              c[d >> 2] = g
            }
            p = a << 3;
            c[e + 4 >> 2] = p | 3;
            p = e + p + 4 | 0;
            c[p >> 2] = c[p >> 2] | 1;
            p = f;
            l = q;
            return p | 0
          }
          m = c[10503] | 0;
          if (k >>> 0 > m >>> 0) {
            if (b | 0) {
              i = 2 << a;
              a = b << a & (i | 0 - i);
              a = (a & 0 - a) + -1 | 0;
              i = a >>> 12 & 16;
              a = a >>> i;
              d = a >>> 5 & 8;
              a = a >>> d;
              g = a >>> 2 & 4;
              a = a >>> g;
              b = a >>> 1 & 2;
              a = a >>> b;
              e = a >>> 1 & 1;
              e = (d | i | g | b | e) + (a >>> e) | 0;
              a = 42044 + (e << 1 << 2) | 0;
              b = a + 8 | 0;
              g = c[b >> 2] | 0;
              i = g + 8 | 0;
              d = c[i >> 2] | 0;
              if ((d | 0) == (a | 0)) {
                b = n & ~(1 << e);
                c[10501] = b
              } else {
                c[d + 12 >> 2] = a;
                c[b >> 2] = d;
                b = n
              }
              p = e << 3;
              h = p - k | 0;
              c[g + 4 >> 2] = k | 3;
              f = g + k | 0;
              c[f + 4 >> 2] = h | 1;
              c[g + p >> 2] = h;
              if (m | 0) {
                e = c[10506] | 0;
                a = m >>> 3;
                d = 42044 + (a << 1 << 2) | 0;
                a = 1 << a;
                if (!(b & a)) {
                  c[10501] = b | a;
                  a = d;
                  b = d + 8 | 0
                } else {
                  b = d + 8 | 0;
                  a = c[b >> 2] | 0
                }
                c[b >> 2] = e;
                c[a + 12 >> 2] = e;
                c[e + 8 >> 2] = a;
                c[e + 12 >> 2] = d
              }
              c[10503] = h;
              c[10506] = f;
              p = i;
              l = q;
              return p | 0
            }
            i = c[10502] | 0;
            if (!i) n = k;
            else {
              b = (i & 0 - i) + -1 | 0;
              h = b >>> 12 & 16;
              b = b >>> h;
              g = b >>> 5 & 8;
              b = b >>> g;
              j = b >>> 2 & 4;
              b = b >>> j;
              d = b >>> 1 & 2;
              b = b >>> d;
              a = b >>> 1 & 1;
              a = c[42308 + ((g | h | j | d | a) + (b >>> a) << 2) >> 2] | 0;
              b = (c[a + 4 >> 2] & -8) - k | 0;
              d = c[a + 16 + (((c[a + 16 >> 2] | 0) == 0 & 1) << 2) >> 2] | 0;
              if (!d) {
                j = a;
                g = b
              } else {
                do {
                  h = (c[d + 4 >> 2] & -8) - k | 0;
                  j = h >>> 0 < b >>> 0;
                  b = j ? h : b;
                  a = j ? d : a;
                  d = c[d + 16 + (((c[d + 16 >> 2] | 0) == 0 & 1) << 2) >> 2] | 0
                } while ((d | 0) != 0);
                j = a;
                g = b
              }
              h = j + k | 0;
              if (h >>> 0 > j >>> 0) {
                f = c[j + 24 >> 2] | 0;
                a = c[j + 12 >> 2] | 0;
                do
                  if ((a | 0) == (j | 0)) {
                    b = j + 20 | 0;
                    a = c[b >> 2] | 0;
                    if (!a) {
                      b = j + 16 | 0;
                      a = c[b >> 2] | 0;
                      if (!a) {
                        d = 0;
                        break
                      }
                    }
                    while (1) {
                      d = a + 20 | 0;
                      e = c[d >> 2] | 0;
                      if (e | 0) {
                        a = e;
                        b = d;
                        continue
                      }
                      d = a + 16 | 0;
                      e = c[d >> 2] | 0;
                      if (!e) break;
                      else {
                        a = e;
                        b = d
                      }
                    }
                    c[b >> 2] = 0;
                    d = a
                  } else {
                    d = c[j + 8 >> 2] | 0;
                    c[d + 12 >> 2] = a;
                    c[a + 8 >> 2] = d;
                    d = a
                  }
                while (0);
                do
                  if (f | 0) {
                    a = c[j + 28 >> 2] | 0;
                    b = 42308 + (a << 2) | 0;
                    if ((j | 0) == (c[b >> 2] | 0)) {
                      c[b >> 2] = d;
                      if (!d) {
                        c[10502] = i & ~(1 << a);
                        break
                      }
                    } else {
                      c[f + 16 + (((c[f + 16 >> 2] | 0) != (j | 0) & 1) << 2) >> 2] = d;
                      if (!d) break
                    }
                    c[d + 24 >> 2] = f;
                    a = c[j + 16 >> 2] | 0;
                    if (a | 0) {
                      c[d + 16 >> 2] = a;
                      c[a + 24 >> 2] = d
                    }
                    a = c[j + 20 >> 2] | 0;
                    if (a | 0) {
                      c[d + 20 >> 2] = a;
                      c[a + 24 >> 2] = d
                    }
                  }
                while (0);
                if (g >>> 0 < 16) {
                  p = g + k | 0;
                  c[j + 4 >> 2] = p | 3;
                  p = j + p + 4 | 0;
                  c[p >> 2] = c[p >> 2] | 1
                } else {
                  c[j + 4 >> 2] = k | 3;
                  c[h + 4 >> 2] = g | 1;
                  c[h + g >> 2] = g;
                  if (m | 0) {
                    e = c[10506] | 0;
                    a = m >>> 3;
                    d = 42044 + (a << 1 << 2) | 0;
                    a = 1 << a;
                    if (!(n & a)) {
                      c[10501] = n | a;
                      a = d;
                      b = d + 8 | 0
                    } else {
                      b = d + 8 | 0;
                      a = c[b >> 2] | 0
                    }
                    c[b >> 2] = e;
                    c[a + 12 >> 2] = e;
                    c[e + 8 >> 2] = a;
                    c[e + 12 >> 2] = d
                  }
                  c[10503] = g;
                  c[10506] = h
                }
                p = j + 8 | 0;
                l = q;
                return p | 0
              } else n = k
            }
          } else n = k
        } else if (a >>> 0 > 4294967231) n = -1;
      else {
        a = a + 11 | 0;
        k = a & -8;
        j = c[10502] | 0;
        if (!j) n = k;
        else {
          d = 0 - k | 0;
          a = a >>> 8;
          if (!a) h = 0;
          else if (k >>> 0 > 16777215) h = 31;
          else {
            n = (a + 1048320 | 0) >>> 16 & 8;
            p = a << n;
            m = (p + 520192 | 0) >>> 16 & 4;
            p = p << m;
            h = (p + 245760 | 0) >>> 16 & 2;
            h = 14 - (m | n | h) + (p << h >>> 15) | 0;
            h = k >>> (h + 7 | 0) & 1 | h << 1
          }
          b = c[42308 + (h << 2) >> 2] | 0;
          a: do
            if (!b) {
              b = 0;
              a = 0;
              p = 57
            } else {
              a = 0;
              g = b;
              f = k << ((h | 0) == 31 ? 0 : 25 - (h >>> 1) | 0);
              b = 0;
              while (1) {
                e = (c[g + 4 >> 2] & -8) - k | 0;
                if (e >>> 0 < d >>> 0)
                  if (!e) {
                    d = 0;
                    b = g;
                    a = g;
                    p = 61;
                    break a
                  } else {
                    a = g;
                    d = e
                  }
                e = c[g + 20 >> 2] | 0;
                g = c[g + 16 + (f >>> 31 << 2) >> 2] | 0;
                b = (e | 0) == 0 | (e | 0) == (g | 0) ? b : e;
                e = (g | 0) == 0;
                if (e) {
                  p = 57;
                  break
                } else f = f << ((e ^ 1) & 1)
              }
            }
          while (0);
          if ((p | 0) == 57) {
            if ((b | 0) == 0 & (a | 0) == 0) {
              a = 2 << h;
              a = j & (a | 0 - a);
              if (!a) {
                n = k;
                break
              }
              n = (a & 0 - a) + -1 | 0;
              h = n >>> 12 & 16;
              n = n >>> h;
              g = n >>> 5 & 8;
              n = n >>> g;
              i = n >>> 2 & 4;
              n = n >>> i;
              m = n >>> 1 & 2;
              n = n >>> m;
              b = n >>> 1 & 1;
              a = 0;
              b = c[42308 + ((g | h | i | m | b) + (n >>> b) << 2) >> 2] | 0
            }
            if (!b) {
              i = a;
              g = d
            } else p = 61
          }
          if ((p | 0) == 61)
            while (1) {
              p = 0;
              m = (c[b + 4 >> 2] & -8) - k | 0;
              n = m >>> 0 < d >>> 0;
              d = n ? m : d;
              a = n ? b : a;
              b = c[b + 16 + (((c[b + 16 >> 2] | 0) == 0 & 1) << 2) >> 2] | 0;
              if (!b) {
                i = a;
                g = d;
                break
              } else p = 61
            }
          if (!i) n = k;
          else if (g >>> 0 < ((c[10503] | 0) - k | 0) >>> 0) {
            h = i + k | 0;
            if (h >>> 0 <= i >>> 0) {
              p = 0;
              l = q;
              return p | 0
            }
            f = c[i + 24 >> 2] | 0;
            a = c[i + 12 >> 2] | 0;
            do
              if ((a | 0) == (i | 0)) {
                b = i + 20 | 0;
                a = c[b >> 2] | 0;
                if (!a) {
                  b = i + 16 | 0;
                  a = c[b >> 2] | 0;
                  if (!a) {
                    a = 0;
                    break
                  }
                }
                while (1) {
                  d = a + 20 | 0;
                  e = c[d >> 2] | 0;
                  if (e | 0) {
                    a = e;
                    b = d;
                    continue
                  }
                  d = a + 16 | 0;
                  e = c[d >> 2] | 0;
                  if (!e) break;
                  else {
                    a = e;
                    b = d
                  }
                }
                c[b >> 2] = 0
              } else {
                p = c[i + 8 >> 2] | 0;
                c[p + 12 >> 2] = a;
                c[a + 8 >> 2] = p
              }
            while (0);
            do
              if (!f) e = j;
              else {
                b = c[i + 28 >> 2] | 0;
                d = 42308 + (b << 2) | 0;
                if ((i | 0) == (c[d >> 2] | 0)) {
                  c[d >> 2] = a;
                  if (!a) {
                    e = j & ~(1 << b);
                    c[10502] = e;
                    break
                  }
                } else {
                  c[f + 16 + (((c[f + 16 >> 2] | 0) != (i | 0) & 1) << 2) >> 2] = a;
                  if (!a) {
                    e = j;
                    break
                  }
                }
                c[a + 24 >> 2] = f;
                b = c[i + 16 >> 2] | 0;
                if (b | 0) {
                  c[a + 16 >> 2] = b;
                  c[b + 24 >> 2] = a
                }
                b = c[i + 20 >> 2] | 0;
                if (!b) e = j;
                else {
                  c[a + 20 >> 2] = b;
                  c[b + 24 >> 2] = a;
                  e = j
                }
              }
            while (0);
            do
              if (g >>> 0 < 16) {
                p = g + k | 0;
                c[i + 4 >> 2] = p | 3;
                p = i + p + 4 | 0;
                c[p >> 2] = c[p >> 2] | 1
              } else {
                c[i + 4 >> 2] = k | 3;
                c[h + 4 >> 2] = g | 1;
                c[h + g >> 2] = g;
                a = g >>> 3;
                if (g >>> 0 < 256) {
                  d = 42044 + (a << 1 << 2) | 0;
                  b = c[10501] | 0;
                  a = 1 << a;
                  if (!(b & a)) {
                    c[10501] = b | a;
                    a = d;
                    b = d + 8 | 0
                  } else {
                    b = d + 8 | 0;
                    a = c[b >> 2] | 0
                  }
                  c[b >> 2] = h;
                  c[a + 12 >> 2] = h;
                  c[h + 8 >> 2] = a;
                  c[h + 12 >> 2] = d;
                  break
                }
                a = g >>> 8;
                if (!a) a = 0;
                else if (g >>> 0 > 16777215) a = 31;
                else {
                  o = (a + 1048320 | 0) >>> 16 & 8;
                  p = a << o;
                  n = (p + 520192 | 0) >>> 16 & 4;
                  p = p << n;
                  a = (p + 245760 | 0) >>> 16 & 2;
                  a = 14 - (n | o | a) + (p << a >>> 15) | 0;
                  a = g >>> (a + 7 | 0) & 1 | a << 1
                }
                d = 42308 + (a << 2) | 0;
                c[h + 28 >> 2] = a;
                b = h + 16 | 0;
                c[b + 4 >> 2] = 0;
                c[b >> 2] = 0;
                b = 1 << a;
                if (!(e & b)) {
                  c[10502] = e | b;
                  c[d >> 2] = h;
                  c[h + 24 >> 2] = d;
                  c[h + 12 >> 2] = h;
                  c[h + 8 >> 2] = h;
                  break
                }
                b = g << ((a | 0) == 31 ? 0 : 25 - (a >>> 1) | 0);
                d = c[d >> 2] | 0;
                while (1) {
                  if ((c[d + 4 >> 2] & -8 | 0) == (g | 0)) {
                    p = 97;
                    break
                  }
                  e = d + 16 + (b >>> 31 << 2) | 0;
                  a = c[e >> 2] | 0;
                  if (!a) {
                    p = 96;
                    break
                  } else {
                    b = b << 1;
                    d = a
                  }
                }
                if ((p | 0) == 96) {
                  c[e >> 2] = h;
                  c[h + 24 >> 2] = d;
                  c[h + 12 >> 2] = h;
                  c[h + 8 >> 2] = h;
                  break
                } else if ((p | 0) == 97) {
                  o = d + 8 | 0;
                  p = c[o >> 2] | 0;
                  c[p + 12 >> 2] = h;
                  c[o >> 2] = h;
                  c[h + 8 >> 2] = p;
                  c[h + 12 >> 2] = d;
                  c[h + 24 >> 2] = 0;
                  break
                }
              }
            while (0);
            p = i + 8 | 0;
            l = q;
            return p | 0
          } else n = k
        }
      }
      while (0);
      d = c[10503] | 0;
      if (d >>> 0 >= n >>> 0) {
        a = d - n | 0;
        b = c[10506] | 0;
        if (a >>> 0 > 15) {
          p = b + n | 0;
          c[10506] = p;
          c[10503] = a;
          c[p + 4 >> 2] = a | 1;
          c[b + d >> 2] = a;
          c[b + 4 >> 2] = n | 3
        } else {
          c[10503] = 0;
          c[10506] = 0;
          c[b + 4 >> 2] = d | 3;
          p = b + d + 4 | 0;
          c[p >> 2] = c[p >> 2] | 1
        }
        p = b + 8 | 0;
        l = q;
        return p | 0
      }
      h = c[10504] | 0;
      if (h >>> 0 > n >>> 0) {
        m = h - n | 0;
        c[10504] = m;
        p = c[10507] | 0;
        o = p + n | 0;
        c[10507] = o;
        c[o + 4 >> 2] = m | 1;
        c[p + 4 >> 2] = n | 3;
        p = p + 8 | 0;
        l = q;
        return p | 0
      }
      if (!(c[10619] | 0)) {
        c[10621] = 4096;
        c[10620] = 4096;
        c[10622] = -1;
        c[10623] = -1;
        c[10624] = 0;
        c[10612] = 0;
        c[10619] = o & -16 ^ 1431655768;
        a = 4096
      } else a = c[10621] | 0;
      i = n + 48 | 0;
      j = n + 47 | 0;
      g = a + j | 0;
      e = 0 - a | 0;
      k = g & e;
      if (k >>> 0 <= n >>> 0) {
        p = 0;
        l = q;
        return p | 0
      }
      a = c[10611] | 0;
      if (a | 0) {
        m = c[10609] | 0;
        o = m + k | 0;
        if (o >>> 0 <= m >>> 0 | o >>> 0 > a >>> 0) {
          p = 0;
          l = q;
          return p | 0
        }
      }
      b: do
        if (!(c[10612] & 4)) {
          b = c[10507] | 0;
          c: do
            if (!b) p = 118;
            else {
              d = 42452;
              while (1) {
                a = c[d >> 2] | 0;
                if (a >>> 0 <= b >>> 0) {
                  f = d + 4 | 0;
                  if ((a + (c[f >> 2] | 0) | 0) >>> 0 > b >>> 0) break
                }
                a = c[d + 8 >> 2] | 0;
                if (!a) {
                  p = 118;
                  break c
                } else d = a
              }
              a = g - h & e;
              if (a >>> 0 < 2147483647) {
                e = fd(a | 0) | 0;
                if ((e | 0) == ((c[d >> 2] | 0) + (c[f >> 2] | 0) | 0)) {
                  if ((e | 0) != (-1 | 0)) {
                    p = 135;
                    break b
                  }
                } else p = 126
              } else a = 0
            }
          while (0);
          do
            if ((p | 0) == 118) {
              e = fd(0) | 0;
              if ((e | 0) == (-1 | 0)) a = 0;
              else {
                a = e;
                b = c[10620] | 0;
                d = b + -1 | 0;
                a = ((d & a | 0) == 0 ? 0 : (d + a & 0 - b) - a | 0) + k | 0;
                b = c[10609] | 0;
                d = a + b | 0;
                if (a >>> 0 > n >>> 0 & a >>> 0 < 2147483647) {
                  f = c[10611] | 0;
                  if (f | 0)
                    if (d >>> 0 <= b >>> 0 | d >>> 0 > f >>> 0) {
                      a = 0;
                      break
                    }
                  b = fd(a | 0) | 0;
                  if ((b | 0) == (e | 0)) {
                    p = 135;
                    break b
                  } else {
                    e = b;
                    p = 126
                  }
                } else a = 0
              }
            }
          while (0);
          do
            if ((p | 0) == 126) {
              d = 0 - a | 0;
              if (!(i >>> 0 > a >>> 0 & (a >>> 0 < 2147483647 & (e | 0) != (-1 | 0))))
                if ((e | 0) == (-1 | 0)) {
                  a = 0;
                  break
                } else {
                  p = 135;
                  break b
                }
              b = c[10621] | 0;
              b = j - a + b & 0 - b;
              if (b >>> 0 >= 2147483647) {
                p = 135;
                break b
              }
              if ((fd(b | 0) | 0) == (-1 | 0)) {
                fd(d | 0) | 0;
                a = 0;
                break
              } else {
                a = b + a | 0;
                p = 135;
                break b
              }
            }
          while (0);
          c[10612] = c[10612] | 4;
          p = 133
        } else {
          a = 0;
          p = 133
        }
      while (0);
      if ((p | 0) == 133)
        if (k >>> 0 < 2147483647) {
          e = fd(k | 0) | 0;
          o = fd(0) | 0;
          b = o - e | 0;
          d = b >>> 0 > (n + 40 | 0) >>> 0;
          if (!((e | 0) == (-1 | 0) | d ^ 1 | e >>> 0 < o >>> 0 & ((e | 0) != (-1 | 0) & (o | 0) != (-1 | 0)) ^ 1)) {
            a = d ? b : a;
            p = 135
          }
        }
      if ((p | 0) == 135) {
        b = (c[10609] | 0) + a | 0;
        c[10609] = b;
        if (b >>> 0 > (c[10610] | 0) >>> 0) c[10610] = b;
        j = c[10507] | 0;
        do
          if (!j) {
            p = c[10505] | 0;
            if ((p | 0) == 0 | e >>> 0 < p >>> 0) c[10505] = e;
            c[10613] = e;
            c[10614] = a;
            c[10616] = 0;
            c[10510] = c[10619];
            c[10509] = -1;
            c[10514] = 42044;
            c[10513] = 42044;
            c[10516] = 42052;
            c[10515] = 42052;
            c[10518] = 42060;
            c[10517] = 42060;
            c[10520] = 42068;
            c[10519] = 42068;
            c[10522] = 42076;
            c[10521] = 42076;
            c[10524] = 42084;
            c[10523] = 42084;
            c[10526] = 42092;
            c[10525] = 42092;
            c[10528] = 42100;
            c[10527] = 42100;
            c[10530] = 42108;
            c[10529] = 42108;
            c[10532] = 42116;
            c[10531] = 42116;
            c[10534] = 42124;
            c[10533] = 42124;
            c[10536] = 42132;
            c[10535] = 42132;
            c[10538] = 42140;
            c[10537] = 42140;
            c[10540] = 42148;
            c[10539] = 42148;
            c[10542] = 42156;
            c[10541] = 42156;
            c[10544] = 42164;
            c[10543] = 42164;
            c[10546] = 42172;
            c[10545] = 42172;
            c[10548] = 42180;
            c[10547] = 42180;
            c[10550] = 42188;
            c[10549] = 42188;
            c[10552] = 42196;
            c[10551] = 42196;
            c[10554] = 42204;
            c[10553] = 42204;
            c[10556] = 42212;
            c[10555] = 42212;
            c[10558] = 42220;
            c[10557] = 42220;
            c[10560] = 42228;
            c[10559] = 42228;
            c[10562] = 42236;
            c[10561] = 42236;
            c[10564] = 42244;
            c[10563] = 42244;
            c[10566] = 42252;
            c[10565] = 42252;
            c[10568] = 42260;
            c[10567] = 42260;
            c[10570] = 42268;
            c[10569] = 42268;
            c[10572] = 42276;
            c[10571] = 42276;
            c[10574] = 42284;
            c[10573] = 42284;
            c[10576] = 42292;
            c[10575] = 42292;
            p = a + -40 | 0;
            m = e + 8 | 0;
            m = (m & 7 | 0) == 0 ? 0 : 0 - m & 7;
            o = e + m | 0;
            m = p - m | 0;
            c[10507] = o;
            c[10504] = m;
            c[o + 4 >> 2] = m | 1;
            c[e + p + 4 >> 2] = 40;
            c[10508] = c[10623]
          } else {
            b = 42452;
            do {
              d = c[b >> 2] | 0;
              f = b + 4 | 0;
              g = c[f >> 2] | 0;
              if ((e | 0) == (d + g | 0)) {
                p = 143;
                break
              }
              b = c[b + 8 >> 2] | 0
            } while ((b | 0) != 0);
            if ((p | 0) == 143)
              if (!(c[b + 12 >> 2] & 8))
                if (e >>> 0 > j >>> 0 & d >>> 0 <= j >>> 0) {
                  c[f >> 2] = g + a;
                  p = (c[10504] | 0) + a | 0;
                  m = j + 8 | 0;
                  m = (m & 7 | 0) == 0 ? 0 : 0 - m & 7;
                  o = j + m | 0;
                  m = p - m | 0;
                  c[10507] = o;
                  c[10504] = m;
                  c[o + 4 >> 2] = m | 1;
                  c[j + p + 4 >> 2] = 40;
                  c[10508] = c[10623];
                  break
                }
            if (e >>> 0 < (c[10505] | 0) >>> 0) c[10505] = e;
            d = e + a | 0;
            b = 42452;
            while (1) {
              if ((c[b >> 2] | 0) == (d | 0)) {
                p = 151;
                break
              }
              b = c[b + 8 >> 2] | 0;
              if (!b) {
                d = 42452;
                break
              }
            }
            if ((p | 0) == 151)
              if (!(c[b + 12 >> 2] & 8)) {
                c[b >> 2] = e;
                m = b + 4 | 0;
                c[m >> 2] = (c[m >> 2] | 0) + a;
                m = e + 8 | 0;
                m = e + ((m & 7 | 0) == 0 ? 0 : 0 - m & 7) | 0;
                a = d + 8 | 0;
                a = d + ((a & 7 | 0) == 0 ? 0 : 0 - a & 7) | 0;
                k = m + n | 0;
                i = a - m - n | 0;
                c[m + 4 >> 2] = n | 3;
                do
                  if ((j | 0) == (a | 0)) {
                    p = (c[10504] | 0) + i | 0;
                    c[10504] = p;
                    c[10507] = k;
                    c[k + 4 >> 2] = p | 1
                  } else {
                    if ((c[10506] | 0) == (a | 0)) {
                      p = (c[10503] | 0) + i | 0;
                      c[10503] = p;
                      c[10506] = k;
                      c[k + 4 >> 2] = p | 1;
                      c[k + p >> 2] = p;
                      break
                    }
                    b = c[a + 4 >> 2] | 0;
                    if ((b & 3 | 0) == 1) {
                      h = b & -8;
                      e = b >>> 3;
                      d: do
                        if (b >>> 0 < 256) {
                          b = c[a + 8 >> 2] | 0;
                          d = c[a + 12 >> 2] | 0;
                          if ((d | 0) == (b | 0)) {
                            c[10501] = c[10501] & ~(1 << e);
                            break
                          } else {
                            c[b + 12 >> 2] = d;
                            c[d + 8 >> 2] = b;
                            break
                          }
                        } else {
                          g = c[a + 24 >> 2] | 0;
                          b = c[a + 12 >> 2] | 0;
                          do
                            if ((b | 0) == (a | 0)) {
                              e = a + 16 | 0;
                              d = e + 4 | 0;
                              b = c[d >> 2] | 0;
                              if (!b) {
                                b = c[e >> 2] | 0;
                                if (!b) {
                                  b = 0;
                                  break
                                } else d = e
                              }
                              while (1) {
                                e = b + 20 | 0;
                                f = c[e >> 2] | 0;
                                if (f | 0) {
                                  b = f;
                                  d = e;
                                  continue
                                }
                                e = b + 16 | 0;
                                f = c[e >> 2] | 0;
                                if (!f) break;
                                else {
                                  b = f;
                                  d = e
                                }
                              }
                              c[d >> 2] = 0
                            } else {
                              p = c[a + 8 >> 2] | 0;
                              c[p + 12 >> 2] = b;
                              c[b + 8 >> 2] = p
                            }
                          while (0);
                          if (!g) break;
                          d = c[a + 28 >> 2] | 0;
                          e = 42308 + (d << 2) | 0;
                          do
                            if ((c[e >> 2] | 0) == (a | 0)) {
                              c[e >> 2] = b;
                              if (b | 0) break;
                              c[10502] = c[10502] & ~(1 << d);
                              break d
                            } else {
                              c[g + 16 + (((c[g + 16 >> 2] | 0) != (a | 0) & 1) << 2) >> 2] = b;
                              if (!b) break d
                            }
                          while (0);
                          c[b + 24 >> 2] = g;
                          d = a + 16 | 0;
                          e = c[d >> 2] | 0;
                          if (e | 0) {
                            c[b + 16 >> 2] = e;
                            c[e + 24 >> 2] = b
                          }
                          d = c[d + 4 >> 2] | 0;
                          if (!d) break;
                          c[b + 20 >> 2] = d;
                          c[d + 24 >> 2] = b
                        }
                      while (0);
                      a = a + h | 0;
                      f = h + i | 0
                    } else f = i;
                    a = a + 4 | 0;
                    c[a >> 2] = c[a >> 2] & -2;
                    c[k + 4 >> 2] = f | 1;
                    c[k + f >> 2] = f;
                    a = f >>> 3;
                    if (f >>> 0 < 256) {
                      d = 42044 + (a << 1 << 2) | 0;
                      b = c[10501] | 0;
                      a = 1 << a;
                      if (!(b & a)) {
                        c[10501] = b | a;
                        a = d;
                        b = d + 8 | 0
                      } else {
                        b = d + 8 | 0;
                        a = c[b >> 2] | 0
                      }
                      c[b >> 2] = k;
                      c[a + 12 >> 2] = k;
                      c[k + 8 >> 2] = a;
                      c[k + 12 >> 2] = d;
                      break
                    }
                    a = f >>> 8;
                    do
                      if (!a) a = 0;
                      else {
                        if (f >>> 0 > 16777215) {
                          a = 31;
                          break
                        }
                        o = (a + 1048320 | 0) >>> 16 & 8;
                        p = a << o;
                        n = (p + 520192 | 0) >>> 16 & 4;
                        p = p << n;
                        a = (p + 245760 | 0) >>> 16 & 2;
                        a = 14 - (n | o | a) + (p << a >>> 15) | 0;
                        a = f >>> (a + 7 | 0) & 1 | a << 1
                      }
                    while (0);
                    e = 42308 + (a << 2) | 0;
                    c[k + 28 >> 2] = a;
                    b = k + 16 | 0;
                    c[b + 4 >> 2] = 0;
                    c[b >> 2] = 0;
                    b = c[10502] | 0;
                    d = 1 << a;
                    if (!(b & d)) {
                      c[10502] = b | d;
                      c[e >> 2] = k;
                      c[k + 24 >> 2] = e;
                      c[k + 12 >> 2] = k;
                      c[k + 8 >> 2] = k;
                      break
                    }
                    b = f << ((a | 0) == 31 ? 0 : 25 - (a >>> 1) | 0);
                    d = c[e >> 2] | 0;
                    while (1) {
                      if ((c[d + 4 >> 2] & -8 | 0) == (f | 0)) {
                        p = 192;
                        break
                      }
                      e = d + 16 + (b >>> 31 << 2) | 0;
                      a = c[e >> 2] | 0;
                      if (!a) {
                        p = 191;
                        break
                      } else {
                        b = b << 1;
                        d = a
                      }
                    }
                    if ((p | 0) == 191) {
                      c[e >> 2] = k;
                      c[k + 24 >> 2] = d;
                      c[k + 12 >> 2] = k;
                      c[k + 8 >> 2] = k;
                      break
                    } else if ((p | 0) == 192) {
                      o = d + 8 | 0;
                      p = c[o >> 2] | 0;
                      c[p + 12 >> 2] = k;
                      c[o >> 2] = k;
                      c[k + 8 >> 2] = p;
                      c[k + 12 >> 2] = d;
                      c[k + 24 >> 2] = 0;
                      break
                    }
                  }
                while (0);
                p = m + 8 | 0;
                l = q;
                return p | 0
              } else d = 42452;
            while (1) {
              b = c[d >> 2] | 0;
              if (b >>> 0 <= j >>> 0) {
                b = b + (c[d + 4 >> 2] | 0) | 0;
                if (b >>> 0 > j >>> 0) break
              }
              d = c[d + 8 >> 2] | 0
            }
            g = b + -47 | 0;
            d = g + 8 | 0;
            d = g + ((d & 7 | 0) == 0 ? 0 : 0 - d & 7) | 0;
            g = j + 16 | 0;
            d = d >>> 0 < g >>> 0 ? j : d;
            p = d + 8 | 0;
            f = a + -40 | 0;
            m = e + 8 | 0;
            m = (m & 7 | 0) == 0 ? 0 : 0 - m & 7;
            o = e + m | 0;
            m = f - m | 0;
            c[10507] = o;
            c[10504] = m;
            c[o + 4 >> 2] = m | 1;
            c[e + f + 4 >> 2] = 40;
            c[10508] = c[10623];
            f = d + 4 | 0;
            c[f >> 2] = 27;
            c[p >> 2] = c[10613];
            c[p + 4 >> 2] = c[10614];
            c[p + 8 >> 2] = c[10615];
            c[p + 12 >> 2] = c[10616];
            c[10613] = e;
            c[10614] = a;
            c[10616] = 0;
            c[10615] = p;
            a = d + 24 | 0;
            do {
              p = a;
              a = a + 4 | 0;
              c[a >> 2] = 7
            } while ((p + 8 | 0) >>> 0 < b >>> 0);
            if ((d | 0) != (j | 0)) {
              h = d - j | 0;
              c[f >> 2] = c[f >> 2] & -2;
              c[j + 4 >> 2] = h | 1;
              c[d >> 2] = h;
              a = h >>> 3;
              if (h >>> 0 < 256) {
                d = 42044 + (a << 1 << 2) | 0;
                b = c[10501] | 0;
                a = 1 << a;
                if (!(b & a)) {
                  c[10501] = b | a;
                  a = d;
                  b = d + 8 | 0
                } else {
                  b = d + 8 | 0;
                  a = c[b >> 2] | 0
                }
                c[b >> 2] = j;
                c[a + 12 >> 2] = j;
                c[j + 8 >> 2] = a;
                c[j + 12 >> 2] = d;
                break
              }
              a = h >>> 8;
              if (!a) d = 0;
              else if (h >>> 0 > 16777215) d = 31;
              else {
                o = (a + 1048320 | 0) >>> 16 & 8;
                p = a << o;
                m = (p + 520192 | 0) >>> 16 & 4;
                p = p << m;
                d = (p + 245760 | 0) >>> 16 & 2;
                d = 14 - (m | o | d) + (p << d >>> 15) | 0;
                d = h >>> (d + 7 | 0) & 1 | d << 1
              }
              e = 42308 + (d << 2) | 0;
              c[j + 28 >> 2] = d;
              c[j + 20 >> 2] = 0;
              c[g >> 2] = 0;
              a = c[10502] | 0;
              b = 1 << d;
              if (!(a & b)) {
                c[10502] = a | b;
                c[e >> 2] = j;
                c[j + 24 >> 2] = e;
                c[j + 12 >> 2] = j;
                c[j + 8 >> 2] = j;
                break
              }
              b = h << ((d | 0) == 31 ? 0 : 25 - (d >>> 1) | 0);
              d = c[e >> 2] | 0;
              while (1) {
                if ((c[d + 4 >> 2] & -8 | 0) == (h | 0)) {
                  p = 213;
                  break
                }
                e = d + 16 + (b >>> 31 << 2) | 0;
                a = c[e >> 2] | 0;
                if (!a) {
                  p = 212;
                  break
                } else {
                  b = b << 1;
                  d = a
                }
              }
              if ((p | 0) == 212) {
                c[e >> 2] = j;
                c[j + 24 >> 2] = d;
                c[j + 12 >> 2] = j;
                c[j + 8 >> 2] = j;
                break
              } else if ((p | 0) == 213) {
                o = d + 8 | 0;
                p = c[o >> 2] | 0;
                c[p + 12 >> 2] = j;
                c[o >> 2] = j;
                c[j + 8 >> 2] = p;
                c[j + 12 >> 2] = d;
                c[j + 24 >> 2] = 0;
                break
              }
            }
          }
        while (0);
        a = c[10504] | 0;
        if (a >>> 0 > n >>> 0) {
          m = a - n | 0;
          c[10504] = m;
          p = c[10507] | 0;
          o = p + n | 0;
          c[10507] = o;
          c[o + 4 >> 2] = m | 1;
          c[p + 4 >> 2] = n | 3;
          p = p + 8 | 0;
          l = q;
          return p | 0
        }
      }
      c[($f() | 0) >> 2] = 12;
      p = 0;
      l = q;
      return p | 0
    }

    function Ma(d, f) {
      d = d | 0;
      f = f | 0;
      var h = 0,
        i = 0.0,
        j = 0,
        k = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 0,
        t = 0,
        u = 0,
        v = 0,
        w = 0,
        x = 0,
        y = 0,
        z = 0,
        A = 0,
        B = 0,
        C = 0,
        D = 0,
        E = 0,
        F = 0,
        G = 0,
        H = 0,
        I = 0,
        J = 0,
        K = 0,
        L = 0,
        M = 0;
      L = 0;
      M = l;
      l = l + 128 | 0;
      J = M + 104 | 0;
      I = M + 96 | 0;
      G = M + 88 | 0;
      F = M + 80 | 0;
      E = M + 72 | 0;
      D = M + 64 | 0;
      C = M + 56 | 0;
      B = M + 48 | 0;
      A = M + 40 | 0;
      z = M + 32 | 0;
      K = M + 24 | 0;
      H = M + 16 | 0;
      y = M + 8 | 0;
      x = M;
      v = M + 112 | 0;
      c[v >> 2] = 0;
      w = jb(d, v) | 0;
      a: do
        if (!w) {
          qc();
          f = -1
        } else {
          do
            if (!f) {
              f = Cf(d) | 0;
              if (!f) f = 0;
              else {
                h = f - d | 0;
                f = La(h + 2 | 0) | 0;
                if (!f) {
                  Hb(8931, 386, 1, d, c[($f() | 0) >> 2] | 0);
                  qc();
                  Xa(w);
                  f = -1;
                  break a
                } else {
                  u = h + 1 | 0;
                  Xe(f, d, u) | 0;
                  a[f + u >> 0] = 0;
                  break
                }
              }
            } else {
              f = ye(f) | 0;
              if (!f) {
                Hb(8931, 376, 1, d, c[($f() | 0) >> 2] | 0);
                qc();
                Xa(w);
                f = -1;
                break a
              }
            }
          while (0);
          a[w + (c[v >> 2] | 0) >> 0] = 10;
          m = 0;
          k = 0;
          b: while (1) {
            h = c[v >> 2] | 0;
            u = k;
            c: while (1) {
              if (u >>> 0 > h >>> 0) {
                L = 152;
                break b
              }
              j = w + u | 0;
              switch (a[j >> 0] | 0) {
                case 10:
                case 13:
                  break c;
                default:
                  {}
              }
              u = u + 1 | 0
            }
            a[j >> 0] = 0;
            if ((u | 0) == (k | 0)) h = m;
            else {
              c[10359] = 0;
              t = Gb(w + k | 0) | 0;
              d: do
                if (!t)
                  if (!(c[10359] | 0)) h = m;
                  else {
                    L = 149;
                    break b
                  }
              else {
                h = c[t >> 2] | 0;
                if (!(Jc(h, 8943) | 0)) {
                  Xa(f);
                  f = c[t + 4 >> 2] | 0;
                  if (!f) {
                    L = 19;
                    break b
                  }
                  f = ye(f) | 0;
                  if (!f) {
                    L = 21;
                    break b
                  }
                  h = Hc(f) | 0;
                  if ((a[f + (h + -1) >> 0] | 0) == 47) {
                    h = m;
                    break
                  }
                  a[f + (h + 1) >> 0] = 0;
                  a[f + (Hc(f) | 0) >> 0] = 47;
                  h = m;
                  break
                }
                if (!(Jc(h, 8974) | 0)) {
                  j = t + 4 | 0;
                  h = c[j >> 2] | 0;
                  if (!h) {
                    L = 26;
                    break b
                  }
                  if ((f | 0) != 0 & (a[h >> 0] | 0) != 47) {
                    s = Hc(f) | 0;
                    h = La(s + 1 + (Hc(h) | 0) | 0) | 0;
                    if (!h) {
                      L = 29;
                      break b
                    }
                    ef(h, f) | 0;
                    s = h + (Hc(f) | 0) | 0;
                    ef(s, c[j >> 2] | 0) | 0
                  } else {
                    h = ye(h) | 0;
                    if (!h) {
                      L = 32;
                      break b
                    }
                  }
                  s = (Ma(h, f) | 0) == -1;
                  Xa(h);
                  if (s) {
                    L = 34;
                    break b
                  } else {
                    h = m;
                    break
                  }
                }
                if (!(Jc(h, 9011) | 0)) {
                  h = c[t + 4 >> 2] | 0;
                  if (!h) {
                    L = 38;
                    break b
                  }
                  if (!(rf(a[h >> 0] | 0) | 0)) {
                    L = 38;
                    break b
                  }
                  h = (nc(h) | 0) << 8 & 65535;
                  break
                }
                if (!(Jc(h, 9044) | 0)) {
                  h = c[t + 4 >> 2] | 0;
                  if (!h) {
                    L = 43;
                    break b
                  }
                  if (!(rf(a[h >> 0] | 0) | 0)) {
                    L = 43;
                    break b
                  }
                  h = ((nc(h) | 0) << 8 | 128) & 65535;
                  break
                }
                if (!(Jc(h, 9083) | 0)) {
                  h = c[t + 4 >> 2] | 0;
                  if (!h) {
                    L = 48;
                    break b
                  }
                  if (!(rf(a[h >> 0] | 0) | 0)) {
                    L = 48;
                    break b
                  }
                  i = +Lf(h);
                  g[117] = i;
                  if (i < 1.0) {
                    c[x >> 2] = d;
                    Ud(9142, x);
                    g[117] = 1.0;
                    h = m;
                    break
                  }
                  if (!(i > 100.0)) {
                    h = m;
                    break
                  }
                  c[y >> 2] = d;
                  Ud(9205, y);
                  g[117] = 100.0;
                  h = m;
                  break
                }
                if (!(Jc(h, 9274) | 0)) {
                  h = c[t + 4 >> 2] | 0;
                  if (!h) {
                    L = 56;
                    break b
                  }
                  if (!(rf(a[h >> 0] | 0) | 0)) {
                    L = 56;
                    break b
                  }
                  i = +Lf(h);
                  g[118] = i;
                  if (i < 1.0) {
                    c[H >> 2] = d;
                    Ud(9335, H);
                    g[118] = 1.0;
                    h = m;
                    break
                  }
                  if (!(i > 100.0)) {
                    h = m;
                    break
                  }
                  c[K >> 2] = d;
                  Ud(9399, K);
                  g[118] = 100.0;
                  h = m;
                  break
                }
                if (!(Jc(h, 9469) | 0)) {
                  h = c[t + 4 >> 2] | 0;
                  if (!h) {
                    L = 64;
                    break b
                  }
                  if (!(rf(a[h >> 0] | 0) | 0)) {
                    L = 64;
                    break b
                  }
                  i = +Lf(h);
                  g[119] = i;
                  if (!(i < 0.0 | +g[117] < i)) {
                    h = m;
                    break
                  }
                  c[z >> 2] = d;
                  Ud(9532, z);
                  g[119] = +g[117] * .5;
                  h = m;
                  break
                }
                if (!(Jc(h, 9575) | 0)) {
                  h = c[t + 4 >> 2] | 0;
                  if (!h) {
                    L = 70;
                    break b
                  }
                  if (!(rf(a[h >> 0] | 0) | 0)) {
                    L = 70;
                    break b
                  }
                  i = +Lf(h);
                  g[120] = i;
                  if (!(i < 0.0 | +g[117] < i)) {
                    h = m;
                    break
                  }
                  c[A >> 2] = d;
                  Ud(9638, A);
                  g[120] = +g[118] * .75;
                  h = m;
                  break
                }
                if (!(Jc(h, 9681) | 0)) {
                  c[10360] = 1;
                  h = m;
                  break
                }
                if (!(Jc(h, 9739) | 0)) {
                  c[10361] = 1;
                  h = m;
                  break
                }
                if (!(Jc(h, 9748) | 0)) {
                  c[10361] = 1;
                  c[10362] = 1;
                  h = m;
                  break
                }
                if (!(rf(a[h >> 0] | 0) | 0)) h = m;
                else {
                  k = (nc(h) | 0) & 127;
                  n = k | m & -128 & 65535;
                  h = n & 65535;
                  k = 41480 + (k << 2) | 0;
                  m = c[k >> 2] | 0;
                  do
                    if (!m) {
                      j = La(100) | 0;
                      c[k >> 2] = j;
                      if (!j) {
                        L = 82;
                        break b
                      }
                      b[j >> 1] = h;
                      c[j + 4 >> 2] = 0;
                      b[j + 8 >> 1] = 1024;
                      a[j + 84 >> 0] = 0;
                      c[j + 96 >> 2] = 0;
                      c[j + 92 >> 2] = 0;
                      a[j + 2 >> 0] = 0;
                      c[j + 88 >> 2] = 0
                    } else {
                      if ((n | 0) == (e[m >> 1] | 0)) {
                        j = m + 4 | 0;
                        Xa(c[j >> 2] | 0);
                        c[j >> 2] = 0;
                        b[m + 8 >> 1] = 1024;
                        a[m + 84 >> 0] = 0;
                        j = m;
                        break
                      }
                      k = m + 96 | 0;
                      j = c[k >> 2] | 0;
                      if (!j) {
                        j = La(100) | 0;
                        c[k >> 2] = j;
                        if (!j) {
                          L = 95;
                          break b
                        }
                        b[j >> 1] = h;
                        c[j + 4 >> 2] = 0;
                        b[j + 8 >> 1] = 1024;
                        a[j + 84 >> 0] = 0;
                        c[j + 96 >> 2] = 0;
                        c[j + 92 >> 2] = 0;
                        a[j + 2 >> 0] = 0;
                        c[j + 88 >> 2] = 0;
                        break
                      } else k = m;
                      while (1) {
                        if (!j) break;
                        if ((n | 0) == (e[j >> 1] | 0)) {
                          L = 93;
                          break
                        }
                        k = j;
                        j = c[j + 96 >> 2] | 0
                      }
                      if ((L | 0) == 93) {
                        L = 0;
                        s = j + 4 | 0;
                        Xa(c[s >> 2] | 0);
                        c[s >> 2] = 0;
                        b[j + 8 >> 1] = 1024;
                        a[j + 84 >> 0] = 0;
                        break
                      }
                      j = La(100) | 0;
                      c[k + 96 >> 2] = j;
                      if (!j) {
                        L = 91;
                        break b
                      }
                      b[j >> 1] = h;
                      c[j + 4 >> 2] = 0;
                      b[j + 8 >> 1] = 1024;
                      a[j + 84 >> 0] = 0;
                      c[j + 96 >> 2] = 0;
                      c[j + 92 >> 2] = 0;
                      a[j + 2 >> 0] = 0;
                      c[j + 88 >> 2] = 0
                    }
                  while (0);
                  n = t + 4 | 0;
                  k = c[n >> 2] | 0;
                  if (!k) {
                    L = 98;
                    break b
                  }
                  if ((f | 0) != 0 & (a[k >> 0] | 0) != 47) {
                    m = Hc(f) | 0;
                    k = La(m + 5 + (Hc(k) | 0) | 0) | 0;
                    m = j + 4 | 0;
                    c[m >> 2] = k;
                    if (!k) {
                      L = 101;
                      break b
                    }
                    ef(k, f) | 0;
                    Ye(c[m >> 2] | 0, c[n >> 2] | 0) | 0;
                    k = c[m >> 2] | 0
                  } else {
                    k = ye(k) | 0;
                    c[j + 4 >> 2] = k;
                    if (!k) {
                      L = 104;
                      break b
                    }
                  }
                  if (Qc(k + ((Hc(k) | 0) + -4) | 0, 9795, 4) | 0) {
                    s = k + (Hc(k) | 0) | 0;
                    a[s >> 0] = a[9795] | 0;
                    a[s + 1 >> 0] = a[9796] | 0;
                    a[s + 2 >> 0] = a[9797] | 0;
                    a[s + 3 >> 0] = a[9798] | 0;
                    a[s + 4 >> 0] = a[9799] | 0
                  }
                  a[j + 20 >> 0] = 0;
                  a[j + 32 >> 0] = 0;
                  a[j + 44 >> 0] = 0;
                  a[j + 56 >> 0] = 0;
                  a[j + 68 >> 0] = 0;
                  a[j + 80 >> 0] = 0;
                  p = j + 10 | 0;
                  a[p >> 0] = 0;
                  q = j + 11 | 0;
                  a[q >> 0] = 0;
                  r = j + 8 | 0;
                  s = j + 84 | 0;
                  o = 0;
                  while (1) {
                    n = c[t + (o << 2) >> 2] | 0;
                    if (!n) break d;
                    e: do
                      if (!(Qc(n, 9800, 4) | 0)) {
                        k = n + 4 | 0;
                        if (!(rf(a[k >> 0] | 0) | 0)) {
                          c[B >> 2] = d;
                          c[B + 4 >> 2] = 9800;
                          Ud(9805, B);
                          break
                        } else {
                          b[r >> 1] = ((nc(k) | 0) << 10 | 0) / 100 | 0;
                          break
                        }
                      } else {
                        if (!(Qc(n, 9843, 5) | 0)) {
                          k = n + 5 | 0;
                          if (!(rf(a[k >> 0] | 0) | 0)) {
                            c[C >> 2] = d;
                            c[C + 4 >> 2] = 9843;
                            Ud(9805, C);
                            break
                          } else {
                            a[s >> 0] = nc(k) | 0;
                            break
                          }
                        }
                        if (!(Qc(n, 9849, 8) | 0)) {
                          k = n + 8 | 0;
                          do
                            if (rf(a[k >> 0] | 0) | 0) {
                              m = n + 10 | 0;
                              if (!(rf(a[m >> 0] | 0) | 0)) break;
                              if ((a[n + 9 >> 0] | 0) != 61) break;
                              k = nc(k) | 0;
                              if (k >>> 0 > 5) {
                                c[E >> 2] = d;
                                c[E + 4 >> 2] = 9849;
                                Ud(9805, E);
                                break e
                              }
                              i = +Lf(m);
                              g[j + 12 + (k * 12 | 0) >> 2] = i;
                              if (i > 45.0e3 | i < 1.4700000286102295) {
                                c[F >> 2] = d;
                                c[F + 4 >> 2] = 9849;
                                Ud(9858, F);
                                m = j + 12 + (k * 12 | 0) + 8 | 0;
                                k = a[m >> 0] & -2
                              } else {
                                m = j + 12 + (k * 12 | 0) + 8 | 0;
                                k = a[m >> 0] | 1
                              }
                              a[m >> 0] = k;
                              break e
                            }
                          while (0);
                          c[D >> 2] = d;
                          c[D + 4 >> 2] = 9849;
                          Ud(9805, D);
                          break
                        }
                        if (Qc(n, 9891, 9) | 0) {
                          if (!(Jc(n, 9938) | 0)) {
                            a[p >> 0] = a[p >> 0] | 4;
                            break
                          }
                          if (!(Jc(n, 9948) | 0)) {
                            a[p >> 0] = a[p >> 0] | 64;
                            break
                          }
                          if (!(Jc(n, 9957) | 0)) {
                            a[q >> 0] = a[q >> 0] | 32;
                            break
                          }
                          if (Jc(n, 9972) | 0) break;
                          a[q >> 0] = a[q >> 0] | -128;
                          break
                        }
                        k = n + 9 | 0;
                        do
                          if (rf(a[k >> 0] | 0) | 0) {
                            m = n + 11 | 0;
                            if (!(rf(a[m >> 0] | 0) | 0)) break;
                            if ((a[n + 10 >> 0] | 0) != 61) break;
                            k = nc(k) | 0;
                            if (k >>> 0 > 5) {
                              c[I >> 2] = d;
                              c[I + 4 >> 2] = 9891;
                              Ud(9805, I);
                              break e
                            }
                            i = +Lf(m);
                            g[j + 12 + (k * 12 | 0) + 4 >> 2] = i;
                            if (i > 1.0 | i < 0.0) {
                              c[J >> 2] = d;
                              c[J + 4 >> 2] = 9891;
                              Ud(9901, J);
                              m = j + 12 + (k * 12 | 0) + 8 | 0;
                              k = m;
                              m = a[m >> 0] & -3
                            } else {
                              m = j + 12 + (k * 12 | 0) + 8 | 0;
                              k = m;
                              m = a[m >> 0] | 2
                            }
                            a[k >> 0] = m;
                            break e
                          }
                        while (0);
                        c[G >> 2] = d;
                        c[G + 4 >> 2] = 9891;
                        Ud(9805, G)
                      }
                    while (0);
                    o = o + 1 | 0
                  }
                }
              }
              while (0);
              Xa(t)
            }
            m = h;
            k = u + 1 | 0
          }
          switch (L | 0) {
            case 19:
              {
                Hb(8931, 416, 9, 8947, 0);qc();Xa(t);Xa(w);f = -1;
                break a
              }
            case 21:
              {
                Hb(8931, 422, 1, d, c[($f() | 0) >> 2] | 0);qc();Xa(t);Xa(w);f = -1;
                break a
              }
            case 26:
              {
                Hb(8931, 435, 9, 8981, 0);qc();Xa(t);Xa(w);f = -1;
                break a
              }
            case 29:
              {
                Hb(8931, 443, 1, d, c[($f() | 0) >> 2] | 0);qc();Xa(f);Xa(t);Xa(w);f = -1;
                break a
              }
            case 32:
              {
                Hb(8931, 454, 1, d, c[($f() | 0) >> 2] | 0);qc();Xa(t);Xa(w);f = -1;
                break a
              }
            case 34:
              {
                Xa(t);Xa(w);Xa(f);f = -1;
                break a
              }
            case 38:
              {
                Hb(8931, 471, 9, 9016, 0);qc();Xa(f);Xa(t);Xa(w);f = -1;
                break a
              }
            case 43:
              {
                Hb(8931, 481, 9, 9052, 0);qc();Xa(f);Xa(t);Xa(w);f = -1;
                break a
              }
            case 48:
              {
                Hb(8931, 491, 9, 9101, 0);qc();Xa(f);Xa(t);Xa(w);f = -1;
                break a
              }
            case 56:
              {
                Hb(8931, 508, 9, 9293, 0);qc();Xa(f);Xa(t);Xa(w);f = -1;
                break a
              }
            case 64:
              {
                Hb(8931, 525, 9, 9490, 0);qc();Xa(f);Xa(t);Xa(w);f = -1;
                break a
              }
            case 70:
              {
                Hb(8931, 541, 9, 9596, 0);qc();Xa(f);Xa(t);Xa(w);f = -1;
                break a
              }
            case 82:
              {
                Hb(8931, 567, 1, d, c[($f() | 0) >> 2] | 0);qc();Xa(f);Xa(t);Xa(w);f = -1;
                break a
              }
            case 91:
              {
                Hb(8931, 599, 1, d, 0);qc();Xa(f);Xa(t);Xa(w);f = -1;
                break a
              }
            case 95:
              {
                Hb(8931, 625, 1, d, c[($f() | 0) >> 2] | 0);qc();Xa(f);Xa(t);Xa(w);f = -1;
                break a
              }
            case 98:
              {
                Hb(8931, 645, 9, 9766, 0);qc();Xa(f);Xa(t);Xa(w);f = -1;
                break a
              }
            case 101:
              {
                Hb(8931, 654, 1, d, 0);qc();Xa(f);Xa(t);Xa(w);f = -1;
                break a
              }
            case 104:
              {
                Hb(8931, 665, 1, d, 0);qc();Xa(f);Xa(t);Xa(w);f = -1;
                break a
              }
            case 149:
              {
                qc();Xa(w);f = -1;
                break a
              }
            case 152:
              {
                Xa(w);Xa(f);f = 0;
                break a
              }
          }
        }
      while (0);
      l = M;
      return f | 0
    }

    function Na(b, e, f, g) {
      b = b | 0;
      e = e | 0;
      f = f | 0;
      g = g | 0;
      var h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0;
      m = 0;
      a: do
        if (!f) m = 131;
        else {
          h = a[e >> 0] | 0;
          if (h << 24 >> 24 < 0) {
            g = f + -1 | 0;
            if (!g) {
              m = 131;
              break
            } else {
              i = h & 255;
              k = 1;
              f = g;
              e = e + 1 | 0
            }
          } else {
            i = g & 255;
            k = 0
          }
          h = i & 15;
          switch (((i & 240) + -128 | 0) >>> 4 & 268435455 | 0) {
            case 0:
              break;
            case 1:
              {
                g = a[e + 1 >> 0] | 0;
                if (g << 24 >> 24) {
                  if (f >>> 0 < 2) {
                    m = 131;
                    break a
                  }
                  uc(b, h, a[e >> 0] | 0, g);
                  g = k | 2;
                  break a
                }
                break
              }
            case 2:
              {
                if (f >>> 0 < 2) {
                  m = 131;
                  break a
                }
                Sc(b, h, a[e >> 0] | 0, a[e + 1 >> 0] | 0);g = k | 2;
                break a
              }
            case 3:
              {
                if (f >>> 0 < 2) {
                  m = 131;
                  break a
                }
                Cb(b, h, a[e >> 0] | 0, a[e + 1 >> 0] | 0);g = k | 2;
                break a
              }
            case 4:
              {
                hc(b, h, a[e >> 0] | 0);g = k + 1 | 0;
                break a
              }
            case 5:
              {
                Vc(b, h, a[e >> 0] | 0);g = k + 1 | 0;
                break a
              }
            case 6:
              {
                if (f >>> 0 < 2) {
                  m = 131;
                  break a
                }
                Xc(b, h, (d[e + 1 >> 0] << 7 | a[e >> 0] & 127) & 65535);g = k | 2;
                break a
              }
            case 7:
              {
                b: do switch (i & 15) {
                    case 15:
                      {
                        do switch (a[e >> 0] | 0) {
                          case 0:
                            {
                              if ((a[e + 1 >> 0] | 0) == 2) {
                                if (f >>> 0 < 4) {
                                  m = 131;
                                  break a
                                }
                                ld(b, d[e + 2 >> 0] << 8 | d[e + 3 >> 0]);
                                g = k | 4;
                                break a
                              } else m = 94;
                              break
                            }
                          case 1:
                            {
                              i = e + 1 | 0;h = k + 1 | 0;f = f + -1 | 0;
                              if (!f) {
                                m = 131;
                                break a
                              }
                              g = a[i >> 0] | 0;
                              if (g << 24 >> 24 < 0) {
                                e = 0;
                                j = f;
                                f = i;
                                i = g;
                                while (1) {
                                  e = e << 7 | i & 127;
                                  g = f + 1 | 0;
                                  j = j + -1 | 0;
                                  h = h + 1 | 0;
                                  i = a[g >> 0] | 0;
                                  if (!((j | 0) != 0 & i << 24 >> 24 < 0)) break;
                                  else f = g
                                }
                                if (!j) {
                                  m = 131;
                                  break a
                                } else {
                                  l = e;
                                  k = h;
                                  g = i
                                }
                              } else {
                                l = 0;
                                k = h;
                                j = f;
                                f = e
                              }
                              h = l << 7 | g & 127;g = k + 1 | 0;
                              if ((j + -1 | 0) >>> 0 < h >>> 0) {
                                m = 131;
                                break a
                              }
                              if (!h) break b;l = La(h + 1 | 0) | 0;yb(l | 0, f + 2 | 0, h | 0) | 0;a[l + h >> 0] = 0;dd(b, l);g = h + g | 0;
                              break b
                            }
                          case 2:
                            {
                              j = e + 1 | 0;g = k + 1 | 0;f = f + -1 | 0;
                              if (!f) {
                                m = 131;
                                break a
                              }
                              h = a[j >> 0] | 0;
                              if (h << 24 >> 24 < 0) {
                                i = 0;
                                e = g;
                                while (1) {
                                  i = i << 7 | h & 127;
                                  g = j + 1 | 0;
                                  f = f + -1 | 0;
                                  e = e + 1 | 0;
                                  h = a[g >> 0] | 0;
                                  if (!((f | 0) != 0 & h << 24 >> 24 < 0)) break;
                                  else j = g
                                }
                                if (!f) {
                                  m = 131;
                                  break a
                                } else {
                                  k = e;
                                  g = j
                                }
                              } else {
                                i = 0;
                                k = g;
                                g = e
                              }
                              j = i << 7 | h & 127;e = g + 2 | 0;g = k + 1 | 0;
                              if ((f + -1 | 0) >>> 0 < j >>> 0) {
                                m = 131;
                                break a
                              }
                              if (!j) break b;h = b + 24 | 0;f = c[h >> 2] | 0;
                              if (!f) {
                                f = j + 1 | 0;
                                i = La(f) | 0;
                                c[h >> 2] = i;
                                yb(i | 0, e | 0, j | 0) | 0;
                                h = f;
                                f = 0;
                                i = i + j | 0
                              } else {
                                i = zc(f, j + 2 + (Hc(f) | 0) | 0) | 0;
                                c[h >> 2] = i;
                                yb(i + ((Hc(i) | 0) + 1) | 0, e | 0, j | 0) | 0;
                                h = j + 1 | 0;
                                a[i + (h + (Hc(i) | 0)) >> 0] = 0;
                                f = 10;
                                i = i + (Hc(i) | 0) | 0
                              }
                              a[i >> 0] = f;l = La(h) | 0;yb(l | 0, e | 0, j | 0) | 0;a[l + j >> 0] = 0;$c(b, l);g = j + g | 0;
                              break b
                            }
                          case 3:
                            {
                              i = e + 1 | 0;h = k + 1 | 0;f = f + -1 | 0;
                              if (!f) {
                                m = 131;
                                break a
                              }
                              g = a[i >> 0] | 0;
                              if (g << 24 >> 24 < 0) {
                                e = 0;
                                j = f;
                                f = i;
                                i = g;
                                while (1) {
                                  e = e << 7 | i & 127;
                                  g = f + 1 | 0;
                                  j = j + -1 | 0;
                                  h = h + 1 | 0;
                                  i = a[g >> 0] | 0;
                                  if (!((j | 0) != 0 & i << 24 >> 24 < 0)) break;
                                  else f = g
                                }
                                if (!j) {
                                  m = 131;
                                  break a
                                } else {
                                  l = e;
                                  k = h;
                                  g = i
                                }
                              } else {
                                l = 0;
                                k = h;
                                j = f;
                                f = e
                              }
                              h = l << 7 | g & 127;g = k + 1 | 0;
                              if ((j + -1 | 0) >>> 0 < h >>> 0) {
                                m = 131;
                                break a
                              }
                              if (!h) break b;l = La(h + 1 | 0) | 0;yb(l | 0, f + 2 | 0, h | 0) | 0;a[l + h >> 0] = 0;Zc(b, l);g = h + g | 0;
                              break b
                            }
                          case 4:
                            {
                              i = e + 1 | 0;h = k + 1 | 0;f = f + -1 | 0;
                              if (!f) {
                                m = 131;
                                break a
                              }
                              g = a[i >> 0] | 0;
                              if (g << 24 >> 24 < 0) {
                                e = 0;
                                j = f;
                                f = i;
                                i = g;
                                while (1) {
                                  e = e << 7 | i & 127;
                                  g = f + 1 | 0;
                                  j = j + -1 | 0;
                                  h = h + 1 | 0;
                                  i = a[g >> 0] | 0;
                                  if (!((j | 0) != 0 & i << 24 >> 24 < 0)) break;
                                  else f = g
                                }
                                if (!j) {
                                  m = 131;
                                  break a
                                } else {
                                  l = e;
                                  k = h;
                                  g = i
                                }
                              } else {
                                l = 0;
                                k = h;
                                j = f;
                                f = e
                              }
                              h = l << 7 | g & 127;g = k + 1 | 0;
                              if ((j + -1 | 0) >>> 0 < h >>> 0) {
                                m = 131;
                                break a
                              }
                              if (!h) break b;l = La(h + 1 | 0) | 0;yb(l | 0, f + 2 | 0, h | 0) | 0;a[l + h >> 0] = 0;Yc(b, l);g = h + g | 0;
                              break b
                            }
                          case 5:
                            {
                              j = e + 1 | 0;g = k + 1 | 0;f = f + -1 | 0;
                              if (!f) {
                                m = 131;
                                break a
                              }
                              h = a[j >> 0] | 0;
                              if (h << 24 >> 24 < 0) {
                                k = 0;
                                i = g;
                                e = f;
                                f = j;
                                while (1) {
                                  k = k << 7 | h & 127;
                                  g = f + 1 | 0;
                                  e = e + -1 | 0;
                                  i = i + 1 | 0;
                                  h = a[g >> 0] | 0;
                                  if (!((e | 0) != 0 & h << 24 >> 24 < 0)) break;
                                  else f = g
                                }
                                if (!e) {
                                  m = 131;
                                  break a
                                } else {
                                  g = i;
                                  j = e;
                                  i = k
                                }
                              } else {
                                j = f;
                                i = 0;
                                f = e
                              }
                              h = i << 7 | h & 127;g = g + 1 | 0;
                              if ((j + -1 | 0) >>> 0 < h >>> 0) {
                                m = 131;
                                break a
                              }
                              if (!h) break b;l = La(h + 1 | 0) | 0;yb(l | 0, f + 2 | 0, h | 0) | 0;a[l + h >> 0] = 0;cd(b, l);g = h + g | 0;
                              break b
                            }
                          case 6:
                            {
                              i = e + 1 | 0;h = k + 1 | 0;f = f + -1 | 0;
                              if (!f) {
                                m = 131;
                                break a
                              }
                              g = a[i >> 0] | 0;
                              if (g << 24 >> 24 < 0) {
                                e = 0;
                                j = f;
                                f = i;
                                i = g;
                                while (1) {
                                  e = e << 7 | i & 127;
                                  g = f + 1 | 0;
                                  j = j + -1 | 0;
                                  h = h + 1 | 0;
                                  i = a[g >> 0] | 0;
                                  if (!((j | 0) != 0 & i << 24 >> 24 < 0)) break;
                                  else f = g
                                }
                                if (!j) {
                                  m = 131;
                                  break a
                                } else {
                                  l = e;
                                  k = h;
                                  g = i
                                }
                              } else {
                                l = 0;
                                k = h;
                                j = f;
                                f = e
                              }
                              h = l << 7 | g & 127;g = k + 1 | 0;
                              if ((j + -1 | 0) >>> 0 < h >>> 0) {
                                m = 131;
                                break a
                              }
                              if (!h) break b;l = La(h + 1 | 0) | 0;yb(l | 0, f + 2 | 0, h | 0) | 0;a[l + h >> 0] = 0;ad(b, l);g = h + g | 0;
                              break b
                            }
                          case 7:
                            {
                              i = e + 1 | 0;h = k + 1 | 0;f = f + -1 | 0;
                              if (!f) {
                                m = 131;
                                break a
                              }
                              g = a[i >> 0] | 0;
                              if (g << 24 >> 24 < 0) {
                                e = 0;
                                j = f;
                                f = i;
                                i = g;
                                while (1) {
                                  e = e << 7 | i & 127;
                                  g = f + 1 | 0;
                                  j = j + -1 | 0;
                                  h = h + 1 | 0;
                                  i = a[g >> 0] | 0;
                                  if (!((j | 0) != 0 & i << 24 >> 24 < 0)) break;
                                  else f = g
                                }
                                if (!j) {
                                  m = 131;
                                  break a
                                } else {
                                  l = e;
                                  k = h;
                                  g = i
                                }
                              } else {
                                l = 0;
                                k = h;
                                j = f;
                                f = e
                              }
                              h = l << 7 | g & 127;g = k + 1 | 0;
                              if ((j + -1 | 0) >>> 0 < h >>> 0) {
                                m = 131;
                                break a
                              }
                              if (!h) break b;l = La(h + 1 | 0) | 0;yb(l | 0, f + 2 | 0, h | 0) | 0;a[l + h >> 0] = 0;_c(b, l);g = h + g | 0;
                              break b
                            }
                          case 32:
                            {
                              if ((a[e + 1 >> 0] | 0) == 1) {
                                if (f >>> 0 < 3) {
                                  m = 131;
                                  break a
                                }
                                id(b, d[e + 2 >> 0] | 0);
                                g = k + 3 | 0;
                                break a
                              } else m = 94;
                              break
                            }
                          case 33:
                            {
                              if ((a[e + 1 >> 0] | 0) == 1) {
                                if (f >>> 0 < 3) {
                                  m = 131;
                                  break a
                                }
                                md(b, d[e + 2 >> 0] | 0);
                                g = k + 3 | 0;
                                break a
                              } else m = 94;
                              break
                            }
                          case 47:
                            {
                              if (!(a[e + 1 >> 0] | 0)) {
                                if (f >>> 0 < 2) {
                                  m = 131;
                                  break a
                                }
                                rd(b) | 0;
                                g = k | 2;
                                break a
                              } else m = 94;
                              break
                            }
                          case 81:
                            {
                              if ((a[e + 1 >> 0] | 0) == 3) {
                                if (f >>> 0 < 5) {
                                  m = 131;
                                  break a
                                }
                                nd(b, d[e + 3 >> 0] << 8 | d[e + 2 >> 0] << 16 | d[e + 4 >> 0]) | 0;
                                g = k + 5 | 0;
                                break a
                              } else m = 94;
                              break
                            }
                          case 84:
                            {
                              if ((a[e + 1 >> 0] | 0) == 5) {
                                if (f >>> 0 < 7) {
                                  m = 131;
                                  break a
                                }
                                kd(b, d[e + 4 >> 0] << 16 | d[e + 3 >> 0] << 24 | d[e + 5 >> 0] << 8 | d[e + 6 >> 0]);
                                a[(c[b + 8 >> 2] | 0) + (((c[b + 20 >> 2] | 0) + -1 | 0) * 20 | 0) + 4 >> 0] = a[e + 2 >> 0] | 0;
                                g = k + 7 | 0;
                                break a
                              } else m = 94;
                              break
                            }
                          case 88:
                            {
                              if ((a[e + 1 >> 0] | 0) == 4) {
                                if (f >>> 0 < 6) {
                                  m = 131;
                                  break a
                                }
                                hd(b, d[e + 3 >> 0] << 16 | d[e + 2 >> 0] << 24 | d[e + 4 >> 0] << 8 | d[e + 5 >> 0]);
                                g = k | 6;
                                break a
                              } else m = 94;
                              break
                            }
                          case 89:
                            {
                              g = e + 1 | 0;
                              if ((a[g >> 0] | 0) == 2) {
                                if (f >>> 0 < 4) {
                                  m = 131;
                                  break a
                                }
                                jd(b, d[e + 2 >> 0] << 8 | d[e + 3 >> 0]);
                                g = k | 4;
                                break a
                              } else h = g;
                              break
                            }
                          default:
                            m = 94
                        }
                        while (0);
                        if ((m | 0) == 94) h = e + 1 | 0;i = k + 1 | 0;f = f + -1 | 0;
                        if (!f) {
                          m = 131;
                          break a
                        }
                        g = a[h >> 0] | 0;
                        if (g << 24 >> 24 < 0) {
                          e = 0;
                          do {
                            e = e << 7 | g & 127;
                            h = h + 1 | 0;
                            f = f + -1 | 0;
                            i = i + 1 | 0;
                            g = a[h >> 0] | 0
                          } while ((f | 0) != 0 & g << 24 >> 24 < 0);
                          if (!f) {
                            m = 131;
                            break a
                          } else h = i
                        } else {
                          e = 0;
                          h = i
                        }
                        g = e << 7 | g & 127;
                        if ((f + -1 | 0) >>> 0 < g >>> 0) {
                          m = 131;
                          break a
                        } else g = h + 1 + g | 0;
                        break
                      }
                    case 7:
                    case 0:
                      {
                        g = a[e >> 0] | 0;
                        if (g << 24 >> 24 < 0) {
                          i = 0;
                          h = k;
                          do {
                            i = i << 7 | g & 127;
                            e = e + 1 | 0;
                            f = f + -1 | 0;
                            h = h + 1 | 0;
                            g = a[e >> 0] | 0
                          } while ((f | 0) != 0 & g << 24 >> 24 < 0);
                          if (!f) {
                            m = 131;
                            break a
                          }
                        } else {
                          i = 0;
                          h = k
                        }
                        j = i << 7 | g & 127;g = h + 1 | 0;
                        if ((f + -1 | 0) >>> 0 < j >>> 0) {
                          m = 131;
                          break a
                        }
                        if (j) {
                          i = La(j) | 0;
                          yb(i | 0, e + 1 | 0, j | 0) | 0;
                          do
                            if ((a[i + (j + -1) >> 0] | 0) == -9) {
                              if (!(td(10762, i, 4) | 0)) {
                                h = 4;
                                f = 0
                              } else {
                                if (!(td(10766, i, 5) | 0)) {
                                  sd(b);
                                  break
                                }
                                if (td(10771, i, 8) | 0) break;
                                od(b);
                                break
                              }
                              do {
                                l = (f & 255) + (d[i + h >> 0] | 0) | 0;
                                k = l & 255;
                                f = k >>> 0 > 127 ? k + -128 | 0 : l;
                                l = h;
                                h = h + 1 | 0
                              } while ((a[i + (l + 2) >> 0] | 0) != -9);
                              if ((a[i + h >> 0] | 0) == (128 - f & 255) << 24 >> 24)
                                if ((a[i + 4 >> 0] | 0) == 64) {
                                  h = a[i + 5 >> 0] | 0;
                                  f = h & 255;
                                  if ((f & 240 | 0) == 16)
                                    if ((a[i + 6 >> 0] | 0) == 21) {
                                      h = f & 15;
                                      if (!h) h = 9;
                                      else if (h >>> 0 < 10) h = h + 255 & 255;
                                      else h = h & 255;
                                      Ic(b, h, d[i + 7 >> 0] | 0);
                                      break
                                    }
                                  if (!(h << 24 >> 24))
                                    if ((a[i + 6 >> 0] | 0) == 127)
                                      if (!(a[i + 7 >> 0] | 0)) pd(b)
                                }
                            }
                          while (0);
                          Xa(i);
                          g = j + g | 0
                        }
                        break
                      }
                    default:
                      {
                        Hb(10779, 2434, 7, 10798, 0);g = 0;
                        break a
                      }
                  }
                  while (0);
                  if (!g) m = 130;
                  else break a;
                break
              }
            default:
              m = 130
          }
          if ((m | 0) == 130) {
            Hb(10779, 2444, 7, 10829, 0);
            g = 0;
            break
          }
          if (f >>> 0 < 2) m = 131;
          else {
            Rc(b, h, a[e >> 0] | 0, a[e + 1 >> 0] | 0) | 0;
            g = k | 2
          }
        }
      while (0);
      if ((m | 0) == 131) {
        Hb(10779, 2448, 7, 10845, 0);
        g = 0
      }
      return g | 0
    }

    function Oa(b, e, f, g, h, i) {
      b = b | 0;
      e = +e;
      f = f | 0;
      g = g | 0;
      h = h | 0;
      i = i | 0;
      var j = 0,
        k = 0,
        m = 0,
        n = 0,
        o = 0.0,
        p = 0,
        q = 0,
        r = 0,
        s = 0,
        t = 0,
        u = 0,
        v = 0,
        w = 0,
        x = 0,
        y = 0,
        A = 0,
        B = 0,
        C = 0,
        D = 0,
        E = 0,
        F = 0,
        G = 0;
      t = 0;
      G = l;
      l = l + 560 | 0;
      m = G + 8 | 0;
      u = G;
      F = G + 524 | 0;
      E = F;
      n = G + 512 | 0;
      c[u >> 2] = 0;
      D = n + 12 | 0;
      oe(e) | 0;
      if ((z | 0) < 0) {
        e = -e;
        B = 1;
        A = 12569
      } else {
        B = (h & 2049 | 0) != 0 & 1;
        A = (h & 2048 | 0) == 0 ? ((h & 1 | 0) == 0 ? 12570 : 12575) : 12572
      }
      oe(e) | 0;
      do
        if (0 == 0 & (z & 2146435072 | 0) == 2146435072) {
          F = (i & 32 | 0) != 0;
          j = B + 3 | 0;
          Pc(b, 32, f, j, h & -65537);
          Je(b, A, B);
          Je(b, e != e | 0.0 != 0.0 ? (F ? 12596 : 12600) : F ? 12588 : 12592, 3);
          Pc(b, 32, f, j, h ^ 8192)
        } else {
          e = +tf(e, u) * 2.0;
          j = e != 0.0;
          if (j) c[u >> 2] = (c[u >> 2] | 0) + -1;
          w = i | 32;
          if ((w | 0) == 97) {
            q = i & 32;
            s = (q | 0) == 0 ? A : A + 9 | 0;
            r = B | 2;
            j = 12 - g | 0;
            do
              if (!(g >>> 0 > 11 | (j | 0) == 0)) {
                o = 8.0;
                do {
                  j = j + -1 | 0;
                  o = o * 16.0
                } while ((j | 0) != 0);
                if ((a[s >> 0] | 0) == 45) {
                  e = -(o + (-e - o));
                  break
                } else {
                  e = e + o - o;
                  break
                }
              }
            while (0);
            k = c[u >> 2] | 0;
            j = (k | 0) < 0 ? 0 - k | 0 : k;
            j = Ac(j, ((j | 0) < 0) << 31 >> 31, D) | 0;
            if ((j | 0) == (D | 0)) {
              j = n + 11 | 0;
              a[j >> 0] = 48
            }
            a[j + -1 >> 0] = (k >> 31 & 2) + 43;
            p = j + -2 | 0;
            a[p >> 0] = i + 15;
            m = (g | 0) < 1;
            n = (h & 8 | 0) == 0;
            j = F;
            do {
              C = ~~e;
              k = j + 1 | 0;
              a[j >> 0] = q | d[12604 + C >> 0];
              e = (e - +(C | 0)) * 16.0;
              if ((k - E | 0) == 1)
                if (n & (m & e == 0.0)) j = k;
                else {
                  a[k >> 0] = 46;
                  j = j + 2 | 0
                }
              else j = k
            } while (e != 0.0);
            if (!g) t = 24;
            else if ((-2 - E + j | 0) < (g | 0)) {
              k = j - E | 0;
              j = g + 2 | 0
            } else t = 24;
            if ((t | 0) == 24) {
              j = j - E | 0;
              k = j
            }
            D = D - p | 0;
            E = D + r + j | 0;
            Pc(b, 32, f, E, h);
            Je(b, s, r);
            Pc(b, 48, f, E, h ^ 65536);
            Je(b, F, k);
            Pc(b, 48, j - k | 0, 0, 0);
            Je(b, p, D);
            Pc(b, 32, f, E, h ^ 8192);
            j = E;
            break
          }
          k = (g | 0) < 0 ? 6 : g;
          if (j) {
            j = (c[u >> 2] | 0) + -28 | 0;
            c[u >> 2] = j;
            e = e * 268435456.0
          } else j = c[u >> 2] | 0;
          C = (j | 0) < 0 ? m : m + 288 | 0;
          m = C;
          do {
            y = ~~e >>> 0;
            c[m >> 2] = y;
            m = m + 4 | 0;
            e = (e - +(y >>> 0)) * 1.0e9
          } while (e != 0.0);
          if ((j | 0) > 0) {
            n = C;
            q = m;
            while (1) {
              p = (j | 0) < 29 ? j : 29;
              j = q + -4 | 0;
              if (j >>> 0 >= n >>> 0) {
                m = 0;
                do {
                  x = je(c[j >> 2] | 0, 0, p | 0) | 0;
                  x = te(x | 0, z | 0, m | 0, 0) | 0;
                  y = z;
                  v = Rd(x | 0, y | 0, 1e9, 0) | 0;
                  c[j >> 2] = v;
                  m = Ke(x | 0, y | 0, 1e9, 0) | 0;
                  j = j + -4 | 0
                } while (j >>> 0 >= n >>> 0);
                if (m) {
                  n = n + -4 | 0;
                  c[n >> 2] = m
                }
              }
              m = q;
              while (1) {
                if (m >>> 0 <= n >>> 0) break;
                j = m + -4 | 0;
                if (!(c[j >> 2] | 0)) m = j;
                else break
              }
              j = (c[u >> 2] | 0) - p | 0;
              c[u >> 2] = j;
              if ((j | 0) > 0) q = m;
              else break
            }
          } else n = C;
          if ((j | 0) < 0) {
            g = ((k + 25 | 0) / 9 | 0) + 1 | 0;
            t = (w | 0) == 102;
            do {
              s = 0 - j | 0;
              s = (s | 0) < 9 ? s : 9;
              if (n >>> 0 < m >>> 0) {
                p = (1 << s) + -1 | 0;
                q = 1e9 >>> s;
                r = 0;
                j = n;
                do {
                  y = c[j >> 2] | 0;
                  c[j >> 2] = (y >>> s) + r;
                  r = O(y & p, q) | 0;
                  j = j + 4 | 0
                } while (j >>> 0 < m >>> 0);
                j = (c[n >> 2] | 0) == 0 ? n + 4 | 0 : n;
                if (!r) {
                  n = j;
                  j = m
                } else {
                  c[m >> 2] = r;
                  n = j;
                  j = m + 4 | 0
                }
              } else {
                n = (c[n >> 2] | 0) == 0 ? n + 4 | 0 : n;
                j = m
              }
              m = t ? C : n;
              m = (j - m >> 2 | 0) > (g | 0) ? m + (g << 2) | 0 : j;
              j = (c[u >> 2] | 0) + s | 0;
              c[u >> 2] = j
            } while ((j | 0) < 0);
            j = n;
            g = m
          } else {
            j = n;
            g = m
          }
          y = C;
          if (j >>> 0 < g >>> 0) {
            m = (y - j >> 2) * 9 | 0;
            p = c[j >> 2] | 0;
            if (p >>> 0 >= 10) {
              n = 10;
              do {
                n = n * 10 | 0;
                m = m + 1 | 0
              } while (p >>> 0 >= n >>> 0)
            }
          } else m = 0;
          t = (w | 0) == 103;
          v = (k | 0) != 0;
          n = k - ((w | 0) != 102 ? m : 0) + ((v & t) << 31 >> 31) | 0;
          if ((n | 0) < (((g - y >> 2) * 9 | 0) + -9 | 0)) {
            n = n + 9216 | 0;
            s = C + 4 + (((n | 0) / 9 | 0) + -1024 << 2) | 0;
            n = (n | 0) % 9 | 0;
            if ((n | 0) < 8) {
              p = 10;
              while (1) {
                p = p * 10 | 0;
                if ((n | 0) < 7) n = n + 1 | 0;
                else break
              }
            } else p = 10;
            q = c[s >> 2] | 0;
            r = (q >>> 0) % (p >>> 0) | 0;
            n = (s + 4 | 0) == (g | 0);
            if (n & (r | 0) == 0) n = s;
            else {
              o = (((q >>> 0) / (p >>> 0) | 0) & 1 | 0) == 0 ? 9007199254740992.0 : 9007199254740994.0;
              x = (p | 0) / 2 | 0;
              e = r >>> 0 < x >>> 0 ? .5 : n & (r | 0) == (x | 0) ? 1.0 : 1.5;
              if (B) {
                x = (a[A >> 0] | 0) == 45;
                e = x ? -e : e;
                o = x ? -o : o
              }
              n = q - r | 0;
              c[s >> 2] = n;
              if (o + e != o) {
                x = n + p | 0;
                c[s >> 2] = x;
                if (x >>> 0 > 999999999) {
                  m = s;
                  while (1) {
                    n = m + -4 | 0;
                    c[m >> 2] = 0;
                    if (n >>> 0 < j >>> 0) {
                      j = j + -4 | 0;
                      c[j >> 2] = 0
                    }
                    x = (c[n >> 2] | 0) + 1 | 0;
                    c[n >> 2] = x;
                    if (x >>> 0 > 999999999) m = n;
                    else break
                  }
                } else n = s;
                m = (y - j >> 2) * 9 | 0;
                q = c[j >> 2] | 0;
                if (q >>> 0 >= 10) {
                  p = 10;
                  do {
                    p = p * 10 | 0;
                    m = m + 1 | 0
                  } while (q >>> 0 >= p >>> 0)
                }
              } else n = s
            }
            n = n + 4 | 0;
            n = g >>> 0 > n >>> 0 ? n : g;
            x = j
          } else {
            n = g;
            x = j
          }
          w = n;
          while (1) {
            if (w >>> 0 <= x >>> 0) {
              u = 0;
              break
            }
            j = w + -4 | 0;
            if (!(c[j >> 2] | 0)) w = j;
            else {
              u = 1;
              break
            }
          }
          g = 0 - m | 0;
          do
            if (t) {
              j = k + ((v ^ 1) & 1) | 0;
              if ((j | 0) > (m | 0) & (m | 0) > -5) {
                q = i + -1 | 0;
                k = j + -1 - m | 0
              } else {
                q = i + -2 | 0;
                k = j + -1 | 0
              }
              j = h & 8;
              if (!j) {
                if (u) {
                  p = c[w + -4 >> 2] | 0;
                  if (!p) n = 9;
                  else if (!((p >>> 0) % 10 | 0)) {
                    n = 0;
                    j = 10;
                    do {
                      j = j * 10 | 0;
                      n = n + 1 | 0
                    } while (!((p >>> 0) % (j >>> 0) | 0 | 0))
                  } else n = 0
                } else n = 9;
                j = ((w - y >> 2) * 9 | 0) + -9 | 0;
                if ((q | 32 | 0) == 102) {
                  s = j - n | 0;
                  s = (s | 0) > 0 ? s : 0;
                  k = (k | 0) < (s | 0) ? k : s;
                  s = 0;
                  break
                } else {
                  s = j + m - n | 0;
                  s = (s | 0) > 0 ? s : 0;
                  k = (k | 0) < (s | 0) ? k : s;
                  s = 0;
                  break
                }
              } else s = j
            } else {
              q = i;
              s = h & 8
            }
          while (0);
          t = k | s;
          p = (t | 0) != 0 & 1;
          r = (q | 32 | 0) == 102;
          if (r) {
            v = 0;
            j = (m | 0) > 0 ? m : 0
          } else {
            j = (m | 0) < 0 ? g : m;
            j = Ac(j, ((j | 0) < 0) << 31 >> 31, D) | 0;
            n = D;
            if ((n - j | 0) < 2)
              do {
                j = j + -1 | 0;
                a[j >> 0] = 48
              } while ((n - j | 0) < 2);
            a[j + -1 >> 0] = (m >> 31 & 2) + 43;
            j = j + -2 | 0;
            a[j >> 0] = q;
            v = j;
            j = n - j | 0
          }
          j = B + 1 + k + p + j | 0;
          Pc(b, 32, f, j, h);
          Je(b, A, B);
          Pc(b, 48, f, j, h ^ 65536);
          if (r) {
            p = x >>> 0 > C >>> 0 ? C : x;
            s = F + 9 | 0;
            q = s;
            r = F + 8 | 0;
            n = p;
            do {
              m = Ac(c[n >> 2] | 0, 0, s) | 0;
              if ((n | 0) == (p | 0)) {
                if ((m | 0) == (s | 0)) {
                  a[r >> 0] = 48;
                  m = r
                }
              } else if (m >>> 0 > F >>> 0) {
                Tb(F | 0, 48, m - E | 0) | 0;
                do m = m + -1 | 0; while (m >>> 0 > F >>> 0)
              }
              Je(b, m, q - m | 0);
              n = n + 4 | 0
            } while (n >>> 0 <= C >>> 0);
            if (t | 0) Je(b, 12620, 1);
            if (n >>> 0 < w >>> 0 & (k | 0) > 0)
              while (1) {
                m = Ac(c[n >> 2] | 0, 0, s) | 0;
                if (m >>> 0 > F >>> 0) {
                  Tb(F | 0, 48, m - E | 0) | 0;
                  do m = m + -1 | 0; while (m >>> 0 > F >>> 0)
                }
                Je(b, m, (k | 0) < 9 ? k : 9);
                n = n + 4 | 0;
                m = k + -9 | 0;
                if (!(n >>> 0 < w >>> 0 & (k | 0) > 9)) {
                  k = m;
                  break
                } else k = m
              }
            Pc(b, 48, k + 9 | 0, 9, 0)
          } else {
            t = u ? w : x + 4 | 0;
            if ((k | 0) > -1) {
              u = F + 9 | 0;
              s = (s | 0) == 0;
              g = u;
              q = 0 - E | 0;
              r = F + 8 | 0;
              p = x;
              do {
                m = Ac(c[p >> 2] | 0, 0, u) | 0;
                if ((m | 0) == (u | 0)) {
                  a[r >> 0] = 48;
                  m = r
                }
                do
                  if ((p | 0) == (x | 0)) {
                    n = m + 1 | 0;
                    Je(b, m, 1);
                    if (s & (k | 0) < 1) {
                      m = n;
                      break
                    }
                    Je(b, 12620, 1);
                    m = n
                  } else {
                    if (m >>> 0 <= F >>> 0) break;
                    Tb(F | 0, 48, m + q | 0) | 0;
                    do m = m + -1 | 0; while (m >>> 0 > F >>> 0)
                  }
                while (0);
                E = g - m | 0;
                Je(b, m, (k | 0) > (E | 0) ? E : k);
                k = k - E | 0;
                p = p + 4 | 0
              } while (p >>> 0 < t >>> 0 & (k | 0) > -1)
            }
            Pc(b, 48, k + 18 | 0, 18, 0);
            Je(b, v, D - v | 0)
          }
          Pc(b, 32, f, j, h ^ 8192)
        }
      while (0);
      l = G;
      return ((j | 0) < (f | 0) ? f : j) | 0
    }

    function Pa(d, e, f, g, i) {
      d = d | 0;
      e = e | 0;
      f = f | 0;
      g = g | 0;
      i = i | 0;
      var j = 0,
        k = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 0,
        t = 0,
        u = 0,
        v = 0,
        w = 0,
        x = 0,
        y = 0,
        A = 0,
        B = 0,
        C = 0,
        D = 0,
        E = 0,
        F = 0,
        G = 0,
        H = 0;
      w = 0;
      H = l;
      l = l + 64 | 0;
      D = H + 16 | 0;
      E = H;
      B = H + 24 | 0;
      F = H + 8 | 0;
      G = H + 20 | 0;
      c[D >> 2] = e;
      x = (d | 0) != 0;
      y = B + 40 | 0;
      A = y;
      B = B + 39 | 0;
      C = F + 4 | 0;
      k = 0;
      j = 0;
      p = 0;
      a: while (1) {
        do
          if ((j | 0) > -1)
            if ((k | 0) > (2147483647 - j | 0)) {
              c[($f() | 0) >> 2] = 75;
              j = -1;
              break
            } else {
              j = k + j | 0;
              break
            }
        while (0);
        k = a[e >> 0] | 0;
        if (!(k << 24 >> 24)) {
          w = 86;
          break
        } else m = e;
        b: while (1) {
          switch (k << 24 >> 24) {
            case 37:
              {
                k = m;w = 9;
                break b
              }
            case 0:
              {
                k = m;
                break b
              }
            default:
              {}
          }
          v = m + 1 | 0;
          c[D >> 2] = v;
          k = a[v >> 0] | 0;
          m = v
        }
        c: do
            if ((w | 0) == 9)
              while (1) {
                w = 0;
                if ((a[m + 1 >> 0] | 0) != 37) break c;
                k = k + 1 | 0;
                m = m + 2 | 0;
                c[D >> 2] = m;
                if ((a[m >> 0] | 0) == 37) w = 9;
                else break
              }
          while (0);
          k = k - e | 0;
        if (x) Je(d, e, k);
        if (k | 0) {
          e = m;
          continue
        }
        n = m + 1 | 0;
        k = (a[n >> 0] | 0) + -48 | 0;
        if (k >>> 0 < 10) {
          v = (a[m + 2 >> 0] | 0) == 36;
          t = v ? k : -1;
          p = v ? 1 : p;
          n = v ? m + 3 | 0 : n
        } else t = -1;
        c[D >> 2] = n;
        k = a[n >> 0] | 0;
        v = (k << 24 >> 24) + -32 | 0;
        if (v >>> 0 > 31 | (1 << v & 75913 | 0) == 0) m = 0;
        else {
          m = 0;
          do {
            m = 1 << (k << 24 >> 24) + -32 | m;
            n = n + 1 | 0;
            c[D >> 2] = n;
            k = a[n >> 0] | 0;
            v = (k << 24 >> 24) + -32 | 0
          } while (!(v >>> 0 > 31 | (1 << v & 75913 | 0) == 0))
        }
        if (k << 24 >> 24 == 42) {
          o = n + 1 | 0;
          k = (a[o >> 0] | 0) + -48 | 0;
          if (k >>> 0 < 10)
            if ((a[n + 2 >> 0] | 0) == 36) {
              c[i + (k << 2) >> 2] = 10;
              k = c[g + ((a[o >> 0] | 0) + -48 << 3) >> 2] | 0;
              p = 1;
              n = n + 3 | 0
            } else w = 22;
          else w = 22;
          if ((w | 0) == 22) {
            w = 0;
            if (p | 0) {
              j = -1;
              break
            }
            if (x) {
              p = (c[f >> 2] | 0) + (4 - 1) & ~(4 - 1);
              k = c[p >> 2] | 0;
              c[f >> 2] = p + 4;
              p = 0;
              n = o
            } else {
              k = 0;
              p = 0;
              n = o
            }
          }
          c[D >> 2] = n;
          u = (k | 0) < 0;
          k = u ? 0 - k | 0 : k;
          u = u ? m | 8192 : m
        } else {
          k = Jd(D) | 0;
          if ((k | 0) < 0) {
            j = -1;
            break
          }
          u = m;
          n = c[D >> 2] | 0
        }
        do
          if ((a[n >> 0] | 0) == 46) {
            if ((a[n + 1 >> 0] | 0) != 42) {
              c[D >> 2] = n + 1;
              m = Jd(D) | 0;
              n = c[D >> 2] | 0;
              break
            }
            o = n + 2 | 0;
            m = (a[o >> 0] | 0) + -48 | 0;
            if (m >>> 0 < 10)
              if ((a[n + 3 >> 0] | 0) == 36) {
                c[i + (m << 2) >> 2] = 10;
                m = c[g + ((a[o >> 0] | 0) + -48 << 3) >> 2] | 0;
                n = n + 4 | 0;
                c[D >> 2] = n;
                break
              }
            if (p | 0) {
              j = -1;
              break a
            }
            if (x) {
              v = (c[f >> 2] | 0) + (4 - 1) & ~(4 - 1);
              m = c[v >> 2] | 0;
              c[f >> 2] = v + 4
            } else m = 0;
            c[D >> 2] = o;
            n = o
          } else m = -1; while (0);
        s = 0;
        while (1) {
          if (((a[n >> 0] | 0) + -65 | 0) >>> 0 > 57) {
            j = -1;
            break a
          }
          v = n + 1 | 0;
          c[D >> 2] = v;
          o = a[(a[n >> 0] | 0) + -65 + (12088 + (s * 58 | 0)) >> 0] | 0;
          q = o & 255;
          if ((q + -1 | 0) >>> 0 < 8) {
            s = q;
            n = v
          } else break
        }
        if (!(o << 24 >> 24)) {
          j = -1;
          break
        }
        r = (t | 0) > -1;
        do
          if (o << 24 >> 24 == 19)
            if (r) {
              j = -1;
              break a
            } else w = 48;
        else {
          if (r) {
            c[i + (t << 2) >> 2] = q;
            r = g + (t << 3) | 0;
            t = c[r + 4 >> 2] | 0;
            w = E;
            c[w >> 2] = c[r >> 2];
            c[w + 4 >> 2] = t;
            w = 48;
            break
          }
          if (!x) {
            j = 0;
            break a
          }
          nb(E, q, f)
        } while (0);
        if ((w | 0) == 48) {
          w = 0;
          if (!x) {
            k = 0;
            e = v;
            continue
          }
        }
        n = a[n >> 0] | 0;
        n = (s | 0) != 0 & (n & 15 | 0) == 3 ? n & -33 : n;
        t = u & -65537;
        u = (u & 8192 | 0) == 0 ? u : t;
        d: do switch (n | 0) {
            case 110:
              switch ((s & 255) << 24 >> 24) {
                case 0:
                  {
                    c[c[E >> 2] >> 2] = j;k = 0;e = v;
                    continue a
                  }
                case 1:
                  {
                    c[c[E >> 2] >> 2] = j;k = 0;e = v;
                    continue a
                  }
                case 2:
                  {
                    k = c[E >> 2] | 0;c[k >> 2] = j;c[k + 4 >> 2] = ((j | 0) < 0) << 31 >> 31;k = 0;e = v;
                    continue a
                  }
                case 3:
                  {
                    b[c[E >> 2] >> 1] = j;k = 0;e = v;
                    continue a
                  }
                case 4:
                  {
                    a[c[E >> 2] >> 0] = j;k = 0;e = v;
                    continue a
                  }
                case 6:
                  {
                    c[c[E >> 2] >> 2] = j;k = 0;e = v;
                    continue a
                  }
                case 7:
                  {
                    k = c[E >> 2] | 0;c[k >> 2] = j;c[k + 4 >> 2] = ((j | 0) < 0) << 31 >> 31;k = 0;e = v;
                    continue a
                  }
                default:
                  {
                    k = 0;e = v;
                    continue a
                  }
              }
            case 112:
              {
                n = 120;m = m >>> 0 > 8 ? m : 8;e = u | 8;w = 60;
                break
              }
            case 88:
            case 120:
              {
                e = u;w = 60;
                break
              }
            case 111:
              {
                n = E;e = c[n >> 2] | 0;n = c[n + 4 >> 2] | 0;r = Td(e, n, y) | 0;s = A - r | 0;o = 0;q = 12552;m = (u & 8 | 0) == 0 | (m | 0) > (s | 0) ? m : s + 1 | 0;s = u;w = 66;
                break
              }
            case 105:
            case 100:
              {
                n = E;e = c[n >> 2] | 0;n = c[n + 4 >> 2] | 0;
                if ((n | 0) < 0) {
                  e = ne(0, 0, e | 0, n | 0) | 0;
                  n = z;
                  o = E;
                  c[o >> 2] = e;
                  c[o + 4 >> 2] = n;
                  o = 1;
                  q = 12552;
                  w = 65;
                  break d
                } else {
                  o = (u & 2049 | 0) != 0 & 1;
                  q = (u & 2048 | 0) == 0 ? ((u & 1 | 0) == 0 ? 12552 : 12554) : 12553;
                  w = 65;
                  break d
                }
              }
            case 117:
              {
                n = E;o = 0;q = 12552;e = c[n >> 2] | 0;n = c[n + 4 >> 2] | 0;w = 65;
                break
              }
            case 99:
              {
                a[B >> 0] = c[E >> 2];e = B;o = 0;q = 12552;r = y;n = 1;m = t;
                break
              }
            case 109:
              {
                n = Ve(c[($f() | 0) >> 2] | 0) | 0;w = 70;
                break
              }
            case 115:
              {
                n = c[E >> 2] | 0;n = n | 0 ? n : 12562;w = 70;
                break
              }
            case 67:
              {
                c[F >> 2] = c[E >> 2];c[C >> 2] = 0;c[E >> 2] = F;r = -1;n = F;w = 74;
                break
              }
            case 83:
              {
                e = c[E >> 2] | 0;
                if (!m) {
                  Pc(d, 32, k, 0, u);
                  e = 0;
                  w = 83
                } else {
                  r = m;
                  n = e;
                  w = 74
                }
                break
              }
            case 65:
            case 71:
            case 70:
            case 69:
            case 97:
            case 103:
            case 102:
            case 101:
              {
                k = Oa(d, +h[E >> 3], k, m, u, n) | 0;e = v;
                continue a
              }
            default:
              {
                o = 0;q = 12552;r = y;n = m;m = u
              }
          }
          while (0);
          e: do
            if ((w | 0) == 60) {
              u = E;
              t = c[u >> 2] | 0;
              u = c[u + 4 >> 2] | 0;
              r = Md(t, u, y, n & 32) | 0;
              q = (e & 8 | 0) == 0 | (t | 0) == 0 & (u | 0) == 0;
              o = q ? 0 : 2;
              q = q ? 12552 : 12552 + (n >> 4) | 0;
              s = e;
              e = t;
              n = u;
              w = 66
            } else
        if ((w | 0) == 65) {
          r = Ac(e, n, y) | 0;
          s = u;
          w = 66
        } else if ((w | 0) == 70) {
          w = 0;
          u = Lb(n, 0, m) | 0;
          s = (u | 0) == 0;
          e = n;
          o = 0;
          q = 12552;
          r = s ? n + m | 0 : u;
          n = s ? m : u - n | 0;
          m = t
        } else if ((w | 0) == 74) {
          w = 0;
          q = n;
          e = 0;
          m = 0;
          while (1) {
            o = c[q >> 2] | 0;
            if (!o) break;
            m = Qe(G, o) | 0;
            if ((m | 0) < 0 | m >>> 0 > (r - e | 0) >>> 0) break;
            e = m + e | 0;
            if (r >>> 0 > e >>> 0) q = q + 4 | 0;
            else break
          }
          if ((m | 0) < 0) {
            j = -1;
            break a
          }
          Pc(d, 32, k, e, u);
          if (!e) {
            e = 0;
            w = 83
          } else {
            o = 0;
            while (1) {
              m = c[n >> 2] | 0;
              if (!m) {
                w = 83;
                break e
              }
              m = Qe(G, m) | 0;
              o = m + o | 0;
              if ((o | 0) > (e | 0)) {
                w = 83;
                break e
              }
              Je(d, G, m);
              if (o >>> 0 >= e >>> 0) {
                w = 83;
                break
              } else n = n + 4 | 0
            }
          }
        }
        while (0);
        if ((w | 0) == 66) {
          w = 0;
          n = (e | 0) != 0 | (n | 0) != 0;
          u = (m | 0) != 0 | n;
          n = A - r + ((n ^ 1) & 1) | 0;
          e = u ? r : y;
          r = y;
          n = u ? ((m | 0) > (n | 0) ? m : n) : m;
          m = (m | 0) > -1 ? s & -65537 : s
        } else if ((w | 0) == 83) {
          w = 0;
          Pc(d, 32, k, e, u ^ 8192);
          k = (k | 0) > (e | 0) ? k : e;
          e = v;
          continue
        }
        t = r - e | 0;
        s = (n | 0) < (t | 0) ? t : n;
        u = s + o | 0;
        k = (k | 0) < (u | 0) ? u : k;
        Pc(d, 32, k, u, m);
        Je(d, q, o);
        Pc(d, 48, k, u, m ^ 65536);
        Pc(d, 48, s, t, 0);
        Je(d, e, t);
        Pc(d, 32, k, u, m ^ 8192);
        e = v
      }
      f: do
        if ((w | 0) == 86)
          if (!d)
            if (!p) j = 0;
            else {
              j = 1;
              while (1) {
                e = c[i + (j << 2) >> 2] | 0;
                if (!e) break;
                nb(g + (j << 3) | 0, e, f);
                e = j + 1 | 0;
                if ((j | 0) < 9) j = e;
                else {
                  j = e;
                  break
                }
              }
              if ((j | 0) < 10)
                while (1) {
                  if (c[i + (j << 2) >> 2] | 0) {
                    j = -1;
                    break f
                  }
                  if ((j | 0) < 9) j = j + 1 | 0;
                  else {
                    j = 1;
                    break
                  }
                } else j = 1
            }
      while (0);
      l = H;
      return j | 0
    }

    function Qa(a, b, e, f, g, h) {
      a = a | 0;
      b = b | 0;
      e = e | 0;
      f = f | 0;
      g = g | 0;
      h = h | 0;
      var i = 0.0,
        j = 0,
        k = 0,
        m = 0.0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0.0,
        s = 0.0,
        t = 0,
        u = 0.0,
        v = 0,
        w = 0,
        x = 0,
        y = 0,
        A = 0,
        C = 0,
        D = 0,
        E = 0,
        F = 0,
        G = 0,
        H = 0,
        I = 0,
        J = 0.0;
      C = 0;
      I = l;
      l = l + 512 | 0;
      F = I;
      G = f + e | 0;
      H = 0 - G | 0;
      D = a + 4 | 0;
      E = a + 100 | 0;
      j = 0;
      a: while (1) {
        switch (b | 0) {
          case 46:
            {
              C = 6;
              break a
            }
          case 48:
            break;
          default:
            {
              v = 0;p = j;q = 0;o = 0;
              break a
            }
        }
        b = c[D >> 2] | 0;
        if (b >>> 0 < (c[E >> 2] | 0) >>> 0) {
          c[D >> 2] = b + 1;
          b = d[b >> 0] | 0;
          j = 1;
          continue
        } else {
          b = Ub(a) | 0;
          j = 1;
          continue
        }
      }
      if ((C | 0) == 6) {
        b = c[D >> 2] | 0;
        if (b >>> 0 < (c[E >> 2] | 0) >>> 0) {
          c[D >> 2] = b + 1;
          b = d[b >> 0] | 0
        } else b = Ub(a) | 0;
        if ((b | 0) == 48) {
          j = 0;
          b = 0;
          while (1) {
            j = te(j | 0, b | 0, -1, -1) | 0;
            o = z;
            b = c[D >> 2] | 0;
            if (b >>> 0 < (c[E >> 2] | 0) >>> 0) {
              c[D >> 2] = b + 1;
              b = d[b >> 0] | 0
            } else b = Ub(a) | 0;
            if ((b | 0) == 48) b = o;
            else {
              v = 1;
              p = 1;
              q = j;
              break
            }
          }
        } else {
          v = 1;
          p = j;
          q = 0;
          o = 0
        }
      }
      c[F >> 2] = 0;
      n = b + -48 | 0;
      k = (b | 0) == 46;
      b: do
        if (k | n >>> 0 < 10) {
          C = F + 496 | 0;
          w = 0;
          j = 0;
          t = 0;
          x = v;
          y = p;
          A = n;
          p = 0;
          n = 0;
          c: while (1) {
            do
              if (k)
                if (!x) {
                  x = 1;
                  q = p;
                  o = n
                } else break c;
            else {
              p = te(p | 0, n | 0, 1, 0) | 0;
              n = z;
              v = (b | 0) != 48;
              if ((j | 0) >= 125) {
                if (!v) break;
                c[C >> 2] = c[C >> 2] | 1;
                break
              }
              k = F + (j << 2) | 0;
              if (!w) b = A;
              else b = b + -48 + ((c[k >> 2] | 0) * 10 | 0) | 0;
              c[k >> 2] = b;
              w = w + 1 | 0;
              y = (w | 0) == 9;
              w = y ? 0 : w;
              j = j + (y & 1) | 0;
              t = v ? p : t;
              y = 1
            } while (0);
            b = c[D >> 2] | 0;
            if (b >>> 0 < (c[E >> 2] | 0) >>> 0) {
              c[D >> 2] = b + 1;
              b = d[b >> 0] | 0
            } else b = Ub(a) | 0;
            A = b + -48 | 0;
            k = (b | 0) == 46;
            if (!(k | A >>> 0 < 10)) {
              v = x;
              k = y;
              C = 29;
              break b
            }
          }
          b = w;
          k = (y | 0) != 0;
          C = 37
        } else {
          w = 0;
          j = 0;
          t = 0;
          k = p;
          p = 0;
          n = 0;
          C = 29
        }
      while (0);
      do
        if ((C | 0) == 29) {
          A = (v | 0) == 0;
          q = A ? p : q;
          o = A ? n : o;
          k = (k | 0) != 0;
          if (!(k & (b | 32 | 0) == 101))
            if ((b | 0) > -1) {
              b = w;
              C = 37;
              break
            } else {
              b = w;
              C = 39;
              break
            }
          k = ob(a, h) | 0;
          b = z;
          if ((k | 0) == 0 & (b | 0) == -2147483648) {
            if (!h) {
              Od(a, 0);
              i = 0.0;
              break
            }
            if (!(c[E >> 2] | 0)) {
              k = 0;
              b = 0
            } else {
              c[D >> 2] = (c[D >> 2] | 0) + -1;
              k = 0;
              b = 0
            }
          }
          y = te(k | 0, b | 0, q | 0, o | 0) | 0;
          b = w;
          o = z;
          C = 41
        }
      while (0);
      if ((C | 0) == 37)
        if (!(c[E >> 2] | 0)) C = 39;
        else {
          c[D >> 2] = (c[D >> 2] | 0) + -1;
          if (k) {
            y = q;
            C = 41
          } else C = 40
        }
      if ((C | 0) == 39)
        if (k) {
          y = q;
          C = 41
        } else C = 40;
      do
        if ((C | 0) == 40) {
          c[($f() | 0) >> 2] = 22;
          Od(a, 0);
          i = 0.0
        } else if ((C | 0) == 41) {
        k = c[F >> 2] | 0;
        if (!k) {
          i = +(g | 0) * 0.0;
          break
        }
        if (((n | 0) < 0 | (n | 0) == 0 & p >>> 0 < 10) & ((y | 0) == (p | 0) & (o | 0) == (n | 0)))
          if ((e | 0) > 30 | (k >>> e | 0) == 0) {
            i = +(g | 0) * +(k >>> 0);
            break
          }
        a = (f | 0) / -2 | 0;
        E = ((a | 0) < 0) << 31 >> 31;
        if ((o | 0) > (E | 0) | (o | 0) == (E | 0) & y >>> 0 > a >>> 0) {
          c[($f() | 0) >> 2] = 34;
          i = +(g | 0) * 1797693134862315708145274.0e284 * 1797693134862315708145274.0e284;
          break
        }
        a = f + -106 | 0;
        E = ((a | 0) < 0) << 31 >> 31;
        if ((o | 0) < (E | 0) | (o | 0) == (E | 0) & y >>> 0 < a >>> 0) {
          c[($f() | 0) >> 2] = 34;
          i = +(g | 0) * 2.2250738585072014e-308 * 2.2250738585072014e-308;
          break
        }
        if (b) {
          if ((b | 0) < 9) {
            n = F + (j << 2) | 0;
            k = c[n >> 2] | 0;
            while (1) {
              k = k * 10 | 0;
              if ((b | 0) >= 8) break;
              else b = b + 1 | 0
            }
            c[n >> 2] = k
          }
          j = j + 1 | 0
        }
        if ((t | 0) < 9)
          if ((t | 0) <= (y | 0) & (y | 0) < 18) {
            if ((y | 0) == 9) {
              i = +(g | 0) * +((c[F >> 2] | 0) >>> 0);
              break
            }
            if ((y | 0) < 9) {
              i = +(g | 0) * +((c[F >> 2] | 0) >>> 0) / +(c[7904 + (8 - y << 2) >> 2] | 0);
              break
            }
            a = e + 27 + (O(y, -3) | 0) | 0;
            b = c[F >> 2] | 0;
            if ((a | 0) > 30 | (b >>> a | 0) == 0) {
              i = +(g | 0) * +(b >>> 0) * +(c[7904 + (y + -10 << 2) >> 2] | 0);
              break
            }
          }
        b = (y | 0) % 9 | 0;
        if (!b) {
          b = 0;
          n = 0
        } else {
          t = (y | 0) > -1 ? b : b + 9 | 0;
          p = c[7904 + (8 - t << 2) >> 2] | 0;
          if (!j) {
            n = 0;
            j = 0;
            k = y
          } else {
            q = 1e9 / (p | 0) | 0;
            n = 0;
            o = 0;
            k = y;
            b = 0;
            do {
              D = F + (b << 2) | 0;
              E = c[D >> 2] | 0;
              a = ((E >>> 0) / (p >>> 0) | 0) + n | 0;
              c[D >> 2] = a;
              n = O(q, (E >>> 0) % (p >>> 0) | 0) | 0;
              a = (b | 0) == (o | 0) & (a | 0) == 0;
              k = a ? k + -9 | 0 : k;
              o = a ? o + 1 & 127 : o;
              b = b + 1 | 0
            } while ((b | 0) != (j | 0));
            if (!n) n = o;
            else {
              c[F + (j << 2) >> 2] = n;
              n = o;
              j = j + 1 | 0
            }
          }
          b = 0;
          y = 9 - t + k | 0
        }
        d: while (1) {
          t = (y | 0) < 18;
          v = (y | 0) == 18;
          w = F + (n << 2) | 0;
          while (1) {
            if (!t) {
              if (!v) {
                k = y;
                break d
              }
              if ((c[w >> 2] | 0) >>> 0 >= 9007199) {
                k = 18;
                break d
              }
            }
            k = 0;
            x = j;
            j = j + 127 | 0;
            while (1) {
              o = j & 127;
              p = F + (o << 2) | 0;
              j = je(c[p >> 2] | 0, 0, 29) | 0;
              j = te(j | 0, z | 0, k | 0, 0) | 0;
              k = z;
              if (k >>> 0 > 0 | (k | 0) == 0 & j >>> 0 > 1e9) {
                q = Ke(j | 0, k | 0, 1e9, 0) | 0;
                j = Rd(j | 0, k | 0, 1e9, 0) | 0
              } else q = 0;
              c[p >> 2] = j;
              a = (o | 0) == (n | 0);
              x = (j | 0) == 0 & (((o | 0) != (x + 127 & 127 | 0) | a) ^ 1) ? o : x;
              if (a) break;
              else {
                k = q;
                j = o + -1 | 0
              }
            }
            b = b + -29 | 0;
            if (q | 0) break;
            else j = x
          }
          n = n + 127 & 127;
          j = x + 127 & 127;
          k = F + ((x + 126 & 127) << 2) | 0;
          if ((n | 0) == (x | 0)) c[k >> 2] = c[k >> 2] | c[F + (j << 2) >> 2];
          else j = x;
          c[F + (n << 2) >> 2] = q;
          y = y + 9 | 0
        }
        e: while (1) {
          x = j + 1 & 127;
          y = F + ((j + 127 & 127) << 2) | 0;
          v = k;
          while (1) {
            p = (v | 0) == 18;
            w = (v | 0) > 27 ? 9 : 1;
            A = n;
            while (1) {
              o = 0;
              while (1) {
                k = o + A & 127;
                if ((k | 0) == (j | 0)) {
                  k = 2;
                  C = 88;
                  break
                }
                k = c[F + (k << 2) >> 2] | 0;
                n = c[7936 + (o << 2) >> 2] | 0;
                if (k >>> 0 < n >>> 0) {
                  k = 2;
                  C = 88;
                  break
                }
                if (k >>> 0 > n >>> 0) break;
                k = o + 1 | 0;
                if ((o | 0) < 1) o = k;
                else {
                  C = 88;
                  break
                }
              }
              if ((C | 0) == 88) {
                C = 0;
                if (p & (k | 0) == 2) {
                  i = 0.0;
                  o = 0;
                  break e
                }
              }
              b = w + b | 0;
              if ((A | 0) == (j | 0)) A = j;
              else break
            }
            q = (1 << w) + -1 | 0;
            t = 1e9 >>> w;
            p = 0;
            n = A;
            k = v;
            o = A;
            do {
              D = F + (o << 2) | 0;
              E = c[D >> 2] | 0;
              a = (E >>> w) + p | 0;
              c[D >> 2] = a;
              p = O(E & q, t) | 0;
              a = (o | 0) == (n | 0) & (a | 0) == 0;
              k = a ? k + -9 | 0 : k;
              n = a ? n + 1 & 127 : n;
              o = o + 1 & 127
            } while ((o | 0) != (j | 0));
            if (!p) {
              v = k;
              continue
            }
            if ((x | 0) != (n | 0)) break;
            c[y >> 2] = c[y >> 2] | 1;
            v = k
          }
          c[F + (j << 2) >> 2] = p;
          j = x
        }
        do {
          n = o + A & 127;
          k = j + 1 & 127;
          if ((n | 0) == (j | 0)) {
            c[F + (k + -1 << 2) >> 2] = 0;
            j = k
          }
          i = i * 1.0e9 + +((c[F + (n << 2) >> 2] | 0) >>> 0);
          o = o + 1 | 0
        } while ((o | 0) != 2);
        u = +(g | 0);
        m = i * u;
        n = b + 53 | 0;
        p = n - f | 0;
        q = (p | 0) < (e | 0);
        o = q ? ((p | 0) > 0 ? p : 0) : e;
        if ((o | 0) < 53) {
          J = +kf(+oc(1.0, 105 - o | 0), m);
          r = +Ef(m, +oc(1.0, 53 - o | 0));
          s = J;
          i = r;
          r = J + (m - r)
        } else {
          s = 0.0;
          i = 0.0;
          r = m
        }
        k = A + 2 & 127;
        if ((k | 0) == (j | 0)) m = i;
        else {
          k = c[F + (k << 2) >> 2] | 0;
          do
            if (k >>> 0 < 5e8) {
              if (!k)
                if ((A + 3 & 127 | 0) == (j | 0)) break;
              i = u * .25 + i
            } else {
              if ((k | 0) != 5e8) {
                i = u * .75 + i;
                break
              }
              if ((A + 3 & 127 | 0) == (j | 0)) {
                i = u * .5 + i;
                break
              } else {
                i = u * .75 + i;
                break
              }
            }
          while (0);
          if ((53 - o | 0) > 1)
            if (+Ef(i, 1.0) != 0.0) m = i;
            else m = i + 1.0;
          else m = i
        }
        i = r + m - s;
        do
          if ((n & 2147483647 | 0) > (-2 - G | 0)) {
            j = !(+B(+i) >= 9007199254740992.0);
            b = b + ((j ^ 1) & 1) | 0;
            i = j ? i : i * .5;
            if ((b + 50 | 0) <= (H | 0))
              if (!(m != 0.0 & (q & ((o | 0) != (p | 0) | j)))) break;
            c[($f() | 0) >> 2] = 34
          }
        while (0);
        i = +nf(i, b)
      } while (0);
      l = I;
      return +i
    }

    function Ra(b, f) {
      b = b | 0;
      f = f | 0;
      var h = 0,
        i = 0.0,
        j = 0.0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 0,
        t = 0,
        u = 0,
        v = 0,
        w = 0,
        x = 0,
        y = 0,
        z = 0,
        A = 0,
        B = 0,
        C = 0,
        D = 0,
        E = 0,
        F = 0,
        G = 0.0;
      a: do
        if (f >>> 0 < 14) {
          Hb(11010, 68, 7, 11027, 0);
          b = 0
        } else {
          do
            if (!(td(b, 11039, 4) | 0))
              if (f >>> 0 < 34) {
                Hb(11010, 74, 7, 11027, 0);
                b = 0;
                break a
              } else {
                h = b + 20 | 0;
                f = f + -20 | 0;
                break
              }
          else h = b; while (0);
          if (td(h, 11044, 4) | 0) {
            Hb(11010, 82, 11, 0, 0);
            b = 0;
            break
          }
          if ((d[h + 5 >> 0] << 16 | d[h + 4 >> 0] << 24 | d[h + 6 >> 0] << 8 | d[h + 7 >> 0] | 0) != 6) {
            Hb(11010, 97, 7, 0, 0);
            b = 0;
            break
          }
          u = d[h + 8 >> 0] << 8 | d[h + 9 >> 0];
          if (u >>> 0 > 2) {
            Hb(11010, 108, 6, 0, 0);
            b = 0;
            break
          }
          z = d[h + 10 >> 0] << 8 | d[h + 11 >> 0];
          if (!z) {
            Hb(11010, 120, 7, 11049, 0);
            b = 0;
            break
          }
          if ((u | 0) == 0 & (z | 0) != 1) {
            Hb(11010, 129, 6, 11061, 0);
            b = 0;
            break
          }
          F = d[h + 12 >> 0] << 8;
          A = F | d[h + 13 >> 0];
          if (F & 32768 | 0) {
            Hb(11010, 140, 6, 0, 0);
            b = 0;
            break
          }
          i = +Le(A, 5e5);
          b = vc() | 0;
          gd(b, A) | 0;
          D = z << 2;
          B = La(D) | 0;
          C = La(D) | 0;
          D = La(D) | 0;
          E = La(z) | 0;
          F = La(z) | 0;
          s = (u | 0) == 1;
          t = -1;
          r = 0;
          h = h + 14 | 0;
          f = f + -14 | 0;
          while (1) {
            if (r >>> 0 >= z >>> 0) {
              v = 36;
              break
            }
            if (f >>> 0 < 8) {
              v = 22;
              break
            }
            if (td(h, 11113, 4) | 0) {
              v = 24;
              break
            }
            k = h + 8 | 0;
            q = d[h + 5 >> 0] << 16 | d[h + 4 >> 0] << 24 | d[h + 6 >> 0] << 8 | d[h + 7 >> 0];
            p = f + -8 | 0;
            if (p >>> 0 < q >>> 0) {
              v = 26;
              break
            }
            if (q >>> 0 < 3) {
              v = 28;
              break
            }
            if ((a[k + (q + -3) >> 0] | 0) != -1) {
              v = 32;
              break
            }
            if ((a[k + (q + -2) >> 0] | 0) != 47) {
              v = 32;
              break
            }
            if (a[k + (q + -1) >> 0] | 0) {
              v = 32;
              break
            }
            m = B + (r << 2) | 0;
            c[m >> 2] = k;
            n = C + (r << 2) | 0;
            c[n >> 2] = q;
            h = k + q | 0;
            a[E + r >> 0] = 0;
            a[F + r >> 0] = 0;
            o = D + (r << 2) | 0;
            c[o >> 2] = 0;
            f = k;
            k = 0;
            l = q;
            do {
              y = a[f >> 0] | 0;
              k = k << 7 | y & 127;
              f = f + 1 | 0;
              l = l + -1 | 0
            } while (y << 24 >> 24 < 0);
            c[m >> 2] = f;
            c[o >> 2] = k;
            c[n >> 2] = l;
            t = (s ? k >>> 0 < t >>> 0 : (r | 0) == 0) ? k : t;
            r = r + 1 | 0;
            f = p - q | 0
          }
          b: do
            if ((v | 0) == 22) Hb(11010, 158, 7, 11027, 0);
            else
          if ((v | 0) == 24) Hb(11010, 162, 7, 11118, 0);
          else if ((v | 0) == 26) Hb(11010, 175, 7, 11027, 0);
          else if ((v | 0) == 28) Hb(11010, 179, 7, 11141, 0);
          else if ((v | 0) == 32) Hb(11010, 185, 7, 11158, 0);
          else if ((v | 0) == 36) {
            j = i * +(t >>> 0) + 0.0;
            f = ~~j >>> 0;
            w = b + 8 | 0;
            x = b + 16 | 0;
            y = (c[w >> 2] | 0) + (((c[x >> 2] | 0) + -1 | 0) * 20 | 0) + 12 | 0;
            c[y >> 2] = (c[y >> 2] | 0) + f;
            y = b + 32 | 0;
            c[y >> 2] = (c[y >> 2] | 0) + f;
            c: do switch ((u & 65535) << 16 >> 16) {
                case 1:
                  {
                    j = j - +(f >>> 0);f = 0;d: while (1) {
                      if ((f | 0) == (z | 0)) break c;
                      else {
                        u = 0;
                        s = 0
                      }
                      while (1) {
                        if (u >>> 0 >= z >>> 0) break;
                        q = E + u | 0;
                        do
                          if (!(a[q >> 0] | 0)) {
                            r = D + (u << 2) | 0;
                            h = c[r >> 2] | 0;
                            if (h | 0) {
                              h = h - t | 0;
                              c[r >> 2] = h;
                              if (h | 0) {
                                h = (s + -1 | 0) >>> 0 >= h >>> 0 ? h : s;
                                break
                              }
                            }
                            o = B + (u << 2) | 0;
                            p = C + (u << 2) | 0;
                            n = F + u | 0;
                            k = c[o >> 2] | 0;
                            m = c[p >> 2] | 0;
                            e: while (1) {
                              l = Na(b, k, m, a[n >> 0] | 0) | 0;
                              if (!l) break b;
                              h = a[k >> 0] | 0;
                              f: do
                                if (h << 24 >> 24 < 0) {
                                  if ((h & 255) < 240) {
                                    a[n >> 0] = h;
                                    break
                                  }
                                  switch (h << 24 >> 24) {
                                    case -9:
                                    case -16:
                                      {
                                        a[n >> 0] = 0;
                                        break f
                                      }
                                    case -1:
                                      break;
                                    default:
                                      break f
                                  }
                                  if ((a[k + 1 >> 0] | 0) == 47)
                                    if (!(a[k + 2 >> 0] | 0)) {
                                      v = 53;
                                      break e
                                    }
                                  if ((a[k + 1 >> 0] | 0) != 81) break;
                                  if ((a[k + 2 >> 0] | 0) != 3) break;
                                  v = d[k + 4 >> 0] << 8 | d[k + 3 >> 0] << 16 | d[k + 5 >> 0];
                                  i = +Le(A, v | 0 ? v : 5e5)
                                }
                              while (0);
                              k = k + l | 0;
                              c[o >> 2] = k;
                              h = m - l | 0;
                              c[p >> 2] = h;
                              l = a[k >> 0] | 0;
                              if (l << 24 >> 24 < 0) {
                                m = 0;
                                do {
                                  if (!h) break d;
                                  m = m << 7 | l & 127;
                                  c[r >> 2] = m;
                                  k = k + 1 | 0;
                                  c[o >> 2] = k;
                                  h = h + -1 | 0;
                                  c[p >> 2] = h;
                                  l = a[k >> 0] | 0
                                } while (l << 24 >> 24 < 0)
                              } else m = 0;
                              if (!h) break d;
                              l = m << 7 | l & 127;
                              c[r >> 2] = l;
                              k = k + 1 | 0;
                              c[o >> 2] = k;
                              h = h + -1 | 0;
                              c[p >> 2] = h;
                              if (!l) m = h;
                              else {
                                v = 63;
                                break
                              }
                            }
                            if ((v | 0) == 53) {
                              v = 0;
                              a[q >> 0] = 1;
                              c[o >> 2] = k + 3;
                              c[p >> 2] = m + -3;
                              f = f + 1 | 0;
                              h = s;
                              break
                            } else if ((v | 0) == 63) {
                              v = 0;
                              h = (s + -1 | 0) >>> 0 < l >>> 0 ? s : l;
                              break
                            }
                          } else h = s; while (0);
                        u = u + 1 | 0;
                        s = h
                      }
                      G = j + i * +(s >>> 0);
                      u = ~~G >>> 0;
                      t = (c[w >> 2] | 0) + (((c[x >> 2] | 0) + -1 | 0) * 20 | 0) + 12 | 0;
                      c[t >> 2] = (c[t >> 2] | 0) + u;
                      c[y >> 2] = (c[y >> 2] | 0) + u;
                      t = s;
                      j = G - +(u >>> 0)
                    }
                    Hb(11010, 286, 7, 11027, 0);
                    break b
                  }
                case 2:
                  {
                    a[b + 23e4 >> 0] = 1;j = 0.0;t = 0;v = 67;
                    break
                  }
                default:
                  {
                    j = 0.0;t = 0;v = 67
                  }
              }
              while (0);
              g: do
                if ((v | 0) == 67) {
                  h: while (1) {
                    v = 0;
                    if (t >>> 0 >= z >>> 0) break g;
                    o = F + t | 0;
                    a[o >> 0] = 0;
                    p = B + (t << 2) | 0;
                    q = C + (t << 2) | 0;
                    r = E + t | 0;
                    s = D + (t << 2) | 0;
                    l = c[p >> 2] | 0;
                    m = c[q >> 2] | 0;
                    f = 0;
                    i: while (1) {
                      k = Na(b, l, m, f) | 0;
                      if (!k) break b;
                      h = a[l >> 0] | 0;
                      j: do
                        if (h << 24 >> 24 < 0) {
                          if ((h & 255) < 240) {
                            a[o >> 0] = h;
                            n = h;
                            break
                          }
                          switch (h << 24 >> 24) {
                            case -9:
                            case -16:
                              {
                                a[o >> 0] = 0;n = 0;
                                break j
                              }
                            case -1:
                              break;
                            default:
                              {
                                n = f;
                                break j
                              }
                          }
                          if ((a[l + 1 >> 0] | 0) == 47)
                            if (!(a[l + 2 >> 0] | 0)) {
                              v = 77;
                              break i
                            }
                          if ((a[l + 1 >> 0] | 0) == 81) {
                            if ((a[l + 2 >> 0] | 0) != 3) {
                              n = f;
                              break
                            }
                            n = d[l + 4 >> 0] << 8 | d[l + 3 >> 0] << 16 | d[l + 5 >> 0];
                            i = +Le(A, n | 0 ? n : 5e5);
                            n = f
                          } else n = f
                        } else n = f; while (0);
                      h = l + k | 0;
                      c[p >> 2] = h;
                      f = m - k | 0;
                      c[q >> 2] = f;
                      c[s >> 2] = 0;
                      k = a[h >> 0] | 0;
                      if (k << 24 >> 24 < 0) {
                        l = 0;
                        do {
                          if (!f) break h;
                          l = l << 7 | k & 127;
                          c[s >> 2] = l;
                          h = h + 1 | 0;
                          c[p >> 2] = h;
                          f = f + -1 | 0;
                          c[q >> 2] = f;
                          k = a[h >> 0] | 0
                        } while (k << 24 >> 24 < 0)
                      } else l = 0;
                      if (!f) break h;
                      u = l << 7 | k & 127;
                      c[s >> 2] = u;
                      l = h + 1 | 0;
                      c[p >> 2] = l;
                      m = f + -1 | 0;
                      c[q >> 2] = m;
                      j = j + i * +(u >>> 0);
                      u = ~~j >>> 0;
                      j = j - +(u >>> 0);
                      k = (c[w >> 2] | 0) + (((c[x >> 2] | 0) + -1 | 0) * 20 | 0) + 12 | 0;
                      c[k >> 2] = (c[k >> 2] | 0) + u;
                      c[y >> 2] = (c[y >> 2] | 0) + u;
                      if (a[r >> 0] | 0) break;
                      else f = n
                    }
                    if ((v | 0) == 77) a[r >> 0] = 1;
                    t = t + 1 | 0;
                    v = 67
                  }
                  Hb(11010, 354, 7, 11027, 0);
                  break b
                }
            while (0);
            A = ab(e[21285] | 0, +g[117], +g[118], +g[119], +g[120]) | 0;
            c[b + 229964 >> 2] = A;
            if (!A) {
              Hb(11010, 377, 1, 11236, 0);
              break
            } else {
              c[b + 28 >> 2] = 0;
              c[b + 12 >> 2] = c[w >> 2];
              c[b + 4 >> 2] = 0;
              c[b + 564 >> 2] = 0;
              Eb(b);
              break
            }
          }
          while (0);
          Xa(E);
          Xa(D);
          Xa(F);
          Xa(B);
          Xa(C);
          if (!(c[b + 229964 >> 2] | 0)) {
            xb(b);
            b = 0
          }
        }
      while (0);
      return b | 0
    }

    function Sa(f, h) {
      f = f | 0;
      h = h | 0;
      var i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 0,
        t = 0,
        u = 0,
        v = 0,
        w = 0,
        x = 0,
        y = 0,
        z = 0,
        A = 0.0,
        B = 0,
        C = 0,
        D = 0,
        E = 0,
        F = 0.0,
        G = 0,
        H = 0,
        I = 0,
        J = 0,
        K = 0,
        L = 0,
        M = 0,
        N = 0.0;
      if (!(td(f, 11172, 18) | 0)) {
        I = a[f + 212 >> 0] | 0;
        L = a[f + 228 >> 0] | 0;
        M = L & 255;
        i = vc() | 0;
        gd(i, 60) | 0;
        F = +(6e7 / ((I & 255) >>> 0) | 0 | 0);
        I = ~~((b[21284] & 8192) == 0 ? F : F + .5) >>> 0;
        F = +Le(60, I);
        nd(i, I) | 0;
        I = M << 2;
        G = La(I) | 0;
        H = La(I) | 0;
        I = La(I) | 0;
        J = La(M << 10) | 0;
        K = La(M << 7) | 0;
        j = f + 370 | 0;
        a: do
          if (((M * 17 | 0) + 370 | 0) >>> 0 > h >>> 0) Hb(11191, 115, 14, 11207, 0);
          else {
            c[G >> 2] = d[j >> 0];
            r = -1;
            q = 0;
            while (1) {
              if (q >>> 0 >= M >>> 0) {
                E = 17;
                break
              }
              k = d[j >> 0] | 0;
              o = G + (q << 2) | 0;
              c[o >> 2] = k;
              k = d[j + 1 >> 0] << 8 | k;
              c[o >> 2] = k;
              k = d[j + 2 >> 0] << 16 | k;
              c[o >> 2] = k;
              p = j + 4 | 0;
              k = d[j + 3 >> 0] << 24 | k;
              c[o >> 2] = k;
              if ((k + 94 | 0) >>> 0 > h >>> 0) {
                E = 8;
                break
              }
              j = f + k | 0;
              if (td(j, 11222, 13) | 0) {
                E = 10;
                break
              }
              l = d[j + 88 >> 0] << 8 | d[j + 87 >> 0] | d[j + 89 >> 0] << 16 | d[j + 90 >> 0] << 24;
              j = j + l | 0;
              l = l + k | 0;
              c[o >> 2] = l;
              n = I + (q << 2) | 0;
              c[n >> 2] = 0;
              m = a[j >> 0] | 0;
              if (m << 24 >> 24 < 0) {
                k = 0;
                do {
                  k = k << 7 | m & 127;
                  c[n >> 2] = k;
                  j = j + 1 | 0;
                  l = l + 1 | 0;
                  c[o >> 2] = l;
                  m = a[j >> 0] | 0
                } while (m << 24 >> 24 < 0);
                j = l
              } else {
                k = 0;
                j = l
              }
              m = k << 7 | m & 127;
              c[n >> 2] = m;
              c[o >> 2] = j + 1;
              k = m >>> 0 < r >>> 0;
              c[H + (q << 2) >> 2] = 0;
              a[K + q >> 0] = 0;
              l = q << 7;
              j = 0;
              while (1) {
                if ((j | 0) == 128) break;
                E = j + l | 0;
                E = J + (E << 3) | 0;
                c[E >> 2] = 0;
                a[E + 4 >> 0] = 0;
                j = j + 1 | 0
              }
              r = k ? m : r;
              q = q + 1 | 0;
              j = p
            }
            if ((E | 0) == 8) {
              Hb(11191, 128, 14, 11207, 0);
              break
            } else if ((E | 0) == 10) {
              Hb(11191, 135, 14, 0, 0);
              break
            } else if ((E | 0) == 17) {
              A = F * +(r >>> 0) + 0.0;
              k = ~~A >>> 0;
              B = i + 8 | 0;
              C = i + 16 | 0;
              D = i + 32 | 0;
              A = A - +(k >>> 0);
              j = 0;
              b: while (1) {
                z = (c[B >> 2] | 0) + (((c[C >> 2] | 0) + -1 | 0) * 20 | 0) + 12 | 0;
                c[z >> 2] = (c[z >> 2] | 0) + k;
                c[D >> 2] = (c[D >> 2] | 0) + k;
                if ((j & 255) < (L & 255)) {
                  z = 0;
                  k = 0
                } else {
                  E = 74;
                  break
                }
                while (1) {
                  if (z >>> 0 >= M >>> 0) break;
                  x = H + (z << 2) | 0;
                  do
                    if (!(c[x >> 2] | 0)) {
                      y = z << 7;
                      o = 0;
                      while (1) {
                        if ((o | 0) == 128) break;
                        m = o + y | 0;
                        n = J + (m << 3) | 0;
                        l = c[n >> 2] | 0;
                        do
                          if (l) {
                            l = l - r | 0;
                            c[n >> 2] = l;
                            if (!l) {
                              Rc(i, a[J + (m << 3) + 4 >> 0] | 0, o & 255, 0) | 0;
                              break
                            } else {
                              k = (k + -1 | 0) >>> 0 >= l >>> 0 ? l : k;
                              break
                            }
                          }
                        while (0);
                        o = o + 1 | 0
                      }
                      w = I + (z << 2) | 0;
                      l = c[w >> 2] | 0;
                      if (l | 0) {
                        l = l - r | 0;
                        c[w >> 2] = l;
                        if (l | 0) {
                          k = (k + -1 | 0) >>> 0 >= l >>> 0 ? l : k;
                          break
                        }
                      }
                      u = G + (z << 2) | 0;
                      v = K + z | 0;
                      l = c[u >> 2] | 0;
                      c: while (1) {
                        o = f + l | 0;
                        c[w >> 2] = 0;
                        if (l >>> 0 >= h >>> 0) {
                          E = 33;
                          break b
                        }
                        p = h - l | 0;
                        do
                          if ((a[o >> 0] | 0) == -2) {
                            switch (a[o + 1 >> 0] | 0) {
                              case 16:
                                {
                                  m = d[o + 4 >> 0] | 0;n = m + 5 | 0;l = n + l | 0;c[u >> 2] = l;m = m + 9 | 0;n = o + n | 0;
                                  break
                                }
                              case 21:
                                {
                                  l = l + 4 | 0;c[u >> 2] = l;m = 8;n = o + 4 | 0;
                                  break
                                }
                              default:
                                {
                                  m = 4;n = o
                                }
                            }
                            l = l + 4 | 0;
                            c[u >> 2] = l;
                            if (p >>> 0 < m >>> 0) {
                              E = 39;
                              break b
                            }
                            p = p - m | 0;
                            n = n + 4 | 0
                          } else {
                            m = a[v >> 0] | 0;
                            q = Na(i, o, p, m) | 0;
                            if (!q) break a;
                            n = a[o >> 0] | 0;
                            switch (n << 24 >> 24) {
                              case -1:
                                {
                                  if ((a[o + 1 >> 0] | 0) == 47)
                                    if (!(a[o + 2 >> 0] | 0)) break c;
                                  break
                                }
                              case -9:
                              case -16:
                                {
                                  m = 0;E = 51;
                                  break
                                }
                              default:
                                if ((n & 255) < 240 & n << 24 >> 24 < 0) {
                                  m = n;
                                  E = 51
                                }
                            }
                            if ((E | 0) == 51) {
                              E = 0;
                              a[v >> 0] = m
                            }
                            if ((m & -16) << 24 >> 24 != -112) {
                              l = l + q | 0;
                              c[u >> 2] = l;
                              p = p - q | 0;
                              n = o + q | 0;
                              break
                            }
                            if (n << 24 >> 24 < 0) n = a[o + 1 >> 0] | 0;
                            s = y + (n & 255) | 0;
                            t = m & 15;
                            s = J + (s << 3) | 0;
                            a[s + 4 >> 0] = t;
                            n = o + q | 0;
                            o = l + q | 0;
                            c[u >> 2] = o;
                            l = p - q | 0;
                            s = s | 0;
                            c[s >> 2] = 0;
                            if (!l) {
                              E = 59;
                              break b
                            }
                            m = a[n >> 0] | 0;
                            if (m << 24 >> 24 < 0) {
                              p = 0;
                              do {
                                p = p << 7 | m & 127;
                                c[s >> 2] = p;
                                n = n + 1 | 0;
                                l = l + -1 | 0;
                                o = o + 1 | 0;
                                c[u >> 2] = o;
                                m = a[n >> 0] | 0
                              } while ((l | 0) != 0 & m << 24 >> 24 < 0);
                              if (!l) {
                                E = 59;
                                break b
                              }
                            } else p = 0;
                            q = p << 7 | m & 127;
                            c[s >> 2] = q;
                            n = n + 1 | 0;
                            m = l + -1 | 0;
                            l = o + 1 | 0;
                            c[u >> 2] = l;
                            if (!q) {
                              Rc(i, t, -128, 0) | 0;
                              p = m;
                              break
                            } else {
                              p = m;
                              k = (k + -1 | 0) >>> 0 < q >>> 0 ? k : q;
                              break
                            }
                          }
                        while (0);
                        if (!p) {
                          E = 68;
                          break b
                        }
                        m = a[n >> 0] | 0;
                        if (m << 24 >> 24 < 0) {
                          o = 0;
                          do {
                            o = o << 7 | m & 127;
                            c[w >> 2] = o;
                            n = n + 1 | 0;
                            p = p + -1 | 0;
                            l = l + 1 | 0;
                            c[u >> 2] = l;
                            m = a[n >> 0] | 0
                          } while ((p | 0) != 0 & m << 24 >> 24 < 0);
                          if (!p) {
                            E = 68;
                            break b
                          }
                        } else o = 0;
                        m = o << 7 | m & 127;
                        c[w >> 2] = m;
                        l = l + 1 | 0;
                        c[u >> 2] = l;
                        if (m | 0) {
                          E = 70;
                          break
                        }
                      }
                      if ((E | 0) == 70) {
                        E = 0;
                        k = (k + -1 | 0) >>> 0 < m >>> 0 ? k : m;
                        break
                      }
                      c[x >> 2] = 1;
                      l = 0;
                      while (1) {
                        if ((l | 0) == 128) break;
                        m = l + y | 0;
                        n = J + (m << 3) | 0;
                        if (c[n >> 2] | 0) {
                          Rc(i, a[J + (m << 3) + 4 >> 0] | 0, l & 255, 0) | 0;
                          c[n >> 2] = 0
                        }
                        l = l + 1 | 0
                      }
                      j = j + 1 << 24 >> 24
                    }
                  while (0);
                  z = z + 1 | 0
                }
                N = A + F * +(k >>> 0);
                z = ~~N >>> 0;
                A = N - +(z >>> 0);
                r = k;
                k = z
              }
              if ((E | 0) == 33) {
                Hb(11191, 218, 14, 11207, 0);
                break
              } else if ((E | 0) == 39) {
                Hb(11191, 240, 14, 11207, 0);
                break
              } else if ((E | 0) == 59) {
                Hb(11191, 297, 14, 11207, 0);
                break
              } else if ((E | 0) == 68) {
                Hb(11191, 332, 14, 11207, 0);
                break
              } else if ((E | 0) == 74) {
                M = ab(e[21285] | 0, +g[117], +g[118], +g[119], +g[120]) | 0;
                c[i + 229964 >> 2] = M;
                if (!M) {
                  Hb(11191, 361, 1, 11236, 0);
                  break
                } else {
                  c[i + 28 >> 2] = 0;
                  c[i + 12 >> 2] = c[B >> 2];
                  c[i + 4 >> 2] = 0;
                  c[i + 564 >> 2] = 0;
                  Eb(i);
                  break
                }
              }
            }
          }
        while (0);
        Xa(G);
        Xa(H);
        Xa(I);
        Xa(J);
        Xa(K);
        if (!(c[i + 229964 >> 2] | 0)) {
          xb(i);
          i = 0
        }
      } else {
        Hb(11191, 79, 14, 0, 0);
        i = 0
      }
      return i | 0
    }

    function Ta(e, f, g) {
      e = e | 0;
      f = f | 0;
      g = g | 0;
      var i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 0,
        t = 0.0,
        u = 0,
        v = 0.0,
        w = 0,
        x = 0,
        y = 0,
        z = 0,
        A = 0,
        B = 0,
        C = 0,
        D = 0,
        E = 0,
        F = 0,
        G = 0,
        H = 0,
        I = 0,
        J = 0,
        K = 0,
        L = 0,
        M = 0,
        N = 0,
        P = 0,
        Q = 0,
        R = 0,
        S = 0,
        T = 0,
        U = 0,
        V = 0,
        W = 0,
        X = 0,
        Y = 0,
        Z = 0.0;
      w = 0;
      Y = e + 12 | 0;
      m = c[Y >> 2] | 0;
      He(e);
      Tb(f | 0, 0, g | 0) | 0;
      l = g >>> 1;
      j = e + 229960 | 0;
      X = c[j >> 2] | 0;
      k = l >>> 0 > X << 1 >>> 0 ? l : X + 8192 | 0;
      i = e + 229956 | 0;
      if (l >>> 0 > X >>> 0) {
        c[j >> 2] = k;
        X = zc(c[i >> 2] | 0, k << 2) | 0;
        c[i >> 2] = X;
        j = X;
        i = X
      } else {
        i = c[i >> 2] | 0;
        j = i
      }
      Tb(j | 0, 0, l << 2 | 0) | 0;
      T = e + 28 | 0;
      U = e + 4 | 0;
      V = e + 564 | 0;
      X = e + 36 | 0;
      W = e + 32 | 0;
      j = i;
      S = g;
      k = 0;
      l = c[U >> 2] | 0;
      a: while (1) {
        b: do
          if (!l) {
            l = 0;
            while (1) {
              if (l | 0) break b;
              g = c[m >> 2] | 0;
              if (!g) break;
              Ja[g & 63](e, m + 4 | 0);
              if (b[X >> 1] & 8)
                if ((c[m >> 2] | 0) == 1) {
                  Eb(e);
                  m = c[Y >> 2] | 0;
                  l = c[U >> 2] | 0;
                  continue
                }
              l = c[m + 12 >> 2] | 0;
              c[U >> 2] = l;
              R = m + 20 | 0;
              c[Y >> 2] = R;
              m = R
            }
            if (!l) {
              l = c[T >> 2] | 0;
              g = c[W >> 2] | 0;
              if (g >>> 0 <= l >>> 0) break a;
              l = g - l | 0;
              R = S >>> 2;
              l = l >>> 0 > R >>> 0 ? R : l;
              c[U >> 2] = l
            }
          }while (0);g = S >>> 2;
        if (l >>> 0 > g >>> 0) {
          l = g;
          w = 17
        } else if (!l) {
          g = S;
          l = 0
        } else w = 17;
        if ((w | 0) == 17) {
          w = 0;
          R = l << 1;
          P = l;
          Q = j;
          while (1) {
            o = c[V >> 2] | 0;
            if (!o) {
              n = 0;
              g = 0
            } else {
              n = 0;
              g = 0;
              do {
                x = o + 12 | 0;
                K = c[o + 8 >> 2] | 0;
                y = K + 96 | 0;
                z = o + 28 | 0;
                A = o + 44 | 0;
                B = o + 48 | 0;
                C = o + 16 | 0;
                D = K + 8 | 0;
                L = o + 32 | 0;
                E = K + 4 | 0;
                F = K + 12 | 0;
                N = o + 20 | 0;
                M = o + 24 | 0;
                G = c[10368] | 0;
                w = c[K >> 2] | 0;
                H = w >>> 10;
                I = K + 84 | 0;
                J = K + 56 | 0;
                p = c[x >> 2] | 0;
                c: while (1) {
                  u = p >>> 10;
                  r = (H - u << 1) + -3 | 0;
                  r = (r | 0) > 1 ? r : 1;
                  q = u << 1 | 1;
                  r = (r | 0) > (q | 0) ? q : r;
                  q = p & 1023;
                  if ((r | 0) < 34) {
                    s = r >>> 1;
                    v = +(q >>> 0) * .0009765625 + +(s | 0);
                    s = (c[y >> 2] | 0) + (u << 1) + (0 - s << 1) | 0;
                    t = 0.0;
                    while (1) {
                      if (!r) break;
                      else q = 0;
                      while (1) {
                        if ((q | 0) > (r | 0)) break;
                        Z = t + +h[14520 + (r * 464 | 0) + (q << 3) >> 3] * +(b[s + (q << 1) >> 1] | 0);
                        q = q + 1 | 0;
                        t = Z
                      }
                      u = r + -1 | 0;
                      r = u;
                      t = (v - +(u | 0)) * t
                    }
                    t = t + +(b[s >> 1] | 0)
                  } else {
                    s = G + (q * 35 << 3) | 0;
                    r = 0;
                    q = (c[y >> 2] | 0) + (u << 1) + -34 | 0;
                    t = 0.0;
                    while (1) {
                      t = t + +h[s + (r << 3) >> 3] * +(b[q >> 1] | 0);
                      r = r + 1 | 0;
                      if ((r | 0) == 35) break;
                      else q = q + 2 | 0
                    }
                  }
                  q = c[z >> 2] | 0;
                  u = ~~(t * +(q >> 12 | 0) * .0009765625);
                  g = ((O(c[A >> 2] | 0, u) | 0) / 1024 | 0) + g | 0;
                  n = ((O(c[B >> 2] | 0, u) | 0) / 1024 | 0) + n | 0;
                  p = p + (c[C >> 2] | 0) | 0;
                  c[x >> 2] = p;
                  do
                    if (p >>> 0 > (c[D >> 2] | 0) >>> 0)
                      if (!(a[L >> 0] & 4))
                        if (p >>> 0 < w >>> 0) break;
                        else {
                          w = 52;
                          break c
                        }
                  else {
                    u = c[E >> 2] | 0;
                    p = (((p - u | 0) >>> 0) % ((c[F >> 2] | 0) >>> 0) | 0) + u | 0;
                    c[x >> 2] = p;
                    break
                  } while (0);
                  s = c[N >> 2] | 0;
                  if (!s) {
                    w = 35;
                    break
                  }
                  q = q + s | 0;
                  c[z >> 2] = q;
                  u = a[M >> 0] | 0;
                  r = c[K + 64 + ((u & 255) << 2) >> 2] | 0;
                  if ((s | 0) < 0) {
                    if ((q | 0) > (r | 0)) {
                      w = 38;
                      break
                    }
                  } else if ((q | 0) < (r | 0)) {
                    w = 40;
                    break
                  }
                  r = c[K + 64 + ((u & 255) << 2) >> 2] | 0;
                  c[z >> 2] = r;
                  switch (u << 24 >> 24) {
                    case 0:
                      {
                        w = 42;
                        break c
                      }
                    case 5:
                      {
                        w = 48;
                        break c
                      }
                    case 6:
                      {
                        w = 52;
                        break c
                      }
                    case 2:
                      break;
                    default:
                      {
                        w = 59;
                        break c
                      }
                  }
                  q = d[L >> 0] | 0;
                  if (q & 32 | 0) {
                    w = 45;
                    break
                  }
                  if (!(q & 128)) {
                    w = 59;
                    break
                  }
                  a[M >> 0] = 5;
                  u = c[J >> 2] | 0;
                  c[N >> 2] = (r | 0) > (c[I >> 2] | 0) ? 0 - u | 0 : u
                }
                if ((w | 0) == 35) {
                  w = 0;
                  o = c[o + 40 >> 2] | 0
                } else if ((w | 0) == 38) {
                  w = 0;
                  o = c[o + 40 >> 2] | 0
                } else if ((w | 0) == 40) {
                  w = 0;
                  o = c[o + 40 >> 2] | 0
                } else if ((w | 0) == 42) {
                  w = 0;
                  if (!(a[L >> 0] & 64)) {
                    c[N >> 2] = 0;
                    o = c[o + 40 >> 2] | 0
                  } else w = 59
                } else if ((w | 0) == 45) {
                  w = 0;
                  c[N >> 2] = 0;
                  o = c[o + 40 >> 2] | 0
                } else if ((w | 0) == 48) {
                  w = 0;
                  if (!r) w = 52;
                  else {
                    p = d[L >> 0] | 0;
                    if (p & 4 | 0) a[L >> 0] = p ^ 4;
                    c[N >> 2] = 0;
                    o = c[o + 40 >> 2] | 0
                  }
                }
                do
                  if ((w | 0) == 52) {
                    w = 0;
                    r = o + 36 | 0;
                    N = c[r >> 2] | 0;
                    a[o + 34 >> 0] = 0;
                    p = c[V >> 2] | 0;
                    q = (p | 0) == (o | 0);
                    s = N;
                    if (!N) {
                      if (q) p = 0;
                      else
                        while (1) {
                          q = c[p + 40 >> 2] | 0;
                          if ((q | 0) != (o | 0) & (q | 0) != 0) p = q;
                          else break
                        }
                      o = o + 40 | 0;
                      c[(p | 0 ? p + 40 | 0 : V) >> 2] = c[o >> 2];
                      o = c[o >> 2] | 0;
                      break
                    } else {
                      if (q) p = 0;
                      else
                        while (1) {
                          q = c[p + 40 >> 2] | 0;
                          if ((q | 0) == (o | 0)) break;
                          else p = q
                        }
                      c[(p | 0 ? p + 40 | 0 : V) >> 2] = s;
                      N = c[r >> 2] | 0;
                      c[N + 40 >> 2] = c[o + 40 >> 2];
                      a[N + 34 >> 0] = 1;
                      o = N;
                      break
                    }
                  } else if ((w | 0) == 59) {
                  w = 0;
                  p = u + 1 << 24 >> 24;
                  a[M >> 0] = p;
                  if ((a[o + 52 >> 0] | 0) == 1) Yb(o);
                  else {
                    L = p & 255;
                    M = c[K + 36 + (L << 2) >> 2] | 0;
                    c[N >> 2] = (r | 0) >= (c[K + 64 + (L << 2) >> 2] | 0) ? 0 - M | 0 : M
                  }
                  o = c[o + 40 >> 2] | 0
                } while (0)
              } while ((o | 0) != 0)
            }
            c[Q >> 2] = g;
            c[Q + 4 >> 2] = n;
            P = P + -1 | 0;
            if (!P) break;
            else Q = Q + 8 | 0
          }
          Q = l << 2;
          c[T >> 2] = (c[T >> 2] | 0) + l;
          l = (c[U >> 2] | 0) - l | 0;
          c[U >> 2] = l;
          g = S - Q | 0;
          k = Q + k | 0;
          j = j + (R << 2) | 0
        }
        if (!g) break;
        else S = g
      }
      if (!(b[X >> 1] & 4)) j = 0;
      else {
        cb(c[e + 229964 >> 2] | 0, i, k >>> 1);
        j = 0
      }
      while (1) {
        if (j >>> 0 >= k >>> 0) break;
        X = c[i >> 2] | 0;
        Y = c[i + 4 >> 2] | 0;
        a[f >> 0] = X;
        a[f + 1 >> 0] = X >>> 8 & 127 | X >>> 24 & 128;
        a[f + 2 >> 0] = Y;
        a[f + 3 >> 0] = Y >>> 8 & 127 | Y >>> 24 & 128;
        f = f + 4 | 0;
        j = j + 4 | 0;
        i = i + 8 | 0
      }
      Oe(e);
      return k | 0
    }

    function Ua(d, e, f) {
      d = d | 0;
      e = e | 0;
      f = f | 0;
      var g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 0,
        t = 0,
        u = 0,
        v = 0,
        w = 0,
        x = 0,
        y = 0,
        z = 0,
        A = 0,
        B = 0,
        C = 0,
        D = 0,
        E = 0,
        F = 0,
        G = 0,
        H = 0,
        I = 0,
        J = 0,
        K = 0,
        L = 0,
        M = 0,
        N = 0,
        P = 0,
        Q = 0,
        R = 0,
        S = 0,
        T = 0,
        U = 0,
        V = 0;
      s = 0;
      V = d + 12 | 0;
      k = c[V >> 2] | 0;
      He(d);
      Tb(e | 0, 0, f | 0) | 0;
      j = f >>> 1;
      h = d + 229960 | 0;
      U = c[h >> 2] | 0;
      i = j >>> 0 > U << 1 >>> 0 ? j : U + 8192 | 0;
      g = d + 229956 | 0;
      if (j >>> 0 > U >>> 0) {
        c[h >> 2] = i;
        U = zc(c[g >> 2] | 0, i << 2) | 0;
        c[g >> 2] = U;
        h = U;
        g = U
      } else {
        g = c[g >> 2] | 0;
        h = g
      }
      Tb(h | 0, 0, j << 2 | 0) | 0;
      Q = d + 28 | 0;
      R = d + 4 | 0;
      S = d + 564 | 0;
      U = d + 36 | 0;
      T = d + 32 | 0;
      h = g;
      P = f;
      i = 0;
      j = c[R >> 2] | 0;
      a: while (1) {
        b: do
          if (!j) {
            j = 0;
            while (1) {
              if (j | 0) break b;
              f = c[k >> 2] | 0;
              if (!f) break;
              Ja[f & 63](d, k + 4 | 0);
              if (b[U >> 1] & 8)
                if ((c[k >> 2] | 0) == 1) {
                  Eb(d);
                  k = c[V >> 2] | 0;
                  j = c[R >> 2] | 0;
                  continue
                }
              j = c[k + 12 >> 2] | 0;
              c[R >> 2] = j;
              N = k + 20 | 0;
              c[V >> 2] = N;
              k = N
            }
            if (!j) {
              j = c[Q >> 2] | 0;
              f = c[T >> 2] | 0;
              if (f >>> 0 <= j >>> 0) break a;
              j = f - j | 0;
              N = P >>> 2;
              j = j >>> 0 > N >>> 0 ? N : j;
              c[R >> 2] = j
            }
          }while (0);f = P >>> 2;
        if (j >>> 0 > f >>> 0) {
          j = f;
          s = 17
        } else if (!j) {
          f = P;
          j = 0
        } else s = 17;
        if ((s | 0) == 17) {
          s = 0;
          N = j << 1;
          L = j;
          M = h;
          while (1) {
            m = c[S >> 2] | 0;
            if (!m) {
              l = 0;
              f = 0
            } else {
              l = 0;
              f = 0;
              do {
                v = m + 12 | 0;
                H = c[m + 8 >> 2] | 0;
                w = c[H + 96 >> 2] | 0;
                x = m + 28 | 0;
                I = m + 32 | 0;
                G = a[I >> 0] | 0;
                y = (G & 4) == 0;
                K = m + 20 | 0;
                J = m + 24 | 0;
                z = H + 8 | 0;
                A = H + 4 | 0;
                B = H + 12 | 0;
                s = c[m + 44 >> 2] | 0;
                t = c[m + 48 >> 2] | 0;
                u = c[m + 16 >> 2] | 0;
                D = G & 255;
                C = (D & 32 | 0) == 0;
                D = (D & 128 | 0) == 0;
                E = H + 84 | 0;
                F = H + 56 | 0;
                n = c[v >> 2] | 0;
                o = c[x >> 2] | 0;
                c: while (1) {
                  q = n >>> 10;
                  r = b[w + (q << 1) >> 1] | 0;
                  r = (O(((O((b[w + (q + 1 << 1) >> 1] | 0) - r | 0, n & 1023) | 0) / 1024 | 0) + r | 0, o >> 12) | 0) / 1024 | 0;
                  f = ((O(r, s) | 0) / 1024 | 0) + f | 0;
                  l = ((O(r, t) | 0) / 1024 | 0) + l | 0;
                  n = u + n | 0;
                  c[v >> 2] = n;
                  if (y) {
                    if (n >>> 0 >= (c[H >> 2] | 0) >>> 0) {
                      s = 43;
                      break
                    }
                  } else if (n >>> 0 > (c[z >> 2] | 0) >>> 0) {
                    r = c[A >> 2] | 0;
                    n = (((n - r | 0) >>> 0) % ((c[B >> 2] | 0) >>> 0) | 0) + r | 0;
                    c[v >> 2] = n
                  }
                  p = c[K >> 2] | 0;
                  if (!p) {
                    s = 26;
                    break
                  }
                  o = o + p | 0;
                  c[x >> 2] = o;
                  q = a[J >> 0] | 0;
                  r = c[H + 64 + ((q & 255) << 2) >> 2] | 0;
                  if ((p | 0) < 0) {
                    if ((o | 0) > (r | 0)) {
                      s = 29;
                      break
                    }
                  } else if ((o | 0) < (r | 0)) {
                    s = 31;
                    break
                  }
                  c[x >> 2] = r;
                  switch (q << 24 >> 24) {
                    case 0:
                      {
                        s = 33;
                        break c
                      }
                    case 5:
                      {
                        s = 39;
                        break c
                      }
                    case 6:
                      {
                        s = 43;
                        break c
                      }
                    case 2:
                      break;
                    default:
                      {
                        s = 50;
                        break c
                      }
                  }
                  if (!C) {
                    s = 36;
                    break
                  }
                  if (D) {
                    s = 50;
                    break
                  }
                  a[J >> 0] = 5;
                  o = c[F >> 2] | 0;
                  c[K >> 2] = (r | 0) > (c[E >> 2] | 0) ? 0 - o | 0 : o;
                  o = r
                }
                if ((s | 0) == 26) {
                  s = 0;
                  m = c[m + 40 >> 2] | 0
                } else if ((s | 0) == 29) {
                  s = 0;
                  m = c[m + 40 >> 2] | 0
                } else if ((s | 0) == 31) {
                  s = 0;
                  m = c[m + 40 >> 2] | 0
                } else if ((s | 0) == 33) {
                  s = 0;
                  if (!(G & 64)) {
                    c[K >> 2] = 0;
                    m = c[m + 40 >> 2] | 0
                  } else s = 50
                } else if ((s | 0) == 36) {
                  s = 0;
                  c[K >> 2] = 0;
                  m = c[m + 40 >> 2] | 0
                } else if ((s | 0) == 39) {
                  s = 0;
                  if (!r) s = 43;
                  else {
                    n = G & 255;
                    if (n & 4 | 0) a[I >> 0] = n ^ 4;
                    c[K >> 2] = 0;
                    m = c[m + 40 >> 2] | 0
                  }
                }
                do
                  if ((s | 0) == 43) {
                    s = 0;
                    p = m + 36 | 0;
                    K = c[p >> 2] | 0;
                    a[m + 34 >> 0] = 0;
                    n = c[S >> 2] | 0;
                    o = (n | 0) == (m | 0);
                    q = K;
                    if (!K) {
                      if (o) n = 0;
                      else
                        while (1) {
                          o = c[n + 40 >> 2] | 0;
                          if ((o | 0) != (m | 0) & (o | 0) != 0) n = o;
                          else break
                        }
                      m = m + 40 | 0;
                      c[(n | 0 ? n + 40 | 0 : S) >> 2] = c[m >> 2];
                      m = c[m >> 2] | 0;
                      break
                    } else {
                      if (o) n = 0;
                      else
                        while (1) {
                          o = c[n + 40 >> 2] | 0;
                          if ((o | 0) == (m | 0)) break;
                          else n = o
                        }
                      c[(n | 0 ? n + 40 | 0 : S) >> 2] = q;
                      K = c[p >> 2] | 0;
                      c[K + 40 >> 2] = c[m + 40 >> 2];
                      a[K + 34 >> 0] = 1;
                      m = K;
                      break
                    }
                  } else if ((s | 0) == 50) {
                  s = 0;
                  n = q + 1 << 24 >> 24;
                  a[J >> 0] = n;
                  if ((a[m + 52 >> 0] | 0) == 1) Yb(m);
                  else {
                    I = n & 255;
                    J = c[H + 36 + (I << 2) >> 2] | 0;
                    c[K >> 2] = (r | 0) >= (c[H + 64 + (I << 2) >> 2] | 0) ? 0 - J | 0 : J
                  }
                  m = c[m + 40 >> 2] | 0
                } while (0)
              } while ((m | 0) != 0)
            }
            c[M >> 2] = f;
            c[M + 4 >> 2] = l;
            L = L + -1 | 0;
            if (!L) break;
            else M = M + 8 | 0
          }
          M = j << 2;
          c[Q >> 2] = (c[Q >> 2] | 0) + j;
          j = (c[R >> 2] | 0) - j | 0;
          c[R >> 2] = j;
          f = P - M | 0;
          i = M + i | 0;
          h = h + (N << 2) | 0
        }
        if (!f) break;
        else P = f
      }
      if (!(b[U >> 1] & 4)) h = 0;
      else {
        cb(c[d + 229964 >> 2] | 0, g, i >>> 1);
        h = 0
      }
      while (1) {
        if (h >>> 0 >= i >>> 0) break;
        U = c[g >> 2] | 0;
        V = c[g + 4 >> 2] | 0;
        a[e >> 0] = U;
        a[e + 1 >> 0] = U >>> 8 & 127 | U >>> 24 & 128;
        a[e + 2 >> 0] = V;
        a[e + 3 >> 0] = V >>> 8 & 127 | V >>> 24 & 128;
        e = e + 4 | 0;
        h = h + 4 | 0;
        g = g + 8 | 0
      }
      Oe(d);
      return i | 0
    }

    function Va(f, i) {
      f = f | 0;
      i = i | 0;
      var j = 0,
        k = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 0,
        t = 0,
        u = 0,
        v = 0,
        w = 0.0,
        x = 0,
        y = 0,
        z = 0,
        A = 0,
        B = 0,
        C = 0,
        D = 0.0,
        E = 0,
        F = 0,
        G = 0,
        H = 0,
        I = 0,
        J = 0,
        K = 0.0;
      B = 0;
      J = l;
      l = l + 16 | 0;
      I = J;
      do
        if (!(td(f, 10953, 8) | 0)) {
          j = f + 8 | 0;
          m = (td(j, 10978, 6) | 0) == 0;
          k = (m ? -14 : -8) + i | 0;
          i = m ? f + 14 | 0 : j;
          j = m ? 18 : 24;
          f = 0;
          while (1) {
            if (f >>> 0 >= j >>> 0) break;
            if (!(a[i + f >> 0] | 0)) f = f + 1 | 0;
            else {
              B = 6;
              break
            }
          }
          if ((B | 0) == 6) {
            Hb(10962, 93, 13, 0, 0);
            i = 0;
            break
          }
          E = i + j + 1 + 1 + 1 + 1 + 12 | 0;
          G = E + 1 | 0;
          C = G + 1 | 0;
          i = C + 1 | 0;
          C = d[G >> 0] << 8 | d[E >> 0] | d[C >> 0] << 16 | d[i >> 0] << 24;
          i = i + 1 + 1 + 1 + 1 + 1 | 0;
          E = i + 1 | 0;
          G = E + 1 | 0;
          s = G + 1 | 0;
          D = +((6e7 / ((d[E >> 0] << 8 | d[i >> 0] | d[G >> 0] << 16 | d[s >> 0] << 24) >>> 0) | 0) >>> 0);
          G = ~~((b[21284] & 8192) == 0 ? D : D + .5) >>> 0;
          D = +Le(60, G);
          i = vc() | 0;
          gd(i, 60) | 0;
          nd(i, G) | 0;
          G = C << 2;
          E = La(G) | 0;
          F = La(G) | 0;
          G = La(G) | 0;
          H = La(C) | 0;
          v = -1;
          u = 0;
          f = k - j + (m ? -872 : -744) | 0;
          s = s + 1 + 1 + 1 + 1 + 1 + (m ? 840 : 712) | 0;
          while (1) {
            if (u >>> 0 >= C >>> 0) {
              B = 14;
              break
            }
            r = E + (u << 2) | 0;
            c[r >> 2] = s;
            q = d[s + 4 >> 0] | 0;
            t = F + (u << 2) | 0;
            c[t >> 2] = q;
            q = d[s + 5 >> 0] << 8 | q;
            c[t >> 2] = q;
            q = d[s + 6 >> 0] << 16 | q;
            c[t >> 2] = q;
            q = d[s + 7 >> 0] << 24 | q;
            c[t >> 2] = q;
            if (f >>> 0 < q >>> 0) {
              B = 10;
              break
            }
            f = f - q | 0;
            j = s + 12 | 0;
            p = G + (u << 2) | 0;
            c[p >> 2] = 0;
            k = a[j >> 0] | 0;
            if (k << 24 >> 24 > -1) {
              n = 0;
              m = 0;
              o = 12;
              do {
                j = j + 1 | 0;
                m = (k & 127) << n | m;
                c[p >> 2] = m;
                n = n + 7 | 0;
                o = o + 1 | 0;
                k = a[j >> 0] | 0
              } while (k << 24 >> 24 > -1);
              j = o
            } else {
              n = 0;
              m = 0;
              j = 12
            }
            B = (k & 127) << n | m;
            c[p >> 2] = B;
            A = j + 1 | 0;
            c[t >> 2] = q - A;
            c[r >> 2] = s + A;
            a[H + u >> 0] = 0;
            v = B >>> 0 < v >>> 0 ? B : v;
            u = u + 1 | 0;
            s = s + q | 0
          }
          a: do
            if ((B | 0) == 10) Hb(10962, 201, 13, 11207, 0);
            else
          if ((B | 0) == 14) {
            w = D * +(v >>> 0) + 0.0;
            f = ~~w >>> 0;
            x = i + 8 | 0;
            y = i + 16 | 0;
            z = i + 32 | 0;
            A = c[1851] | 0;
            w = w - +(f >>> 0);
            j = 0;
            b: while (1) {
              u = (c[x >> 2] | 0) + (((c[y >> 2] | 0) + -1 | 0) * 20 | 0) + 12 | 0;
              c[u >> 2] = (c[u >> 2] | 0) + f;
              c[z >> 2] = (c[z >> 2] | 0) + f;
              if (j >>> 0 < C >>> 0) {
                f = j;
                t = 0;
                u = 0
              } else break;
              while (1) {
                if (u >>> 0 >= C >>> 0) break;
                r = H + u | 0;
                do
                  if (!(a[r >> 0] | 0)) {
                    s = G + (u << 2) | 0;
                    j = c[s >> 2] | 0;
                    if (j | 0) {
                      j = j - v | 0;
                      c[s >> 2] = j;
                      if (j | 0) {
                        j = (t + -1 | 0) >>> 0 >= j >>> 0 ? j : t;
                        break
                      }
                    }
                    p = E + (u << 2) | 0;
                    q = F + (u << 2) | 0;
                    j = d[p >> 0] | d[p + 1 >> 0] << 8 | d[p + 2 >> 0] << 16 | d[p + 3 >> 0] << 24;
                    while (1) {
                      if ((a[j >> 0] & -16) << 24 >> 24 == -80)
                        if ((a[j + 1 >> 0] & -2) << 24 >> 24 == 110)
                          if ((a[j + 2 >> 0] | 0) < 0) {
                            o = j + 3 | 0;
                            m = (c[q >> 2] | 0) + -3 | 0
                          } else B = 26;
                      else B = 26;
                      else B = 26;
                      if ((B | 0) == 26) {
                        B = 0;
                        k = c[q >> 2] | 0;
                        m = Na(i, j, k, 0) | 0;
                        if (!m) break a;
                        if ((a[j >> 0] | 0) == -1) {
                          if ((a[j + 1 >> 0] | 0) == 47)
                            if (!(a[j + 2 >> 0] | 0)) {
                              B = 30;
                              break
                            }
                          if ((a[j + 1 >> 0] | 0) == 81)
                            if ((a[j + 2 >> 0] | 0) == 3) {
                              o = d[j + 4 >> 0] << 8 | d[j + 3 >> 0] << 16 | d[j + 5 >> 0];
                              h[I >> 3] = (o | 0) == 0 ? 5.0e5 : +(o | 0);
                              ee(A, 10985, I) | 0
                            }
                        }
                        o = j + m | 0;
                        m = k - m | 0
                      }
                      c[q >> 2] = m;
                      c[s >> 2] = 0;
                      if (!m) {
                        B = 40;
                        break b
                      }
                      j = a[o >> 0] | 0;
                      if (j << 24 >> 24 > -1) {
                        k = 0;
                        n = 0;
                        do {
                          if (!m) {
                            B = 40;
                            break b
                          }
                          n = ((j & 127) << k) + n | 0;
                          c[s >> 2] = n;
                          k = k + 7 | 0;
                          o = o + 1 | 0;
                          m = m + -1 | 0;
                          c[q >> 2] = m;
                          j = a[o >> 0] | 0
                        } while (j << 24 >> 24 > -1);
                        if (!m) {
                          B = 40;
                          break b
                        }
                      } else {
                        k = 0;
                        n = 0
                      }
                      k = ((j & 127) << k) + n | 0;
                      c[s >> 2] = k;
                      j = o + 1 | 0;
                      c[q >> 2] = m + -1;
                      if (k) {
                        B = 42;
                        break
                      }
                    }
                    if ((B | 0) == 30) {
                      B = 0;
                      a[r >> 0] = 1;
                      c[q >> 2] = k + -3;
                      c[p >> 2] = j + 3;
                      j = t;
                      f = f + 1 | 0;
                      break
                    } else if ((B | 0) == 42) {
                      B = 0;
                      a[p >> 0] = j;
                      a[p + 1 >> 0] = j >> 8;
                      a[p + 2 >> 0] = j >> 16;
                      a[p + 3 >> 0] = j >> 24;
                      j = (t + -1 | 0) >>> 0 >= k >>> 0 ? k : t;
                      break
                    }
                  } else j = t; while (0);
                t = j;
                u = u + 1 | 0
              }
              K = w + D * +(t >>> 0);
              u = ~~K >>> 0;
              w = K - +(u >>> 0);
              j = f;
              v = t;
              f = u
            }
            if ((B | 0) == 40) {
              Hb(10962, 311, 13, 11207, 0);
              break
            }
            I = ab(e[21285] | 0, +g[117], +g[118], +g[119], +g[120]) | 0;
            c[i + 229964 >> 2] = I;
            if (!I) {
              Hb(10962, 339, 1, 11236, 0);
              break
            } else {
              c[i + 28 >> 2] = 0;
              c[i + 12 >> 2] = c[x >> 2];
              c[i + 4 >> 2] = 0;
              c[i + 564 >> 2] = 0;
              Eb(i);
              break
            }
          }
          while (0);
          Xa(E);
          Xa(F);
          Xa(G);
          Xa(H);
          if (!(c[i + 229964 >> 2] | 0)) {
            xb(i);
            i = 0
          }
        } else {
          Hb(10962, 73, 13, 0, 0);
          i = 0
        }
      while (0);
      l = J;
      return i | 0
    }

    function Wa(f, h) {
      f = f | 0;
      h = h | 0;
      var i = 0,
        j = 0,
        k = 0,
        m = 0,
        n = 0.0,
        o = 0,
        p = 0,
        q = 0,
        r = 0.0,
        s = 0,
        t = 0,
        u = 0,
        v = 0,
        w = 0,
        x = 0,
        y = 0,
        z = 0,
        A = 0,
        B = 0;
      y = 0;
      B = l;
      l = l + 32 | 0;
      z = B;
      A = B + 8 | 0;
      c[z >> 2] = 0;
      i = A;
      k = i + 16 | 0;
      do {
        a[i >> 0] = 0;
        i = i + 1 | 0
      } while ((i | 0) < (k | 0));
      do
        if (h >>> 0 < 17) {
          Hb(10918, 75, 16, 10934, 0);
          i = 0
        } else {
          if (td(f, 10949, 4) | 0) {
            Hb(10918, 80, 16, 0, 0);
            i = 0;
            break
          }
          m = d[f + 7 >> 0] << 8 | d[f + 6 >> 0];
          k = d[f + 13 >> 0] << 8 | d[f + 12 >> 0];
          if (((d[f + 5 >> 0] << 8 | d[f + 4 >> 0]) + 16 + (k << 1) | 0) >>> 0 > h >>> 0) {
            Hb(10918, 104, 16, 10934, 0);
            i = 0;
            break
          } else i = 0;
          while (1)
            if (k >>> 0 > (i & 65535) >>> 0) i = i + 1 << 16 >> 16;
            else break;
          s = be(32) | 0;
          r = +(6e7 / ((s << 16 >> 16 == 0 ? 140 : s & 65535) >>> 0) | 0 | 0);
          s = ~~((b[21284] & 8192) == 0 ? r : r + .5) >>> 0;
          r = +Le(60, s);
          i = vc() | 0;
          gd(i, 60) | 0;
          nd(i, s) | 0;
          s = z + 1 | 0;
          t = z + 2 | 0;
          u = z + 3 | 0;
          x = i + 8 | 0;
          v = i + 16 | 0;
          w = i + 32 | 0;
          n = 0.0;
          k = m;
          a: while (1) {
            while (1) {
              q = f + k | 0;
              o = a[q >> 0] | 0;
              m = o & 255;
              switch (o & 15) {
                case 15:
                  {
                    m = m & 240 | 9;y = 13;
                    break
                  }
                case 9:
                  {
                    m = m | 15;y = 13;
                    break
                  }
                default:
                  {}
              }
              if ((y | 0) == 13) {
                y = 0;
                o = m & 255;
                a[q >> 0] = o
              }
              p = o & 255;
              b: do switch ((o & 255) >>> 4 & 7) {
                  case 6:
                    {
                      y = 44;
                      break a
                    }
                  case 0:
                    {
                      a[z >> 0] = p & 15 | 128;a[s >> 0] = a[f + (k + 1) >> 0] | 0;a[t >> 0] = 0;a[u >> 0] = 0;m = 2;y = 39;
                      break
                    }
                  case 1:
                    {
                      m = a[f + (k + 1) >> 0] | 0;a[z >> 0] = p & 15 | 144;
                      if (m << 24 >> 24 < 0) {
                        a[s >> 0] = m & 127;
                        m = a[f + (k + 2) >> 0] | 0;
                        a[t >> 0] = m;
                        a[u >> 0] = 0;
                        a[A + (o & 15) >> 0] = m;
                        m = 3;
                        y = 39;
                        break b
                      } else {
                        a[s >> 0] = m;
                        a[t >> 0] = a[A + (o & 15) >> 0] | 0;
                        a[u >> 0] = 0;
                        m = 2;
                        y = 39;
                        break b
                      }
                    }
                  case 2:
                    {
                      a[z >> 0] = p & 15 | 224;m = a[f + (k + 1) >> 0] | 0;a[s >> 0] = (m & 255) << 6 & 64;a[t >> 0] = (m & 255) >>> 1;a[u >> 0] = 0;m = 2;y = 39;
                      break
                    }
                  case 3:
                    {
                      switch (a[f + (k + 1) >> 0] | 0) {
                        case 10:
                          {
                            m = 120;
                            break
                          }
                        case 11:
                          {
                            m = 123;
                            break
                          }
                        case 12:
                          {
                            m = 126;
                            break
                          }
                        case 13:
                          {
                            m = 127;
                            break
                          }
                        case 14:
                          {
                            m = 121;
                            break
                          }
                        default:
                          {
                            m = 2;
                            break b
                          }
                      }
                      a[z >> 0] = o & 15 | -80;a[s >> 0] = m;a[t >> 0] = 0;a[u >> 0] = 0;m = 2;y = 39;
                      break
                    }
                  case 4:
                    {
                      do switch (a[f + (k + 1) >> 0] | 0) {
                        case 0:
                          {
                            a[z >> 0] = p & 15 | 192;a[s >> 0] = a[f + (k + 2) >> 0] | 0;m = 0;
                            break
                          }
                        case 1:
                          {
                            a[z >> 0] = p & 15 | 176;a[s >> 0] = 0;m = a[f + (k + 2) >> 0] | 0;
                            break
                          }
                        case 2:
                          {
                            a[z >> 0] = p & 15 | 176;a[s >> 0] = 1;m = a[f + (k + 2) >> 0] | 0;
                            break
                          }
                        case 3:
                          {
                            a[z >> 0] = p & 15 | 176;a[s >> 0] = 7;m = a[f + (k + 2) >> 0] | 0;
                            break
                          }
                        case 4:
                          {
                            a[z >> 0] = p & 15 | 176;a[s >> 0] = 10;m = a[f + (k + 2) >> 0] | 0;
                            break
                          }
                        case 5:
                          {
                            a[z >> 0] = p & 15 | 176;a[s >> 0] = 11;m = a[f + (k + 2) >> 0] | 0;
                            break
                          }
                        case 6:
                          {
                            a[z >> 0] = p & 15 | 176;a[s >> 0] = 91;m = a[f + (k + 2) >> 0] | 0;
                            break
                          }
                        case 7:
                          {
                            a[z >> 0] = p & 15 | 176;a[s >> 0] = 93;m = a[f + (k + 2) >> 0] | 0;
                            break
                          }
                        case 8:
                          {
                            a[z >> 0] = p & 15 | 176;a[s >> 0] = 64;m = a[f + (k + 2) >> 0] | 0;
                            break
                          }
                        case 9:
                          {
                            a[z >> 0] = p & 15 | 176;a[s >> 0] = 67;m = a[f + (k + 2) >> 0] | 0;
                            break
                          }
                        default:
                          {
                            m = 3;
                            break b
                          }
                      }
                      while (0);
                      a[t >> 0] = m;a[u >> 0] = 0;m = 3;y = 39;
                      break
                    }
                  case 7:
                  case 5:
                    {
                      m = 1;
                      break
                    }
                  default:
                    {
                      y = 38;
                      break a
                    }
                }
                while (0);
                if ((y | 0) == 39) {
                  y = 0;
                  if (!(Na(i, z, 4, 0) | 0)) {
                    y = 47;
                    break a
                  }
                  o = a[q >> 0] | 0
                }
              k = (m & 255) + k | 0;
              if (o << 24 >> 24 < 0) {
                m = 0;
                break
              }
            }
            do {
              q = k;
              k = k + 1 | 0;
              q = d[f + q >> 0] | 0;
              m = q & 127 | m << 7
            } while ((q & 128 | 0) != 0);
            n = n + r * +(m >>> 0);
            m = ~~n >>> 0;
            c[(c[x >> 2] | 0) + (((c[v >> 2] | 0) + -1 | 0) * 20 | 0) + 12 >> 2] = m;
            c[w >> 2] = (c[w >> 2] | 0) + m;
            if (k >>> 0 < h >>> 0) n = n - +(m >>> 0);
            else {
              y = 44;
              break
            }
          }
          do
            if ((y | 0) != 38)
              if ((y | 0) == 44) {
                A = ab(e[21285] | 0, +g[117], +g[118], +g[119], +g[120]) | 0;
                j = i + 229964 | 0;
                c[j >> 2] = A;
                if (!A) {
                  Hb(10918, 344, 1, 11236, 0);
                  break
                } else {
                  rd(i) | 0;
                  c[i + 28 >> 2] = 0;
                  c[i + 12 >> 2] = c[x >> 2];
                  c[i + 4 >> 2] = 0;
                  c[i + 564 >> 2] = 0;
                  Eb(i);
                  break
                }
              } else if ((y | 0) == 47) j = i + 229964 | 0; while (0);
          if (!(c[j >> 2] | 0)) {
            xb(i);
            i = 0
          }
        }
      while (0);
      l = B;
      return i | 0
    }

    function Xa(a) {
      a = a | 0;
      var b = 0,
        d = 0,
        e = 0,
        f = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0;
      if (!a) return;
      d = a + -8 | 0;
      f = c[10505] | 0;
      a = c[a + -4 >> 2] | 0;
      b = a & -8;
      j = d + b | 0;
      do
        if (!(a & 1)) {
          e = c[d >> 2] | 0;
          if (!(a & 3)) return;
          h = d + (0 - e) | 0;
          g = e + b | 0;
          if (h >>> 0 < f >>> 0) return;
          if ((c[10506] | 0) == (h | 0)) {
            a = j + 4 | 0;
            b = c[a >> 2] | 0;
            if ((b & 3 | 0) != 3) {
              i = h;
              b = g;
              break
            }
            c[10503] = g;
            c[a >> 2] = b & -2;
            c[h + 4 >> 2] = g | 1;
            c[h + g >> 2] = g;
            return
          }
          d = e >>> 3;
          if (e >>> 0 < 256) {
            a = c[h + 8 >> 2] | 0;
            b = c[h + 12 >> 2] | 0;
            if ((b | 0) == (a | 0)) {
              c[10501] = c[10501] & ~(1 << d);
              i = h;
              b = g;
              break
            } else {
              c[a + 12 >> 2] = b;
              c[b + 8 >> 2] = a;
              i = h;
              b = g;
              break
            }
          }
          f = c[h + 24 >> 2] | 0;
          a = c[h + 12 >> 2] | 0;
          do
            if ((a | 0) == (h | 0)) {
              d = h + 16 | 0;
              b = d + 4 | 0;
              a = c[b >> 2] | 0;
              if (!a) {
                a = c[d >> 2] | 0;
                if (!a) {
                  a = 0;
                  break
                } else b = d
              }
              while (1) {
                d = a + 20 | 0;
                e = c[d >> 2] | 0;
                if (e | 0) {
                  a = e;
                  b = d;
                  continue
                }
                d = a + 16 | 0;
                e = c[d >> 2] | 0;
                if (!e) break;
                else {
                  a = e;
                  b = d
                }
              }
              c[b >> 2] = 0
            } else {
              i = c[h + 8 >> 2] | 0;
              c[i + 12 >> 2] = a;
              c[a + 8 >> 2] = i
            }
          while (0);
          if (!f) {
            i = h;
            b = g
          } else {
            b = c[h + 28 >> 2] | 0;
            d = 42308 + (b << 2) | 0;
            if ((c[d >> 2] | 0) == (h | 0)) {
              c[d >> 2] = a;
              if (!a) {
                c[10502] = c[10502] & ~(1 << b);
                i = h;
                b = g;
                break
              }
            } else {
              c[f + 16 + (((c[f + 16 >> 2] | 0) != (h | 0) & 1) << 2) >> 2] = a;
              if (!a) {
                i = h;
                b = g;
                break
              }
            }
            c[a + 24 >> 2] = f;
            b = h + 16 | 0;
            d = c[b >> 2] | 0;
            if (d | 0) {
              c[a + 16 >> 2] = d;
              c[d + 24 >> 2] = a
            }
            b = c[b + 4 >> 2] | 0;
            if (!b) {
              i = h;
              b = g
            } else {
              c[a + 20 >> 2] = b;
              c[b + 24 >> 2] = a;
              i = h;
              b = g
            }
          }
        } else {
          i = d;
          h = d
        }
      while (0);
      if (h >>> 0 >= j >>> 0) return;
      a = j + 4 | 0;
      e = c[a >> 2] | 0;
      if (!(e & 1)) return;
      if (!(e & 2)) {
        if ((c[10507] | 0) == (j | 0)) {
          j = (c[10504] | 0) + b | 0;
          c[10504] = j;
          c[10507] = i;
          c[i + 4 >> 2] = j | 1;
          if ((i | 0) != (c[10506] | 0)) return;
          c[10506] = 0;
          c[10503] = 0;
          return
        }
        if ((c[10506] | 0) == (j | 0)) {
          j = (c[10503] | 0) + b | 0;
          c[10503] = j;
          c[10506] = h;
          c[i + 4 >> 2] = j | 1;
          c[h + j >> 2] = j;
          return
        }
        f = (e & -8) + b | 0;
        d = e >>> 3;
        do
          if (e >>> 0 < 256) {
            b = c[j + 8 >> 2] | 0;
            a = c[j + 12 >> 2] | 0;
            if ((a | 0) == (b | 0)) {
              c[10501] = c[10501] & ~(1 << d);
              break
            } else {
              c[b + 12 >> 2] = a;
              c[a + 8 >> 2] = b;
              break
            }
          } else {
            g = c[j + 24 >> 2] | 0;
            a = c[j + 12 >> 2] | 0;
            do
              if ((a | 0) == (j | 0)) {
                d = j + 16 | 0;
                b = d + 4 | 0;
                a = c[b >> 2] | 0;
                if (!a) {
                  a = c[d >> 2] | 0;
                  if (!a) {
                    d = 0;
                    break
                  } else b = d
                }
                while (1) {
                  d = a + 20 | 0;
                  e = c[d >> 2] | 0;
                  if (e | 0) {
                    a = e;
                    b = d;
                    continue
                  }
                  d = a + 16 | 0;
                  e = c[d >> 2] | 0;
                  if (!e) break;
                  else {
                    a = e;
                    b = d
                  }
                }
                c[b >> 2] = 0;
                d = a
              } else {
                d = c[j + 8 >> 2] | 0;
                c[d + 12 >> 2] = a;
                c[a + 8 >> 2] = d;
                d = a
              }
            while (0);
            if (g | 0) {
              a = c[j + 28 >> 2] | 0;
              b = 42308 + (a << 2) | 0;
              if ((c[b >> 2] | 0) == (j | 0)) {
                c[b >> 2] = d;
                if (!d) {
                  c[10502] = c[10502] & ~(1 << a);
                  break
                }
              } else {
                c[g + 16 + (((c[g + 16 >> 2] | 0) != (j | 0) & 1) << 2) >> 2] = d;
                if (!d) break
              }
              c[d + 24 >> 2] = g;
              a = j + 16 | 0;
              b = c[a >> 2] | 0;
              if (b | 0) {
                c[d + 16 >> 2] = b;
                c[b + 24 >> 2] = d
              }
              a = c[a + 4 >> 2] | 0;
              if (a | 0) {
                c[d + 20 >> 2] = a;
                c[a + 24 >> 2] = d
              }
            }
          }
        while (0);
        c[i + 4 >> 2] = f | 1;
        c[h + f >> 2] = f;
        if ((i | 0) == (c[10506] | 0)) {
          c[10503] = f;
          return
        }
      } else {
        c[a >> 2] = e & -2;
        c[i + 4 >> 2] = b | 1;
        c[h + b >> 2] = b;
        f = b
      }
      a = f >>> 3;
      if (f >>> 0 < 256) {
        d = 42044 + (a << 1 << 2) | 0;
        b = c[10501] | 0;
        a = 1 << a;
        if (!(b & a)) {
          c[10501] = b | a;
          a = d;
          b = d + 8 | 0
        } else {
          b = d + 8 | 0;
          a = c[b >> 2] | 0
        }
        c[b >> 2] = i;
        c[a + 12 >> 2] = i;
        c[i + 8 >> 2] = a;
        c[i + 12 >> 2] = d;
        return
      }
      a = f >>> 8;
      if (!a) a = 0;
      else if (f >>> 0 > 16777215) a = 31;
      else {
        h = (a + 1048320 | 0) >>> 16 & 8;
        j = a << h;
        g = (j + 520192 | 0) >>> 16 & 4;
        j = j << g;
        a = (j + 245760 | 0) >>> 16 & 2;
        a = 14 - (g | h | a) + (j << a >>> 15) | 0;
        a = f >>> (a + 7 | 0) & 1 | a << 1
      }
      e = 42308 + (a << 2) | 0;
      c[i + 28 >> 2] = a;
      c[i + 20 >> 2] = 0;
      c[i + 16 >> 2] = 0;
      b = c[10502] | 0;
      d = 1 << a;
      do
        if (!(b & d)) {
          c[10502] = b | d;
          c[e >> 2] = i;
          c[i + 24 >> 2] = e;
          c[i + 12 >> 2] = i;
          c[i + 8 >> 2] = i
        } else {
          b = f << ((a | 0) == 31 ? 0 : 25 - (a >>> 1) | 0);
          d = c[e >> 2] | 0;
          while (1) {
            if ((c[d + 4 >> 2] & -8 | 0) == (f | 0)) {
              a = 73;
              break
            }
            e = d + 16 + (b >>> 31 << 2) | 0;
            a = c[e >> 2] | 0;
            if (!a) {
              a = 72;
              break
            } else {
              b = b << 1;
              d = a
            }
          }
          if ((a | 0) == 72) {
            c[e >> 2] = i;
            c[i + 24 >> 2] = d;
            c[i + 12 >> 2] = i;
            c[i + 8 >> 2] = i;
            break
          } else if ((a | 0) == 73) {
            h = d + 8 | 0;
            j = c[h >> 2] | 0;
            c[j + 12 >> 2] = i;
            c[h >> 2] = i;
            c[i + 8 >> 2] = j;
            c[i + 12 >> 2] = d;
            c[i + 24 >> 2] = 0;
            break
          }
        }
      while (0);
      j = (c[10509] | 0) + -1 | 0;
      c[10509] = j;
      if (!j) a = 42460;
      else return;
      while (1) {
        a = c[a >> 2] | 0;
        if (!a) break;
        else a = a + 8 | 0
      }
      c[10509] = -1;
      return
    }

    function Ya(a, b) {
      a = a | 0;
      b = b | 0;
      var d = 0,
        e = 0,
        f = 0,
        g = 0,
        h = 0,
        i = 0;
      i = a + b | 0;
      d = c[a + 4 >> 2] | 0;
      do
        if (!(d & 1)) {
          f = c[a >> 2] | 0;
          if (!(d & 3)) return;
          h = a + (0 - f) | 0;
          b = f + b | 0;
          if ((c[10506] | 0) == (h | 0)) {
            a = i + 4 | 0;
            d = c[a >> 2] | 0;
            if ((d & 3 | 0) != 3) break;
            c[10503] = b;
            c[a >> 2] = d & -2;
            c[h + 4 >> 2] = b | 1;
            c[i >> 2] = b;
            return
          }
          e = f >>> 3;
          if (f >>> 0 < 256) {
            a = c[h + 8 >> 2] | 0;
            d = c[h + 12 >> 2] | 0;
            if ((d | 0) == (a | 0)) {
              c[10501] = c[10501] & ~(1 << e);
              break
            } else {
              c[a + 12 >> 2] = d;
              c[d + 8 >> 2] = a;
              break
            }
          }
          g = c[h + 24 >> 2] | 0;
          a = c[h + 12 >> 2] | 0;
          do
            if ((a | 0) == (h | 0)) {
              e = h + 16 | 0;
              d = e + 4 | 0;
              a = c[d >> 2] | 0;
              if (!a) {
                a = c[e >> 2] | 0;
                if (!a) {
                  a = 0;
                  break
                } else d = e
              }
              while (1) {
                e = a + 20 | 0;
                f = c[e >> 2] | 0;
                if (f | 0) {
                  a = f;
                  d = e;
                  continue
                }
                e = a + 16 | 0;
                f = c[e >> 2] | 0;
                if (!f) break;
                else {
                  a = f;
                  d = e
                }
              }
              c[d >> 2] = 0
            } else {
              f = c[h + 8 >> 2] | 0;
              c[f + 12 >> 2] = a;
              c[a + 8 >> 2] = f
            }
          while (0);
          if (g) {
            d = c[h + 28 >> 2] | 0;
            e = 42308 + (d << 2) | 0;
            if ((c[e >> 2] | 0) == (h | 0)) {
              c[e >> 2] = a;
              if (!a) {
                c[10502] = c[10502] & ~(1 << d);
                break
              }
            } else {
              c[g + 16 + (((c[g + 16 >> 2] | 0) != (h | 0) & 1) << 2) >> 2] = a;
              if (!a) break
            }
            c[a + 24 >> 2] = g;
            d = h + 16 | 0;
            e = c[d >> 2] | 0;
            if (e | 0) {
              c[a + 16 >> 2] = e;
              c[e + 24 >> 2] = a
            }
            d = c[d + 4 >> 2] | 0;
            if (d) {
              c[a + 20 >> 2] = d;
              c[d + 24 >> 2] = a
            }
          }
        } else h = a; while (0);
      a = i + 4 | 0;
      e = c[a >> 2] | 0;
      if (!(e & 2)) {
        if ((c[10507] | 0) == (i | 0)) {
          i = (c[10504] | 0) + b | 0;
          c[10504] = i;
          c[10507] = h;
          c[h + 4 >> 2] = i | 1;
          if ((h | 0) != (c[10506] | 0)) return;
          c[10506] = 0;
          c[10503] = 0;
          return
        }
        if ((c[10506] | 0) == (i | 0)) {
          i = (c[10503] | 0) + b | 0;
          c[10503] = i;
          c[10506] = h;
          c[h + 4 >> 2] = i | 1;
          c[h + i >> 2] = i;
          return
        }
        f = (e & -8) + b | 0;
        d = e >>> 3;
        do
          if (e >>> 0 < 256) {
            a = c[i + 8 >> 2] | 0;
            b = c[i + 12 >> 2] | 0;
            if ((b | 0) == (a | 0)) {
              c[10501] = c[10501] & ~(1 << d);
              break
            } else {
              c[a + 12 >> 2] = b;
              c[b + 8 >> 2] = a;
              break
            }
          } else {
            g = c[i + 24 >> 2] | 0;
            b = c[i + 12 >> 2] | 0;
            do
              if ((b | 0) == (i | 0)) {
                d = i + 16 | 0;
                a = d + 4 | 0;
                b = c[a >> 2] | 0;
                if (!b) {
                  b = c[d >> 2] | 0;
                  if (!b) {
                    d = 0;
                    break
                  } else a = d
                }
                while (1) {
                  d = b + 20 | 0;
                  e = c[d >> 2] | 0;
                  if (e | 0) {
                    b = e;
                    a = d;
                    continue
                  }
                  d = b + 16 | 0;
                  e = c[d >> 2] | 0;
                  if (!e) break;
                  else {
                    b = e;
                    a = d
                  }
                }
                c[a >> 2] = 0;
                d = b
              } else {
                d = c[i + 8 >> 2] | 0;
                c[d + 12 >> 2] = b;
                c[b + 8 >> 2] = d;
                d = b
              }
            while (0);
            if (g | 0) {
              b = c[i + 28 >> 2] | 0;
              a = 42308 + (b << 2) | 0;
              if ((c[a >> 2] | 0) == (i | 0)) {
                c[a >> 2] = d;
                if (!d) {
                  c[10502] = c[10502] & ~(1 << b);
                  break
                }
              } else {
                c[g + 16 + (((c[g + 16 >> 2] | 0) != (i | 0) & 1) << 2) >> 2] = d;
                if (!d) break
              }
              c[d + 24 >> 2] = g;
              b = i + 16 | 0;
              a = c[b >> 2] | 0;
              if (a | 0) {
                c[d + 16 >> 2] = a;
                c[a + 24 >> 2] = d
              }
              b = c[b + 4 >> 2] | 0;
              if (b | 0) {
                c[d + 20 >> 2] = b;
                c[b + 24 >> 2] = d
              }
            }
          }
        while (0);
        c[h + 4 >> 2] = f | 1;
        c[h + f >> 2] = f;
        if ((h | 0) == (c[10506] | 0)) {
          c[10503] = f;
          return
        }
      } else {
        c[a >> 2] = e & -2;
        c[h + 4 >> 2] = b | 1;
        c[h + b >> 2] = b;
        f = b
      }
      b = f >>> 3;
      if (f >>> 0 < 256) {
        d = 42044 + (b << 1 << 2) | 0;
        a = c[10501] | 0;
        b = 1 << b;
        if (!(a & b)) {
          c[10501] = a | b;
          b = d;
          a = d + 8 | 0
        } else {
          a = d + 8 | 0;
          b = c[a >> 2] | 0
        }
        c[a >> 2] = h;
        c[b + 12 >> 2] = h;
        c[h + 8 >> 2] = b;
        c[h + 12 >> 2] = d;
        return
      }
      b = f >>> 8;
      if (!b) b = 0;
      else if (f >>> 0 > 16777215) b = 31;
      else {
        g = (b + 1048320 | 0) >>> 16 & 8;
        i = b << g;
        e = (i + 520192 | 0) >>> 16 & 4;
        i = i << e;
        b = (i + 245760 | 0) >>> 16 & 2;
        b = 14 - (e | g | b) + (i << b >>> 15) | 0;
        b = f >>> (b + 7 | 0) & 1 | b << 1
      }
      e = 42308 + (b << 2) | 0;
      c[h + 28 >> 2] = b;
      c[h + 20 >> 2] = 0;
      c[h + 16 >> 2] = 0;
      a = c[10502] | 0;
      d = 1 << b;
      if (!(a & d)) {
        c[10502] = a | d;
        c[e >> 2] = h;
        c[h + 24 >> 2] = e;
        c[h + 12 >> 2] = h;
        c[h + 8 >> 2] = h;
        return
      }
      a = f << ((b | 0) == 31 ? 0 : 25 - (b >>> 1) | 0);
      d = c[e >> 2] | 0;
      while (1) {
        if ((c[d + 4 >> 2] & -8 | 0) == (f | 0)) {
          b = 69;
          break
        }
        e = d + 16 + (a >>> 31 << 2) | 0;
        b = c[e >> 2] | 0;
        if (!b) {
          b = 68;
          break
        } else {
          a = a << 1;
          d = b
        }
      }
      if ((b | 0) == 68) {
        c[e >> 2] = h;
        c[h + 24 >> 2] = d;
        c[h + 12 >> 2] = h;
        c[h + 8 >> 2] = h;
        return
      } else if ((b | 0) == 69) {
        g = d + 8 | 0;
        i = c[g >> 2] | 0;
        c[i + 12 >> 2] = h;
        c[g >> 2] = h;
        c[h + 8 >> 2] = i;
        c[h + 12 >> 2] = d;
        c[h + 24 >> 2] = 0;
        return
      }
    }

    function Za(a, b, e, f, g) {
      a = a | 0;
      b = b | 0;
      e = e | 0;
      f = f | 0;
      g = g | 0;
      var h = 0.0,
        i = 0,
        j = 0,
        k = 0.0,
        l = 0,
        m = 0,
        n = 0,
        o = 0.0,
        p = 0,
        q = 0,
        r = 0,
        s = 0,
        t = 0,
        u = 0,
        v = 0,
        w = 0,
        x = 0,
        y = 0;
      w = 0;
      y = a + 4 | 0;
      i = c[y >> 2] | 0;
      x = a + 100 | 0;
      if (i >>> 0 < (c[x >> 2] | 0) >>> 0) {
        c[y >> 2] = i + 1;
        j = d[i >> 0] | 0;
        l = 0
      } else {
        j = Ub(a) | 0;
        l = 0
      }
      a: while (1) {
        switch (j | 0) {
          case 46:
            {
              w = 8;
              break a
            }
          case 48:
            break;
          default:
            {
              s = 0;n = 0;o = 1.0;h = 0.0;i = 0;m = j;t = l;v = 0;u = 0;l = 0;j = 0;
              break a
            }
        }
        i = c[y >> 2] | 0;
        if (i >>> 0 < (c[x >> 2] | 0) >>> 0) {
          c[y >> 2] = i + 1;
          j = d[i >> 0] | 0;
          l = 1;
          continue
        } else {
          j = Ub(a) | 0;
          l = 1;
          continue
        }
      }
      if ((w | 0) == 8) {
        i = c[y >> 2] | 0;
        if (i >>> 0 < (c[x >> 2] | 0) >>> 0) {
          c[y >> 2] = i + 1;
          j = d[i >> 0] | 0
        } else j = Ub(a) | 0;
        if ((j | 0) == 48) {
          l = 0;
          j = 0;
          do {
            i = c[y >> 2] | 0;
            if (i >>> 0 < (c[x >> 2] | 0) >>> 0) {
              c[y >> 2] = i + 1;
              m = d[i >> 0] | 0
            } else m = Ub(a) | 0;
            l = te(l | 0, j | 0, -1, -1) | 0;
            j = z
          } while ((m | 0) == 48);
          s = 1;
          n = 0;
          o = 1.0;
          h = 0.0;
          i = 0;
          t = 1;
          v = 0;
          u = 0
        } else {
          s = 1;
          n = 0;
          o = 1.0;
          h = 0.0;
          i = 0;
          m = j;
          t = l;
          v = 0;
          u = 0;
          l = 0;
          j = 0
        }
      }
      while (1) {
        q = m + -48 | 0;
        p = m | 32;
        if (q >>> 0 < 10) w = 20;
        else {
          r = (m | 0) == 46;
          if (!(r | (p + -97 | 0) >>> 0 < 6)) break;
          if (r)
            if (!s) {
              s = 1;
              k = o;
              r = t;
              l = u;
              j = v;
              q = u;
              p = v
            } else {
              m = 46;
              break
            }
          else w = 20
        }
        if ((w | 0) == 20) {
          w = 0;
          m = (m | 0) > 57 ? p + -87 | 0 : q;
          do
            if ((v | 0) < 0 | (v | 0) == 0 & u >>> 0 < 8) {
              k = o;
              i = m + (i << 4) | 0
            } else if ((v | 0) < 0 | (v | 0) == 0 & u >>> 0 < 14) {
            o = o * .0625;
            k = o;
            h = h + o * +(m | 0);
            break
          } else {
            t = (n | 0) != 0 | (m | 0) == 0;
            n = t ? n : 1;
            k = o;
            h = t ? h : h + o * .5;
            break
          }
          while (0);
          q = te(u | 0, v | 0, 1, 0) | 0;
          r = 1;
          p = z
        }
        m = c[y >> 2] | 0;
        if (m >>> 0 < (c[x >> 2] | 0) >>> 0) {
          c[y >> 2] = m + 1;
          o = k;
          m = d[m >> 0] | 0;
          t = r;
          v = p;
          u = q;
          continue
        } else {
          o = k;
          m = Ub(a) | 0;
          t = r;
          v = p;
          u = q;
          continue
        }
      }
      do
        if (!t) {
          i = (c[x >> 2] | 0) == 0;
          if (!i) c[y >> 2] = (c[y >> 2] | 0) + -1;
          if (!g) Od(a, 0);
          else {
            if (!i) c[y >> 2] = (c[y >> 2] | 0) + -1;
            if (!((s | 0) == 0 | i)) c[y >> 2] = (c[y >> 2] | 0) + -1
          }
          h = +(f | 0) * 0.0
        } else {
          p = (s | 0) == 0;
          q = p ? u : l;
          p = p ? v : j;
          if ((v | 0) < 0 | (v | 0) == 0 & u >>> 0 < 8) {
            l = u;
            j = v;
            while (1) {
              i = i << 4;
              w = l;
              l = te(l | 0, j | 0, 1, 0) | 0;
              if (!((j | 0) < 0 | (j | 0) == 0 & w >>> 0 < 7)) {
                n = i;
                break
              } else j = z
            }
          } else n = i;
          if ((m | 32 | 0) == 112) {
            j = ob(a, g) | 0;
            i = z;
            if ((j | 0) == 0 & (i | 0) == -2147483648) {
              if (!g) {
                Od(a, 0);
                h = 0.0;
                break
              }
              if (!(c[x >> 2] | 0)) {
                j = 0;
                i = 0
              } else {
                c[y >> 2] = (c[y >> 2] | 0) + -1;
                j = 0;
                i = 0
              }
            }
          } else if (!(c[x >> 2] | 0)) {
            j = 0;
            i = 0
          } else {
            c[y >> 2] = (c[y >> 2] | 0) + -1;
            j = 0;
            i = 0
          }
          l = je(q | 0, p | 0, 2) | 0;
          l = te(l | 0, z | 0, -32, -1) | 0;
          l = te(l | 0, z | 0, j | 0, i | 0) | 0;
          i = z;
          if (!n) {
            h = +(f | 0) * 0.0;
            break
          }
          y = 0 - e | 0;
          g = ((y | 0) < 0) << 31 >> 31;
          if ((i | 0) > (g | 0) | (i | 0) == (g | 0) & l >>> 0 > y >>> 0) {
            c[($f() | 0) >> 2] = 34;
            h = +(f | 0) * 1797693134862315708145274.0e284 * 1797693134862315708145274.0e284;
            break
          }
          y = e + -106 | 0;
          g = ((y | 0) < 0) << 31 >> 31;
          if ((i | 0) < (g | 0) | (i | 0) == (g | 0) & l >>> 0 < y >>> 0) {
            c[($f() | 0) >> 2] = 34;
            h = +(f | 0) * 2.2250738585072014e-308 * 2.2250738585072014e-308;
            break
          }
          if ((n | 0) > -1) {
            j = n;
            do {
              y = !(h >= .5);
              j = j << 1 | (y ^ 1) & 1;
              h = h + (y ? h : h + -1.0);
              l = te(l | 0, i | 0, -1, -1) | 0;
              i = z
            } while ((j | 0) > -1);
            o = h;
            m = j
          } else {
            o = h;
            m = n
          }
          y = ((b | 0) < 0) << 31 >> 31;
          e = ne(32, 0, e | 0, ((e | 0) < 0) << 31 >> 31 | 0) | 0;
          i = te(e | 0, z | 0, l | 0, i | 0) | 0;
          e = z;
          if ((e | 0) < (y | 0) | (e | 0) == (y | 0) & i >>> 0 < b >>> 0)
            if ((i | 0) > 0) w = 59;
            else {
              j = 0;
              i = 84;
              w = 61
            }
          else {
            i = b;
            w = 59
          }
          if ((w | 0) == 59)
            if ((i | 0) < 53) {
              j = i;
              i = 84 - i | 0;
              w = 61
            } else {
              k = 0.0;
              h = +(f | 0)
            }
          if ((w | 0) == 61) {
            h = +(f | 0);
            k = +kf(+oc(1.0, i), h);
            i = j
          }
          f = (m & 1 | 0) == 0 & (o != 0.0 & (i | 0) < 32);
          h = (f ? 0.0 : o) * h + (k + h * +((m + (f & 1) | 0) >>> 0)) - k;
          if (!(h != 0.0)) c[($f() | 0) >> 2] = 34;
          h = +nf(h, l)
        }
      while (0);
      return +h
    }

    function _a(b, f) {
      b = b | 0;
      f = f | 0;
      var h = 0,
        i = 0,
        j = 0.0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0.0,
        p = 0,
        q = 0,
        r = 0,
        s = 0,
        t = 0,
        u = 0.0,
        v = 0,
        w = 0,
        x = 0,
        y = 0,
        z = 0,
        A = 0;
      A = 0;
      do
        if (!(td(b, 10863, 4) | 0)) {
          i = d[b + 5 >> 0] << 16 | d[b + 4 >> 0] << 24 | d[b + 6 >> 0] << 8 | d[b + 7 >> 0];
          if (td(b + 8 | 0, 10884, 8) | 0) {
            Hb(10868, 82, 17, 0, 0);
            b = 0;
            break
          }
          y = a[b + 20 >> 0] | 0;
          z = y & 255;
          if (!(y << 24 >> 24)) {
            Hb(10868, 98, 17, 0, 0);
            b = 0;
            break
          }
          b = b + 21 + (i + -13) | 0;
          if (td(b, 10893, 4) | 0) {
            Hb(10868, 113, 17, 0, 0);
            b = 0;
            break
          }
          h = b + 4 + 1 + 1 + 1 + 1 | 0;
          if (td(h, 10898, 4) | 0) {
            Hb(10868, 128, 17, 0, 0);
            b = 0;
            break
          }
          b = vc() | 0;
          gd(b, 60) | 0;
          nd(b, 5e5) | 0;
          u = +Le(60, 5e5);
          v = La(8192) | 0;
          Tb(v | 0, 0, 8192) | 0;
          w = b + 8 | 0;
          x = b + 16 | 0;
          y = b + 32 | 0;
          l = 0;
          m = 0;
          j = 0.0;
          k = h + 4 | 0;
          t = 0;
          f = f + -33 + (13 - i) | 0;
          a: while (1) {
            if (t >>> 0 >= z >>> 0) {
              A = 49;
              break
            }
            if (td(k, 10863, 4) | 0) {
              A = 14;
              break
            }
            if (td(k + 8 | 0, 10898, 4) | 0) {
              A = 16;
              break
            }
            i = (d[k + 5 >> 0] << 16 | d[k + 4 >> 0] << 24 | d[k + 6 >> 0] << 8 | d[k + 7 >> 0]) + -4 | 0;
            h = m;
            k = k + 12 | 0;
            f = f + -12 | 0;
            do
              do
                if (!(td(k, 10903, 4) | 0)) {
                  r = d[k + 5 >> 0] << 16 | d[k + 4 >> 0] << 24 | d[k + 6 >> 0] << 8 | d[k + 7 >> 0];
                  s = r + 8 | 0;
                  i = i - s | 0;
                  k = k + 8 + r | 0;
                  f = f - s | 0
                } else {
                  if (!(td(k, 10908, 4) | 0)) {
                    r = d[k + 5 >> 0] << 16 | d[k + 4 >> 0] << 24 | d[k + 6 >> 0] << 8 | d[k + 7 >> 0];
                    s = r + 8 | 0;
                    i = i - s | 0;
                    k = k + 8 + r | 0;
                    f = f - s | 0;
                    break
                  }
                  if (td(k, 10913, 4) | 0) {
                    A = 46;
                    break a
                  }
                  l = l + 1 | 0;
                  m = d[k + 5 >> 0] << 16 | d[k + 4 >> 0] << 24 | d[k + 6 >> 0] << 8 | d[k + 7 >> 0];
                  i = i + -8 | 0;
                  k = k + 8 | 0;
                  s = f + -8 | 0;
                  while (1) {
                    f = a[k >> 0] | 0;
                    b: do
                      if (f << 24 >> 24 > -1) {
                        r = m + -1 | 0;
                        q = f & 127;
                        do {
                          p = (h + -1 | 0) >>> 0 >= q >>> 0 ? q : h;
                          j = j + u * +(p >>> 0);
                          n = ~~j >>> 0;
                          o = +(n >>> 0);
                          h = (c[w >> 2] | 0) + (((c[x >> 2] | 0) + -1 | 0) * 20 | 0) + 12 | 0;
                          c[h >> 2] = (c[h >> 2] | 0) + n;
                          c[y >> 2] = (c[y >> 2] | 0) + n;
                          n = 0;
                          h = 0;
                          while (1) {
                            if ((n | 0) == 2048) break;
                            m = v + (n << 2) | 0;
                            f = c[m >> 2] | 0;
                            do
                              if (f) {
                                f = f - p | 0;
                                c[m >> 2] = f;
                                if (!f) {
                                  Rc(b, n >>> 7 & 255, n & 127, 0) | 0;
                                  break
                                } else {
                                  h = (h + -1 | 0) >>> 0 >= f >>> 0 ? f : h;
                                  break
                                }
                              }
                            while (0);
                            n = n + 1 | 0
                          }
                          j = j - o;
                          q = q - p | 0
                        } while ((q | 0) != 0);
                        m = r;
                        i = i + -1 | 0;
                        k = k + 1 | 0;
                        f = s + -1 | 0
                      } else {
                        do
                          if (f << 24 >> 24 == -1) {
                            if ((a[k + 1 >> 0] | 0) != 81) {
                              A = 37;
                              break
                            }
                            if ((a[k + 2 >> 0] | 0) == 3) f = 6;
                            else A = 37
                          } else A = 37; while (0);
                        do
                          if ((A | 0) == 37) {
                            A = 0;
                            f = Na(b, k, s, 0) | 0;
                            if (!f) break a;
                            q = d[k >> 0] | 0;
                            if ((q & 240 | 0) != 144) break;
                            r = a[k + 1 >> 0] | 0;
                            n = k + f | 0;
                            p = s - f | 0;
                            k = m - f | 0;
                            i = i - f | 0;
                            f = a[n >> 0] | 0;
                            c: do
                              if (f << 24 >> 24 < 0) {
                                m = 0;
                                while (1) {
                                  if (f << 24 >> 24 >= 0) break c;
                                  s = n + 1 | 0;
                                  m = m << 7 | f & 127;
                                  k = k + -1 | 0;
                                  i = i + -1 | 0;
                                  n = s;
                                  p = p + -1 | 0;
                                  f = a[s >> 0] | 0
                                }
                              } else m = 0; while (0);
                            f = m << 7 | f & 127;
                            c[v + ((q << 7 & 1920) + (r & 255) << 2) >> 2] = f;
                            m = k + -1 | 0;
                            h = (f | 0) == 0 ? h : (h + -1 | 0) >>> 0 >= f >>> 0 ? f : h;
                            i = i + -1 | 0;
                            k = n + 1 | 0;
                            f = p + -1 | 0;
                            break b
                          }
                        while (0);
                        m = m - f | 0;
                        i = i - f | 0;
                        k = k + f | 0;
                        f = s - f | 0
                      }
                    while (0);
                    if (!m) break;
                    else s = f
                  }
                }
            while (0); while ((i | 0) != 0);
            m = h;
            t = t + 1 | 0
          }
          do
            if ((A | 0) == 14) Hb(10868, 145, 17, 0, 0);
            else if ((A | 0) == 16) Hb(10868, 158, 17, 0, 0);
          else if ((A | 0) == 46) Hb(10868, 316, 17, 0, 0);
          else if ((A | 0) == 49) {
            A = ab(e[21285] | 0, +g[117], +g[118], +g[119], +g[120]) | 0;
            c[b + 229964 >> 2] = A;
            if (!A) {
              Hb(10868, 325, 1, 11236, 0);
              break
            }
            c[b + 28 >> 2] = 0;
            c[b + 12 >> 2] = c[w >> 2];
            c[b + 4 >> 2] = 0;
            c[b + 564 >> 2] = 0;
            if (l >>> 0 > 1) a[b + 23e4 >> 0] = 1;
            Eb(b)
          }
          while (0);
          Xa(v);
          if (!(c[b + 229964 >> 2] | 0)) {
            xb(b);
            b = 0
          }
        } else {
          Hb(10868, 67, 17, 0, 0);
          b = 0
        }
      while (0);
      return b | 0
    }

    function $a(f, i) {
      f = f | 0;
      i = i | 0;
      var j = 0,
        k = 0,
        m = 0.0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 0,
        t = 0,
        u = 0,
        v = 0,
        w = 0,
        x = 0,
        y = 0,
        z = 0,
        A = 0,
        B = 0,
        C = 0;
      B = l;
      l = l + 32 | 0;
      z = B;
      i = B + 24 | 0;
      A = jb(f, i) | 0;
      do
        if (!A) i = 0;
        else {
          if ((c[i >> 2] | 0) >>> 0 < 239) {
            Hb(10393, 735, 7, f, 0);
            Xa(A);
            i = 0;
            break
          }
          if (td(A, 10410, 22) | 0)
            if (td(A, 10432, 22) | 0) {
              Hb(10393, 741, 6, f, 0);
              Xa(A);
              i = 0;
              break
            }
          if ((d[A + 82 >> 0] | 0) > 1) {
            Hb(10393, 746, 6, f, 0);
            Xa(A);
            i = 0;
            break
          }
          if ((d[A + 151 >> 0] | 0) > 1) {
            Hb(10393, 751, 6, f, 0);
            Xa(A);
            i = 0;
            break
          }
          r = 239;
          x = a[A + 198 >> 0] | 0;
          i = 0;
          j = 0;
          while (1) {
            if (!(x << 24 >> 24)) {
              j = 38;
              break
            }
            y = La(108) | 0;
            if (!i) i = y;
            else c[j + 100 >> 2] = y;
            if (!y) {
              j = 16;
              break
            }
            c[y + 100 >> 2] = 0;
            u = y + 16 | 0;
            a[u >> 0] = a[A + (r + 7) >> 0] | 0;
            c[y >> 2] = (d[A + (r + 10) >> 0] | 0) << 16 | (d[A + (r + 11) >> 0] | 0) << 24 | (d[A + (r + 9) >> 0] | 0) << 8 | (d[A + (r + 8) >> 0] | 0);
            v = y + 4 | 0;
            c[v >> 2] = (d[A + (r + 14) >> 0] | 0) << 16 | (d[A + (r + 15) >> 0] | 0) << 24 | (d[A + (r + 13) >> 0] | 0) << 8 | (d[A + (r + 12) >> 0] | 0);
            w = y + 8 | 0;
            c[w >> 2] = (d[A + (r + 18) >> 0] | 0) << 16 | (d[A + (r + 19) >> 0] | 0) << 24 | (d[A + (r + 17) >> 0] | 0) << 8 | (d[A + (r + 16) >> 0] | 0);
            s = (d[A + (r + 21) >> 0] | 0) << 8 | (d[A + (r + 20) >> 0] | 0);
            t = y + 18 | 0;
            b[t >> 1] = s;
            c[y + 20 >> 2] = (d[A + (r + 24) >> 0] | 0) << 16 | (d[A + (r + 25) >> 0] | 0) << 24 | (d[A + (r + 23) >> 0] | 0) << 8 | (d[A + (r + 22) >> 0] | 0);
            c[y + 24 >> 2] = (d[A + (r + 28) >> 0] | 0) << 16 | (d[A + (r + 29) >> 0] | 0) << 24 | (d[A + (r + 27) >> 0] | 0) << 8 | (d[A + (r + 26) >> 0] | 0);
            j = (d[A + (r + 32) >> 0] | 0) << 16 | (d[A + (r + 33) >> 0] | 0) << 24 | (d[A + (r + 31) >> 0] | 0) << 8 | (d[A + (r + 30) >> 0] | 0);
            c[y + 28 >> 2] = j;
            c[y + 92 >> 2] = ((j << 9 >>> 0) / (s >>> 0) | 0) << 1;
            s = y + 32 | 0;
            a[s >> 0] = a[A + (r + 55) >> 0] | 0;
            j = c[v >> 2] | 0;
            k = c[w >> 2] | 0;
            if (j >>> 0 > k >>> 0) {
              c[w >> 2] = j;
              c[v >> 2] = k;
              q = d[u >> 0] | 0;
              a[u >> 0] = q << 4 | q >>> 4
            }
            a[A + (r + 41) >> 0] = 63;
            a[A + (r + 42) >> 0] = 63;
            k = y + 64 | 0;
            n = y + 36 | 0;
            o = r + 37 | 0;
            p = r + 43 | 0;
            j = 0;
            while (1) {
              if ((j | 0) == 6) break;
              if (!(a[s >> 0] & 64)) {
                c[k + (j << 2) >> 2] = 4194303;
                c[n + (j << 2) >> 2] = ~~(4194303.0 / (+(e[21285] | 0) * 1.4560000272467732e-03))
              } else {
                C = a[A + (o + j) >> 0] | 0;
                c[k + (j << 2) >> 2] = (d[A + (p + j) >> 0] | 0) * 16448;
                C = ~~(4194303.0 / (+g[484 + ((C & 255) << 2) >> 2] * +(e[21285] | 0)));
                q = n + (j << 2) | 0;
                c[q >> 2] = C;
                if (!C) {
                  c[z >> 2] = 10393;
                  c[z + 4 >> 2] = j;
                  c[z + 8 >> 2] = f;
                  h[z + 16 >> 3] = 1.4560000272467732e-03;
                  Ud(10454, z);
                  c[q >> 2] = ~~(4194303.0 / (+(e[21285] | 0) * 1.4560000272467732e-03))
                }
              }
              j = j + 1 | 0
            }
            c[y + 88 >> 2] = 0;
            k = y + 60 | 0;
            c[k >> 2] = ~~(4194303.0 / (+(e[21285] | 0) * 1.4560000272467732e-03));
            n = r + 96 | 0;
            o = c[y >> 2] | 0;
            C = d[s >> 0] | 0;
            if ((Ha[c[1508 + ((C >>> 1 & 12 | C & 3) << 2) >> 2] & 31](A + n | 0, y) | 0) == -1) {
              j = 27;
              break
            }
            j = d[s >> 0] | 0;
            if (!(j & 64)) {
              k = c[y >> 2] | 0;
              j = O(k, e[21285] | 0) | 0;
              j = (j >>> 0) / ((e[t >> 1] | 0) >>> 0) | 0
            } else {
              if (!(j & 128)) {
                if (!(j & 32)) {
                  j = c[y + 80 >> 2] | 0;
                  m = (4194301.0 - +(j | 0)) / +(c[y + 52 >> 2] | 0)
                } else {
                  C = c[y + 76 >> 2] | 0;
                  j = c[y + 80 >> 2] | 0;
                  m = (4194301.0 - +(C | 0)) / +(c[y + 48 >> 2] | 0) + +(C - j | 0) / +(c[y + 52 >> 2] | 0)
                }
                C = c[y + 84 >> 2] | 0;
                m = m + +(j - C | 0) / +(c[y + 56 >> 2] | 0);
                j = C
              } else {
                j = c[y + 84 >> 2] | 0;
                m = (4194301.0 - +(j | 0)) / +(c[y + 56 >> 2] | 0)
              }
              j = ~~(m + +(j | 0) / +(c[k >> 2] | 0)) >>> 0;
              k = c[y >> 2] | 0
            }
            c[y + 104 >> 2] = j;
            j = a[u >> 0] | 0;
            r = (j & 15) << 6 | c[v >> 2] << 10;
            c[v >> 2] = r;
            j = (j & -16 & 255) << 2 | c[w >> 2] << 10;
            c[w >> 2] = j;
            c[y + 12 >> 2] = j - r;
            c[y >> 2] = k << 10;
            r = o + n | 0;
            x = x + -1 << 24 >> 24;
            j = y
          }
          if ((j | 0) == 16) {
            Hb(10393, 771, 1, f, 0);
            Xa(A);
            i = 0;
            break
          } else if ((j | 0) == 27) {
            Xa(A);
            i = 0;
            break
          } else if ((j | 0) == 38) {
            Xa(A);
            break
          }
        }
      while (0);
      l = B;
      return i | 0
    }

    function ab(a, b, d, e, f) {
      a = a | 0;
      b = +b;
      d = +d;
      e = +e;
      f = +f;
      var g = 0,
        i = 0,
        j = 0,
        k = 0,
        m = 0,
        n = 0,
        o = 0.0,
        p = 0.0,
        q = 0.0,
        r = 0.0,
        s = 0.0,
        t = 0.0,
        u = 0.0,
        v = 0.0,
        w = 0.0,
        x = 0.0,
        y = 0,
        z = 0,
        A = 0,
        B = 0,
        G = 0,
        H = 0,
        I = 0,
        J = 0.0;
      I = l;
      l = l + 416 | 0;
      z = I + 368 | 0;
      A = I + 320 | 0;
      B = I + 256 | 0;
      G = I + 192 | 0;
      H = I + 128 | 0;
      y = I;
      h[z >> 3] = 125.0;
      h[z + 8 >> 3] = 250.0;
      h[z + 16 >> 3] = 500.0;
      h[z + 24 >> 3] = 1.0e3;
      h[z + 32 >> 3] = 2.0e3;
      h[z + 40 >> 3] = 4.0e3;
      h[A >> 3] = -.00044;
      h[A + 8 >> 3] = -.00131;
      h[A + 16 >> 3] = -.002728;
      h[A + 24 >> 3] = -.004665;
      h[A + 32 >> 3] = -.009887;
      h[A + 40 >> 3] = -.029665;
      g = B;
      i = g + 64 | 0;
      do {
        c[g >> 2] = 0;
        g = g + 4 | 0
      } while ((g | 0) < (i | 0));
      g = G;
      i = g + 64 | 0;
      do {
        c[g >> 2] = 0;
        g = g + 4 | 0
      } while ((g | 0) < (i | 0));
      g = H;
      i = g + 64 | 0;
      do {
        c[g >> 2] = 0;
        g = g + 4 | 0
      } while ((g | 0) < (i | 0));
      g = La(2624) | 0;
      u = b;
      w = u * .25;
      x = w * 3.0;
      q = d;
      v = q / 10.0;
      s = u / 3.0;
      h[y >> 3] = s;
      n = y + 8 | 0;
      t = q / 3.0;
      c[n >> 2] = 0;
      c[n + 4 >> 2] = 0;
      c[n + 8 >> 2] = 0;
      c[n + 12 >> 2] = 0;
      h[y + 24 >> 3] = t;
      h[y + 32 >> 3] = 0.0;
      r = t * 2.0;
      h[y + 40 >> 3] = r;
      h[y + 48 >> 3] = s;
      h[y + 56 >> 3] = q;
      s = s * 2.0;
      h[y + 64 >> 3] = s;
      h[y + 72 >> 3] = q;
      h[y + 80 >> 3] = u;
      h[y + 88 >> 3] = r;
      h[y + 96 >> 3] = u;
      h[y + 104 >> 3] = t;
      h[y + 112 >> 3] = s;
      h[y + 120 >> 3] = 0.0;
      s = w - e;
      t = v - f;
      t = t * t;
      s = +C(+(s * s + t));
      u = x - e;
      t = +C(+(u * u + t));
      if (!g) g = 0;
      else {
        u = +(a | 0);
        n = g + 1536 | 0;
        m = 0;
        i = 0;
        d = s > 0.0 ? s : 0.0;
        q = t > 0.0 ? t : 0.0;
        while (1) {
          if ((m | 0) == 8) break;
          k = y + (m << 4) | 0;
          p = e - +h[k >> 3];
          r = f - +h[k + 8 >> 3];
          r = +C(+(p * p + r * r));
          k = H + (m << 3) | 0;
          h[k >> 3] = r;
          j = y + (i << 4) | 0;
          p = +h[j >> 3];
          b = w - p;
          o = v - +h[j + 8 >> 3];
          p = x - p;
          o = o * o;
          b = +C(+(b * b + o));
          o = +C(+(p * p + o));
          j = G + (i << 3) | 0;
          h[j >> 3] = o;
          p = +h[H + (i << 3) >> 3];
          b = p + b - s;
          h[B + (i << 3) >> 3] = b;
          if (i >>> 0 < 4) {
            d = b > d ? b : d;
            b = p + o - t;
            h[j >> 3] = b;
            if (b > d) {
              d = b;
              b = q
            } else b = q
          } else {
            b = b > q ? b : q;
            o = p + o - t;
            h[j >> 3] = o;
            if (o > b) b = o
          }
          o = r * 2.0;
          h[k >> 3] = o;
          if ((m | 0) < 4) {
            if (o > d) d = o
          } else if (o > b) b = o;
          i = 0;
          while (1) {
            if ((i | 0) == 6) break;
            q = +h[z + (i << 3) >> 3] * 6.283185307179586 / u;
            r = +F(+q);
            J = +E(+q);
            r = r * +Dc(q * .6931471805599453 / r);
            q = +D(10.0, +((+h[8 + (m * 48 | 0) + (i << 3) >> 3] + +h[A + (i << 3) >> 3] * o) / 40.0));
            p = r * q;
            q = r / q;
            r = q + 1.0;
            k = n + (m * 120 | 0) + (i * 20 | 0) | 0;
            c[k >> 2] = ~~((p + 1.0) / r * 1024.0);
            j = ~~(J * -2.0 / r * 1024.0);
            c[k + 4 >> 2] = j;
            c[k + 8 >> 2] = ~~((1.0 - p) / r * 1024.0);
            c[k + 12 >> 2] = j;
            c[k + 16 >> 2] = ~~((1.0 - q) / r * 1024.0);
            i = i + 1 | 0
          }
          m = m + 1 | 0;
          i = 6;
          q = b
        }
        b = +(a | 0);
        j = ~~(d / 340.29 * b);
        c[g + 2504 >> 2] = j;
        c[g + 2496 >> 2] = La((j << 2) + 4 | 0) | 0;
        c[g + 2512 >> 2] = 0;
        j = ~~(q / 340.29 * b);
        c[g + 2508 >> 2] = j;
        c[g + 2500 >> 2] = La((j << 2) + 4 | 0) | 0;
        c[g + 2516 >> 2] = 0;
        j = g + 2520 | 0;
        k = g + 2552 | 0;
        m = g + 2584 | 0;
        n = g + 2600 | 0;
        i = 0;
        while (1) {
          if ((i | 0) == 4) break;
          c[j + (i << 2) >> 2] = ~~(+h[B + (i << 3) >> 3] / 340.29 * b);
          A = i + 4 | 0;
          c[j + (A << 2) >> 2] = ~~(+h[B + (A << 3) >> 3] / 340.29 * b);
          c[k + (i << 2) >> 2] = ~~(+h[G + (i << 3) >> 3] / 340.29 * b);
          c[k + (A << 2) >> 2] = ~~(+h[G + (A << 3) >> 3] / 340.29 * b);
          c[m + (i << 2) >> 2] = ~~(+h[H + (i << 3) >> 3] / 340.29 * b);
          c[n + (i << 2) >> 2] = ~~(+h[H + (A << 3) >> 3] / 340.29 * b);
          i = i + 1 | 0
        }
        c[g + 2616 >> 2] = 4;
        Vb(g)
      }
      l = I;
      return g | 0
    }

    function bb(b, e, f) {
      b = b | 0;
      e = e | 0;
      f = f | 0;
      var g = 0.0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0;
      j = 0;
      switch (e | 0) {
        case 0:
          {
            l = -149;m = 24;j = 4;
            break
          }
        case 1:
          {
            l = -1074;m = 53;j = 4;
            break
          }
        case 2:
          {
            l = -1074;m = 53;j = 4;
            break
          }
        default:
          g = 0.0
      }
      a: do
        if ((j | 0) == 4) {
          o = b + 4 | 0;
          n = b + 100 | 0;
          do {
            e = c[o >> 2] | 0;
            if (e >>> 0 < (c[n >> 2] | 0) >>> 0) {
              c[o >> 2] = e + 1;
              e = d[e >> 0] | 0
            } else e = Ub(b) | 0
          } while ((df(e) | 0) != 0);
          b: do switch (e | 0) {
              case 43:
              case 45:
                {
                  i = 1 - (((e | 0) == 45 & 1) << 1) | 0;e = c[o >> 2] | 0;
                  if (e >>> 0 < (c[n >> 2] | 0) >>> 0) {
                    c[o >> 2] = e + 1;
                    h = d[e >> 0] | 0;
                    break b
                  } else {
                    h = Ub(b) | 0;
                    break b
                  }
                }
              default:
                {
                  h = e;i = 1
                }
            }
            while (0);
            e = 0;
          do {
            if ((h | 32 | 0) != (a[12079 + e >> 0] | 0)) break;
            do
              if (e >>> 0 < 7) {
                h = c[o >> 2] | 0;
                if (h >>> 0 < (c[n >> 2] | 0) >>> 0) {
                  c[o >> 2] = h + 1;
                  h = d[h >> 0] | 0;
                  break
                } else {
                  h = Ub(b) | 0;
                  break
                }
              }
            while (0);
            e = e + 1 | 0
          } while (e >>> 0 < 8);
          c: do switch (e | 0) {
              case 8:
                break;
              case 3:
                {
                  j = 23;
                  break
                }
              default:
                {
                  k = (f | 0) != 0;
                  if (k & e >>> 0 > 3)
                    if ((e | 0) == 8) break c;
                    else {
                      j = 23;
                      break c
                    }
                  d: do
                    if (!e) {
                      e = 0;
                      do {
                        if ((h | 32 | 0) != (a[12596 + e >> 0] | 0)) break d;
                        do
                          if (e >>> 0 < 2) {
                            h = c[o >> 2] | 0;
                            if (h >>> 0 < (c[n >> 2] | 0) >>> 0) {
                              c[o >> 2] = h + 1;
                              h = d[h >> 0] | 0;
                              break
                            } else {
                              h = Ub(b) | 0;
                              break
                            }
                          }
                        while (0);
                        e = e + 1 | 0
                      } while (e >>> 0 < 3)
                    }while (0);
                  switch (e | 0) {
                    case 3:
                      {
                        e = c[o >> 2] | 0;
                        if (e >>> 0 < (c[n >> 2] | 0) >>> 0) {
                          c[o >> 2] = e + 1;
                          e = d[e >> 0] | 0
                        } else e = Ub(b) | 0;
                        if ((e | 0) == 40) e = 1;
                        else {
                          if (!(c[n >> 2] | 0)) {
                            g = s;
                            break a
                          }
                          c[o >> 2] = (c[o >> 2] | 0) + -1;
                          g = s;
                          break a
                        }
                        while (1) {
                          h = c[o >> 2] | 0;
                          if (h >>> 0 < (c[n >> 2] | 0) >>> 0) {
                            c[o >> 2] = h + 1;
                            h = d[h >> 0] | 0
                          } else h = Ub(b) | 0;
                          if (!((h + -48 | 0) >>> 0 < 10 | (h + -65 | 0) >>> 0 < 26))
                            if (!((h | 0) == 95 | (h + -97 | 0) >>> 0 < 26)) break;
                          e = e + 1 | 0
                        }
                        if ((h | 0) == 41) {
                          g = s;
                          break a
                        }
                        h = (c[n >> 2] | 0) == 0;
                        if (!h) c[o >> 2] = (c[o >> 2] | 0) + -1;
                        if (!k) {
                          c[($f() | 0) >> 2] = 22;
                          Od(b, 0);
                          g = 0.0;
                          break a
                        }
                        if (!e) {
                          g = s;
                          break a
                        }
                        while (1) {
                          e = e + -1 | 0;
                          if (!h) c[o >> 2] = (c[o >> 2] | 0) + -1;
                          if (!e) {
                            g = s;
                            break a
                          }
                        }
                      }
                    case 0:
                      {
                        if ((h | 0) == 48) {
                          e = c[o >> 2] | 0;
                          if (e >>> 0 < (c[n >> 2] | 0) >>> 0) {
                            c[o >> 2] = e + 1;
                            e = d[e >> 0] | 0
                          } else e = Ub(b) | 0;
                          if ((e | 32 | 0) == 120) {
                            g = +Za(b, m, l, i, f);
                            break a
                          }
                          if (!(c[n >> 2] | 0)) e = 48;
                          else {
                            c[o >> 2] = (c[o >> 2] | 0) + -1;
                            e = 48
                          }
                        } else e = h;g = +Qa(b, e, m, l, i, f);
                        break a
                      }
                    default:
                      {
                        if (c[n >> 2] | 0) c[o >> 2] = (c[o >> 2] | 0) + -1;c[($f() | 0) >> 2] = 22;Od(b, 0);g = 0.0;
                        break a
                      }
                  }
                }
            }
            while (0);
            if ((j | 0) == 23) {
              h = (c[n >> 2] | 0) == 0;
              if (!h) c[o >> 2] = (c[o >> 2] | 0) + -1;
              if ((f | 0) != 0 & e >>> 0 > 3)
                do {
                  if (!h) c[o >> 2] = (c[o >> 2] | 0) + -1;
                  e = e + -1 | 0
                } while (e >>> 0 > 3)
            }
          g = +(i | 0) * t
        }
      while (0);
      return +g
    }

    function cb(a, b, d) {
      a = a | 0;
      b = b | 0;
      d = d | 0;
      var e = 0,
        f = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 0,
        t = 0,
        u = 0,
        v = 0,
        w = 0,
        x = 0,
        y = 0,
        z = 0,
        A = 0,
        B = 0,
        C = 0,
        D = 0,
        E = 0,
        F = 0;
      l = a + 2496 | 0;
      m = a + 2504 | 0;
      n = a + 2500 | 0;
      o = a + 2508 | 0;
      p = a + 2512 | 0;
      q = a + 2516 | 0;
      k = 0;
      while (1) {
        if ((k | 0) >= (d | 0)) break;
        j = b + (k << 2) | 0;
        f = (c[j >> 2] | 0) / 64 | 0;
        i = b + ((k | 1) << 2) | 0;
        g = (c[i >> 2] | 0) / 64 | 0;
        e = 0;
        while (1) {
          h = c[l >> 2] | 0;
          if ((e | 0) == 4) break;
          r = a + 2520 + (e << 2) | 0;
          h = h + (c[r >> 2] << 2) | 0;
          c[h >> 2] = (c[h >> 2] | 0) + f;
          c[r >> 2] = ((c[r >> 2] | 0) + 1 | 0) % (c[m >> 2] | 0) | 0;
          h = a + 2552 + (e << 2) | 0;
          r = (c[l >> 2] | 0) + (c[h >> 2] << 2) | 0;
          c[r >> 2] = (c[r >> 2] | 0) + g;
          c[h >> 2] = ((c[h >> 2] | 0) + 1 | 0) % (c[m >> 2] | 0) | 0;
          h = e + 4 | 0;
          r = a + 2520 + (h << 2) | 0;
          s = (c[n >> 2] | 0) + (c[r >> 2] << 2) | 0;
          c[s >> 2] = (c[s >> 2] | 0) + f;
          c[r >> 2] = ((c[r >> 2] | 0) + 1 | 0) % (c[o >> 2] | 0) | 0;
          h = a + 2552 + (h << 2) | 0;
          r = (c[n >> 2] | 0) + (c[h >> 2] << 2) | 0;
          c[r >> 2] = (c[r >> 2] | 0) + g;
          c[h >> 2] = ((c[h >> 2] | 0) + 1 | 0) % (c[o >> 2] | 0) | 0;
          e = e + 1 | 0
        }
        e = h + (c[p >> 2] << 2) | 0;
        g = c[e >> 2] | 0;
        c[e >> 2] = 0;
        c[p >> 2] = ((c[p >> 2] | 0) + 1 | 0) % (c[m >> 2] | 0) | 0;
        e = (c[n >> 2] | 0) + (c[q >> 2] << 2) | 0;
        h = c[e >> 2] | 0;
        c[e >> 2] = 0;
        c[q >> 2] = ((c[q >> 2] | 0) + 1 | 0) % (c[o >> 2] | 0) | 0;
        e = 0;
        while (1) {
          if ((e | 0) == 8) break;
          else f = 0;
          while (1) {
            if ((f | 0) == 6) break;
            y = a + 1536 + (e * 120 | 0) + (f * 20 | 0) | 0;
            A = y | 0;
            E = O(c[A >> 2] | 0, g) | 0;
            u = a + (e * 48 | 0) + (f << 3) | 0;
            r = u | 0;
            C = c[r >> 2] | 0;
            B = y + 4 | 0;
            F = O(c[B >> 2] | 0, C) | 0;
            u = u + 4 | 0;
            z = y + 8 | 0;
            D = O(c[z >> 2] | 0, c[u >> 2] | 0) | 0;
            x = a + 384 + (e * 48 | 0) + (f << 3) | 0;
            v = x | 0;
            t = c[v >> 2] | 0;
            s = y + 12 | 0;
            w = O(c[s >> 2] | 0, t) | 0;
            x = x + 4 | 0;
            y = y + 16 | 0;
            w = F + E + D - ((O(c[y >> 2] | 0, c[x >> 2] | 0) | 0) + w) | 0;
            c[u >> 2] = C;
            c[r >> 2] = g;
            c[x >> 2] = t;
            c[v >> 2] = (w | 0) / 1024 | 0;
            c[j >> 2] = (c[j >> 2] | 0) + ((w | 0) / 8192 | 0);
            A = O(c[A >> 2] | 0, h) | 0;
            w = a + 768 + (e * 48 | 0) + (f << 3) | 0;
            v = w | 0;
            x = c[v >> 2] | 0;
            B = O(c[B >> 2] | 0, x) | 0;
            w = w + 4 | 0;
            z = O(c[z >> 2] | 0, c[w >> 2] | 0) | 0;
            t = a + 1152 + (e * 48 | 0) + (f << 3) | 0;
            r = t | 0;
            u = c[r >> 2] | 0;
            s = O(c[s >> 2] | 0, u) | 0;
            t = t + 4 | 0;
            s = B + A + z - ((O(c[y >> 2] | 0, c[t >> 2] | 0) | 0) + s) | 0;
            c[w >> 2] = x;
            c[v >> 2] = h;
            c[t >> 2] = u;
            c[r >> 2] = (s | 0) / 1024 | 0;
            c[i >> 2] = (c[i >> 2] | 0) + ((s | 0) / 8192 | 0);
            f = f + 1 | 0
          }
          e = e + 1 | 0
        }
        g = (c[i >> 2] | 0) / 64 | 0;
        f = (c[j >> 2] | 0) / 64 | 0;
        e = 0;
        while (1) {
          if ((e | 0) == 4) break;
          F = a + 2584 + (e << 2) | 0;
          E = (c[l >> 2] | 0) + (c[F >> 2] << 2) | 0;
          c[E >> 2] = (c[E >> 2] | 0) + g;
          c[F >> 2] = ((c[F >> 2] | 0) + 1 | 0) % (c[m >> 2] | 0) | 0;
          F = a + 2600 + (e << 2) | 0;
          E = (c[n >> 2] | 0) + (c[F >> 2] << 2) | 0;
          c[E >> 2] = (c[E >> 2] | 0) + f;
          c[F >> 2] = ((c[F >> 2] | 0) + 1 | 0) % (c[o >> 2] | 0) | 0;
          e = e + 1 | 0
        }
        k = k + 2 | 0
      }
      return
    }

    function db(a, b, d, e, f) {
      a = a | 0;
      b = b | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      var g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0;
      l = a;
      j = b;
      k = j;
      h = d;
      n = e;
      i = n;
      if (!k) {
        g = (f | 0) != 0;
        if (!i) {
          if (g) {
            c[f >> 2] = (l >>> 0) % (h >>> 0);
            c[f + 4 >> 2] = 0
          }
          n = 0;
          f = (l >>> 0) / (h >>> 0) >>> 0;
          return (z = n, f) | 0
        } else {
          if (!g) {
            n = 0;
            f = 0;
            return (z = n, f) | 0
          }
          c[f >> 2] = a | 0;
          c[f + 4 >> 2] = b & 0;
          n = 0;
          f = 0;
          return (z = n, f) | 0
        }
      }
      g = (i | 0) == 0;
      do
        if (!h) {
          if (g) {
            if (f | 0) {
              c[f >> 2] = (k >>> 0) % (h >>> 0);
              c[f + 4 >> 2] = 0
            }
            n = 0;
            f = (k >>> 0) / (h >>> 0) >>> 0;
            return (z = n, f) | 0
          }
          if (!l) {
            if (f | 0) {
              c[f >> 2] = 0;
              c[f + 4 >> 2] = (k >>> 0) % (i >>> 0)
            }
            n = 0;
            f = (k >>> 0) / (i >>> 0) >>> 0;
            return (z = n, f) | 0
          }
          g = i - 1 | 0;
          if (!(g & i)) {
            if (f | 0) {
              c[f >> 2] = a | 0;
              c[f + 4 >> 2] = g & k | b & 0
            }
            n = 0;
            f = k >>> ((Cd(i | 0) | 0) >>> 0);
            return (z = n, f) | 0
          }
          g = (R(i | 0) | 0) - (R(k | 0) | 0) | 0;
          if (g >>> 0 <= 30) {
            b = g + 1 | 0;
            i = 31 - g | 0;
            h = b;
            a = k << i | l >>> (b >>> 0);
            b = k >>> (b >>> 0);
            g = 0;
            i = l << i;
            break
          }
          if (!f) {
            n = 0;
            f = 0;
            return (z = n, f) | 0
          }
          c[f >> 2] = a | 0;
          c[f + 4 >> 2] = j | b & 0;
          n = 0;
          f = 0;
          return (z = n, f) | 0
        } else {
          if (!g) {
            g = (R(i | 0) | 0) - (R(k | 0) | 0) | 0;
            if (g >>> 0 <= 31) {
              m = g + 1 | 0;
              i = 31 - g | 0;
              b = g - 31 >> 31;
              h = m;
              a = l >>> (m >>> 0) & b | k << i;
              b = k >>> (m >>> 0) & b;
              g = 0;
              i = l << i;
              break
            }
            if (!f) {
              n = 0;
              f = 0;
              return (z = n, f) | 0
            }
            c[f >> 2] = a | 0;
            c[f + 4 >> 2] = j | b & 0;
            n = 0;
            f = 0;
            return (z = n, f) | 0
          }
          g = h - 1 | 0;
          if (g & h | 0) {
            i = (R(h | 0) | 0) + 33 - (R(k | 0) | 0) | 0;
            p = 64 - i | 0;
            m = 32 - i | 0;
            j = m >> 31;
            o = i - 32 | 0;
            b = o >> 31;
            h = i;
            a = m - 1 >> 31 & k >>> (o >>> 0) | (k << m | l >>> (i >>> 0)) & b;
            b = b & k >>> (i >>> 0);
            g = l << p & j;
            i = (k << p | l >>> (o >>> 0)) & j | l << m & i - 33 >> 31;
            break
          }
          if (f | 0) {
            c[f >> 2] = g & l;
            c[f + 4 >> 2] = 0
          }
          if ((h | 0) == 1) {
            o = j | b & 0;
            p = a | 0 | 0;
            return (z = o, p) | 0
          } else {
            p = Cd(h | 0) | 0;
            o = k >>> (p >>> 0) | 0;
            p = k << 32 - p | l >>> (p >>> 0) | 0;
            return (z = o, p) | 0
          }
        }
      while (0);
      if (!h) {
        k = i;
        j = 0;
        i = 0
      } else {
        m = d | 0 | 0;
        l = n | e & 0;
        k = te(m | 0, l | 0, -1, -1) | 0;
        d = z;
        j = i;
        i = 0;
        do {
          q = j;
          j = g >>> 31 | j << 1;
          g = i | g << 1;
          q = a << 1 | q >>> 31 | 0;
          e = a >>> 31 | b << 1 | 0;
          ne(k | 0, d | 0, q | 0, e | 0) | 0;
          o = z;
          p = ((o | 0) < 0 ? -1 : 0) << 1 | 0;
          n = o >> 31 | p;
          i = n & 1;
          a = ne(q | 0, e | 0, n & m | 0, (((o | 0) < 0 ? -1 : 0) >> 31 | p) & l | 0) | 0;
          b = z;
          h = h - 1 | 0
        } while ((h | 0) != 0);
        k = j;
        j = 0
      }
      h = 0;
      if (f | 0) {
        c[f >> 2] = a;
        c[f + 4 >> 2] = b
      }
      p = (g | 0) >>> 31 | (k | h) << 1 | (h << 1 | g >>> 31) & 0 | j;
      q = (g << 1 | 0 >>> 31) & -2 | i;
      return (z = p, q) | 0
    }

    function eb(a, b) {
      a = a | 0;
      b = b | 0;
      var d = 0,
        e = 0,
        f = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0;
      l = a + 4 | 0;
      m = c[l >> 2] | 0;
      d = m & -8;
      i = a + d | 0;
      if (!(m & 3)) {
        if (b >>> 0 < 256) {
          a = 0;
          return a | 0
        }
        if (d >>> 0 >= (b + 4 | 0) >>> 0)
          if ((d - b | 0) >>> 0 <= c[10621] << 1 >>> 0) return a | 0;
        a = 0;
        return a | 0
      }
      if (d >>> 0 >= b >>> 0) {
        d = d - b | 0;
        if (d >>> 0 <= 15) return a | 0;
        k = a + b | 0;
        c[l >> 2] = m & 1 | b | 2;
        c[k + 4 >> 2] = d | 3;
        m = i + 4 | 0;
        c[m >> 2] = c[m >> 2] | 1;
        Ya(k, d);
        return a | 0
      }
      if ((c[10507] | 0) == (i | 0)) {
        k = (c[10504] | 0) + d | 0;
        d = k - b | 0;
        e = a + b | 0;
        if (k >>> 0 <= b >>> 0) {
          a = 0;
          return a | 0
        }
        c[l >> 2] = m & 1 | b | 2;
        c[e + 4 >> 2] = d | 1;
        c[10507] = e;
        c[10504] = d;
        return a | 0
      }
      if ((c[10506] | 0) == (i | 0)) {
        e = (c[10503] | 0) + d | 0;
        if (e >>> 0 < b >>> 0) {
          a = 0;
          return a | 0
        }
        d = e - b | 0;
        if (d >>> 0 > 15) {
          k = a + b | 0;
          e = a + e | 0;
          c[l >> 2] = m & 1 | b | 2;
          c[k + 4 >> 2] = d | 1;
          c[e >> 2] = d;
          e = e + 4 | 0;
          c[e >> 2] = c[e >> 2] & -2;
          e = k
        } else {
          c[l >> 2] = m & 1 | e | 2;
          e = a + e + 4 | 0;
          c[e >> 2] = c[e >> 2] | 1;
          e = 0;
          d = 0
        }
        c[10503] = d;
        c[10506] = e;
        return a | 0
      }
      e = c[i + 4 >> 2] | 0;
      if (e & 2 | 0) {
        a = 0;
        return a | 0
      }
      j = (e & -8) + d | 0;
      if (j >>> 0 < b >>> 0) {
        a = 0;
        return a | 0
      }
      k = j - b | 0;
      f = e >>> 3;
      do
        if (e >>> 0 < 256) {
          e = c[i + 8 >> 2] | 0;
          d = c[i + 12 >> 2] | 0;
          if ((d | 0) == (e | 0)) {
            c[10501] = c[10501] & ~(1 << f);
            break
          } else {
            c[e + 12 >> 2] = d;
            c[d + 8 >> 2] = e;
            break
          }
        } else {
          h = c[i + 24 >> 2] | 0;
          d = c[i + 12 >> 2] | 0;
          do
            if ((d | 0) == (i | 0)) {
              f = i + 16 | 0;
              e = f + 4 | 0;
              d = c[e >> 2] | 0;
              if (!d) {
                d = c[f >> 2] | 0;
                if (!d) {
                  f = 0;
                  break
                } else g = f
              } else g = e;
              while (1) {
                f = d + 20 | 0;
                e = c[f >> 2] | 0;
                if (e | 0) {
                  d = e;
                  g = f;
                  continue
                }
                e = d + 16 | 0;
                f = c[e >> 2] | 0;
                if (!f) break;
                else {
                  d = f;
                  g = e
                }
              }
              c[g >> 2] = 0;
              f = d
            } else {
              f = c[i + 8 >> 2] | 0;
              c[f + 12 >> 2] = d;
              c[d + 8 >> 2] = f;
              f = d
            }
          while (0);
          if (h | 0) {
            d = c[i + 28 >> 2] | 0;
            e = 42308 + (d << 2) | 0;
            if ((c[e >> 2] | 0) == (i | 0)) {
              c[e >> 2] = f;
              if (!f) {
                c[10502] = c[10502] & ~(1 << d);
                break
              }
            } else {
              c[h + 16 + (((c[h + 16 >> 2] | 0) != (i | 0) & 1) << 2) >> 2] = f;
              if (!f) break
            }
            c[f + 24 >> 2] = h;
            d = i + 16 | 0;
            e = c[d >> 2] | 0;
            if (e | 0) {
              c[f + 16 >> 2] = e;
              c[e + 24 >> 2] = f
            }
            d = c[d + 4 >> 2] | 0;
            if (d | 0) {
              c[f + 20 >> 2] = d;
              c[d + 24 >> 2] = f
            }
          }
        }
      while (0);
      if (k >>> 0 < 16) {
        c[l >> 2] = j | m & 1 | 2;
        m = a + j + 4 | 0;
        c[m >> 2] = c[m >> 2] | 1;
        return a | 0
      } else {
        i = a + b | 0;
        c[l >> 2] = m & 1 | b | 2;
        c[i + 4 >> 2] = k | 3;
        m = a + j + 4 | 0;
        c[m >> 2] = c[m >> 2] | 1;
        Ya(i, k);
        return a | 0
      }
      return 0
    }

    function fb(f) {
      f = f | 0;
      var h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0.0,
        n = 0,
        o = 0,
        p = 0,
        q = 0.0,
        r = 0.0,
        s = 0,
        t = 0,
        u = 0,
        v = 0;
      t = 0;
      a[f + 2 >> 0] = 1;
      s = $a(c[f + 4 >> 2] | 0, c[10360] | 0) | 0;
      if (!s) h = -1;
      else {
        if (c[10361] | 0) {
          p = 0;
          j = 0;
          l = s;
          do {
            n = (c[l >> 2] | 0) >>> 10;
            o = l + 96 | 0;
            h = 0;
            i = 0;
            k = 0;
            while (1) {
              if ((k | 0) == (n | 0)) break;
              u = b[(c[o >> 2] | 0) + (k << 1) >> 1] | 0;
              v = u << 16 >> 16 | 0;
              h = (v | 0) < h << 16 >> 16 ? u : h;
              i = (v | 0) > i << 16 >> 16 ? u : i;
              k = k + 1 | 0
            }
            j = i << 16 >> 16 > j << 16 >> 16 ? i : j;
            p = h << 16 >> 16 < p << 16 >> 16 ? h : p;
            l = c[l + 100 >> 2] | 0
          } while ((l | 0) != 0);
          k = j << 16 >> 16;
          h = 0 - (p << 16 >> 16) | 0;
          i = (k | 0) >= (h | 0);
          do
            if (!(c[10362] | 0))
              if (i) {
                h = 33553408 / (k | 0) | 0;
                break
              } else {
                h = 33554432 / (h | 0) | 0;
                break
              }
          else {
            j = b[f + 8 >> 1] | 0;
            if (i) {
              h = (O(33553408 / (k | 0) | 0, j) | 0) >> 10;
              break
            } else {
              h = (O(33554432 / (h | 0) | 0, j) | 0) >> 10;
              break
            }
          } while (0);
          b[f + 8 >> 1] = h
        }
        c[f + 92 >> 2] = s;
        j = b[f >> 1] | 0;
        if (j & 128) {
          i = a[f + 10 >> 0] | 0;
          if (!(i & 4)) {
            h = s;
            do {
              v = h + 32 | 0;
              a[v >> 0] = a[v >> 0] & -5;
              h = c[h + 100 >> 2] | 0
            } while ((h | 0) != 0)
          }
          if (!(i & 64)) {
            h = s;
            do {
              v = h + 32 | 0;
              a[v >> 0] = a[v >> 0] & -65;
              h = c[h + 100 >> 2] | 0
            } while ((h | 0) != 0)
          }
        }
        if (j << 16 >> 16 == 47) {
          i = s;
          do {
            a: do
              if (!(a[i + 32 >> 0] & 4)) {
                j = i + 72 | 0;
                k = i + 44 | 0;
                h = 3;
                while (1) {
                  if ((h | 0) == 6) break a;
                  c[i + 64 + (h << 2) >> 2] = c[j >> 2];
                  c[i + 36 + (h << 2) >> 2] = c[k >> 2];
                  h = h + 1 | 0
                }
              }while (0);i = c[i + 100 >> 2] | 0
          } while ((i | 0) != 0)
        }
        o = a[f + 11 >> 0] | 0;
        l = (o & 32) == 0;
        n = (a[f + 10 >> 0] & 64) == 0;
        q = +(e[21285] | 0);
        r = q * 1.4560000272467732e-03;
        o = o << 24 >> 24 < 0;
        k = s;
        do {
          if (!l) {
            h = k + 32 | 0;
            i = d[h >> 0] | 0;
            if (i & 32 | 0) a[h >> 0] = i ^ 32
          }
          if (o) {
            h = k + 32 | 0;
            i = d[h >> 0] | 0;
            if (i & 128 | 0) a[h >> 0] = i ^ 128
          }
          j = k + 32 | 0;
          if (n) i = 0;
          else {
            a[j >> 0] = a[j >> 0] | 64;
            i = 0
          }
          while (1) {
            if ((i | 0) == 6) break;
            if (!(a[j >> 0] & 64)) {
              c[k + 64 + (i << 2) >> 2] = 4194303;
              m = r;
              t = 42
            } else {
              h = a[f + 12 + (i * 12 | 0) + 8 >> 0] | 0;
              if (h & 2) c[k + 64 + (i << 2) >> 2] = ~~(+g[f + 12 + (i * 12 | 0) + 4 >> 2] * 255.0) * 16448;
              if (h & 1) {
                m = +g[f + 12 + (i * 12 | 0) >> 2] / 1.0e3 * q;
                t = 42
              }
            }
            if ((t | 0) == 42) {
              t = 0;
              c[k + 36 + (i << 2) >> 2] = ~~(4194303.0 / m)
            }
            i = i + 1 | 0
          }
          k = c[k + 100 >> 2] | 0
        } while ((k | 0) != 0);
        h = 0
      }
      return h | 0
    }

    function gb(a, b) {
      a = +a;
      b = +b;
      var d = 0,
        e = 0,
        f = 0,
        g = 0,
        i = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0;
      q = 0;
      h[j >> 3] = a;
      i = c[j >> 2] | 0;
      l = c[j + 4 >> 2] | 0;
      h[j >> 3] = b;
      n = c[j >> 2] | 0;
      o = c[j + 4 >> 2] | 0;
      e = me(i | 0, l | 0, 52) | 0;
      e = e & 2047;
      m = me(n | 0, o | 0, 52) | 0;
      m = m & 2047;
      p = l & -2147483648;
      g = je(n | 0, o | 0, 1) | 0;
      k = z;
      a: do
        if ((g | 0) == 0 & (k | 0) == 0) q = 3;
        else {
          f = pe(b) | 0;
          d = z & 2147483647;
          if ((e | 0) == 2047 | (d >>> 0 > 2146435072 | (d | 0) == 2146435072 & f >>> 0 > 0)) q = 3;
          else {
            d = je(i | 0, l | 0, 1) | 0;
            f = z;
            if (!(f >>> 0 > k >>> 0 | (f | 0) == (k | 0) & d >>> 0 > g >>> 0)) return +((d | 0) == (g | 0) & (f | 0) == (k | 0) ? a * 0.0 : a);
            if (!e) {
              d = je(i | 0, l | 0, 12) | 0;
              f = z;
              if ((f | 0) > -1 | (f | 0) == -1 & d >>> 0 > 4294967295) {
                e = 0;
                do {
                  e = e + -1 | 0;
                  d = je(d | 0, f | 0, 1) | 0;
                  f = z
                } while ((f | 0) > -1 | (f | 0) == -1 & d >>> 0 > 4294967295)
              } else e = 0;
              i = je(i | 0, l | 0, 1 - e | 0) | 0;
              g = z
            } else g = l & 1048575 | 1048576;
            if (!m) {
              f = je(n | 0, o | 0, 12) | 0;
              k = z;
              if ((k | 0) > -1 | (k | 0) == -1 & f >>> 0 > 4294967295) {
                d = 0;
                do {
                  d = d + -1 | 0;
                  f = je(f | 0, k | 0, 1) | 0;
                  k = z
                } while ((k | 0) > -1 | (k | 0) == -1 & f >>> 0 > 4294967295)
              } else d = 0;
              n = je(n | 0, o | 0, 1 - d | 0) | 0;
              m = d;
              l = z
            } else l = o & 1048575 | 1048576;
            f = ne(i | 0, g | 0, n | 0, l | 0) | 0;
            d = z;
            k = (d | 0) > -1 | (d | 0) == -1 & f >>> 0 > 4294967295;
            b: do
              if ((e | 0) > (m | 0)) {
                while (1) {
                  if (k) {
                    if ((f | 0) == 0 & (d | 0) == 0) break
                  } else {
                    f = i;
                    d = g
                  }
                  i = je(f | 0, d | 0, 1) | 0;
                  g = z;
                  e = e + -1 | 0;
                  f = ne(i | 0, g | 0, n | 0, l | 0) | 0;
                  d = z;
                  k = (d | 0) > -1 | (d | 0) == -1 & f >>> 0 > 4294967295;
                  if ((e | 0) <= (m | 0)) break b
                }
                b = a * 0.0;
                break a
              }
            while (0);
            if (k) {
              if ((f | 0) == 0 & (d | 0) == 0) {
                b = a * 0.0;
                break
              }
            } else {
              d = g;
              f = i
            }
            if (d >>> 0 < 1048576 | (d | 0) == 1048576 & f >>> 0 < 0)
              do {
                f = je(f | 0, d | 0, 1) | 0;
                d = z;
                e = e + -1 | 0
              } while (d >>> 0 < 1048576 | (d | 0) == 1048576 & f >>> 0 < 0);
            if ((e | 0) > 0) {
              o = te(f | 0, d | 0, 0, -1048576) | 0;
              d = z;
              e = je(e | 0, 0, 52) | 0;
              d = d | z;
              e = o | e
            } else {
              e = me(f | 0, d | 0, 1 - e | 0) | 0;
              d = z
            }
            c[j >> 2] = e;
            c[j + 4 >> 2] = d | p;
            b = +h[j >> 3]
          }
        }
      while (0);
      if ((q | 0) == 3) {
        b = a * b;
        b = b / b
      }
      return +b
    }

    function hb(e, f) {
      e = e | 0;
      f = f | 0;
      var g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0;
      n = a[f >> 0] | 0;
      m = c[f + 4 >> 2] | 0;
      j = m >>> 8;
      o = m & 255;
      a: do
        if (!(m & 255)) lc(e, f);
        else {
          m = n & 255;
          do
            if (!(a[e + 52 + (m << 5) + 31 >> 0] | 0)) {
              f = c[e + 52 + (m << 5) + 4 >> 2] | 0;
              if (!f) break a;
              g = j & 255;
              h = 1572 + (((g >>> 0) % 12 | 0) * 100 << 2) | 0;
              g = (g >>> 0) / 12 | 0
            } else {
              g = j & 255;
              f = Cc(e, (g | d[e + 52 + (m << 5) >> 0] << 8 | 128) & 65535) | 0;
              if (!f) break a;
              i = a[f + 84 >> 0] | 0;
              if (!(i << 24 >> 24)) {
                h = 1572 + (((g >>> 0) % 12 | 0) * 100 << 2) | 0;
                g = (g >>> 0) / 12 | 0;
                break
              } else {
                h = 1572 + ((((i & 255) % 12 | 0) & 255) * 100 << 2) | 0;
                g = ((i & 255) / 12 | 0) & 255;
                break
              }
            }
          while (0);
          l = ec(f, ((c[h >> 2] | 0) >>> (10 - g | 0) >>> 0) / 100 | 0) | 0;
          if (l | 0) {
            k = j & 255;
            j = e + 568 + (m * 7168 | 0) + (k * 56 | 0) | 0;
            g = j | 0;
            j = j + 34 | 0;
            do
              if (!(a[j >> 0] | 0)) {
                if (!(a[e + 115256 + (m * 7168 | 0) + (k * 56 | 0) + 34 >> 0] | 0)) {
                  h = e + 564 | 0;
                  i = c[h >> 2] | 0;
                  if (i)
                    do {
                      h = i + 40 | 0;
                      i = c[h >> 2] | 0
                    } while ((i | 0) != 0);
                  c[h >> 2] = g;
                  a[j >> 0] = 1;
                  c[e + 568 + (m * 7168 | 0) + (k * 56 | 0) + 40 >> 2] = 0;
                  break
                }
                if (a[e + 568 + (m * 7168 | 0) + (k * 56 | 0) + 32 >> 0] & 64)
                  if ((d[e + 568 + (m * 7168 | 0) + (k * 56 | 0) + 24 >> 0] | 0) < 3)
                    if (!(a[e + 568 + (m * 7168 | 0) + (k * 56 | 0) + 33 >> 0] & 2)) break a;
                j = e + 115256 + (m * 7168 | 0) + (k * 56 | 0) | 0;
                c[j + 36 >> 2] = g;
                a[j + 24 >> 0] = 6;
                c[j + 20 >> 2] = 0 - (c[(c[j + 8 >> 2] | 0) + 60 >> 2] | 0)
              } else {
                g = e + 568 + (m * 7168 | 0) + (k * 56 | 0) + 24 | 0;
                if (a[e + 568 + (m * 7168 | 0) + (k * 56 | 0) + 32 >> 0] & 64)
                  if ((d[g >> 0] | 0) < 3)
                    if (!(a[e + 568 + (m * 7168 | 0) + (k * 56 | 0) + 33 >> 0] & 2)) break a;
                j = e + 115256 + (m * 7168 | 0) + (k * 56 | 0) | 0;
                i = e + 568 + (m * 7168 | 0) + (k * 56 | 0) | 0;
                c[i + 36 >> 2] = j;
                a[g >> 0] = 6;
                c[i + 20 >> 2] = 0 - (c[(c[i + 8 >> 2] | 0) + 60 >> 2] | 0);
                g = j
              }
            while (0);
            b[g >> 1] = k | m << 8;
            c[g + 4 >> 2] = f;
            c[g + 8 >> 2] = l;
            c[g + 12 >> 2] = 0;
            c[g + 16 >> 2] = Fc(e, g) | 0;
            a[g + 2 >> 0] = o;
            a[g + 24 >> 0] = 0;
            c[g + 20 >> 2] = c[l + 36 >> 2];
            c[g + 28 >> 2] = 0;
            a[g + 32 >> 0] = a[l + 32 >> 0] | 0;
            a[g + 33 >> 0] = a[e + 52 + (m << 5) + 8 >> 0] | 0;
            c[g + 36 >> 2] = 0;
            a[g + 52 >> 0] = 0;
            a[g + 53 >> 0] = 0;
            Ob(e, n, g)
          }
        }
      while (0);
      return
    }

    function ib(a, b, d) {
      a = a | 0;
      b = b | 0;
      d = d | 0;
      if ((Ca | 0) != 2) {
        c[Da + 8 >> 2] = a;
        c[Da + 16 >> 2] = b;
        c[Da + 24 >> 2] = d;
        if ((Ca | 0) == 1) Ca = 3
      }
      Ka(Fa + 0 | 0);
      return c[Da >> 2] | 0
    }

    function jb(b, d) {
      b = b | 0;
      d = d | 0;
      var e = 0,
        f = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0;
      i = 0;
      k = l;
      l = l + 1104 | 0;
      j = k;
      h = k + 4 | 0;
      e = k + 80 | 0;
      do
        if (!(Lc(b, 8789, 2) | 0)) {
          e = wa(ze() | 0) | 0;
          if (!e) e = va(8792) | 0;
          else e = c[e + 20 >> 2] | 0;
          if (!e) i = 16;
          else {
            f = Hc(b) | 0;
            f = La(f + 1 + (Hc(e) | 0) | 0) | 0;
            if (!f) {
              Hb(8797, 152, 1, b, c[($f() | 0) >> 2] | 0);
              e = 0;
              break
            } else {
              ef(f, e) | 0;
              Ye(f, b + 1 | 0) | 0;
              g = f;
              i = 19;
              break
            }
          }
        } else if ((a[b >> 0] | 0) == 47) i = 16;
      else {
        if (Mc(e, 1024) | 0) {
          f = Hc(b) | 0;
          f = La(f + 2 + (Hc(e) | 0) | 0) | 0;
          if (f | 0) {
            ef(f, e) | 0;
            if ((a[e + ((Hc(e) | 0) + -1) >> 0] | 0) == 47) {
              Ye(f, b) | 0;
              g = f;
              i = 19;
              break
            } else {
              g = f + (Hc(f) | 0) | 0;
              a[g >> 0] = 47;
              a[g + 1 >> 0] = 0;
              Ye(f, b) | 0;
              g = f;
              i = 19;
              break
            }
          }
        }
        Hb(8797, 163, 1, b, c[($f() | 0) >> 2] | 0);
        e = 0
      }
      while (0);
      do
        if ((i | 0) == 16) {
          e = La((Hc(b) | 0) + 1 | 0) | 0;
          if (!e) {
            Hb(8797, 176, 1, b, c[($f() | 0) >> 2] | 0);
            e = 0;
            break
          } else {
            ef(e, b) | 0;
            g = e;
            i = 19;
            break
          }
        }
      while (0);
      do
        if ((i | 0) == 19) {
          if (_d(g, h) | 0) {
            Hb(8797, 216, 2, b, c[($f() | 0) >> 2] | 0);
            Xa(g);
            e = 0;
            break
          }
          e = c[h + 36 >> 2] | 0;
          e = (e | 0) > 536870911 ? -1 : e;
          c[d >> 2] = e;
          if (e >>> 0 > 536870911) {
            Hb(8797, 228, 12, b, 0);
            Xa(g);
            e = 0;
            break
          }
          e = La(e + 1 | 0) | 0;
          if (!e) {
            Hb(8797, 236, 1, b, c[($f() | 0) >> 2] | 0);
            Xa(g);
            e = 0;
            break
          }
          f = mc(g, 0, j) | 0;
          if ((f | 0) == -1) {
            Hb(8797, 259, 4, b, c[($f() | 0) >> 2] | 0);
            Xa(g);
            Xa(e);
            e = 0;
            break
          }
          j = Qd(f, e, c[d >> 2] | 0) | 0;
          if ((j | 0) == (c[d >> 2] | 0)) {
            $d(f) | 0;
            Xa(g);
            a[e + (c[d >> 2] | 0) >> 0] = 0;
            break
          } else {
            Hb(8797, 265, 5, b, c[($f() | 0) >> 2] | 0);
            Xa(g);
            Xa(e);
            $d(f) | 0;
            e = 0;
            break
          }
        }
      while (0);
      l = k;
      return e | 0
    }

    function kb(a) {
      a = +a;
      var b = 0,
        d = 0,
        e = 0.0,
        f = 0.0,
        g = 0.0,
        i = 0,
        k = 0,
        l = 0.0;
      i = 0;
      h[j >> 3] = a;
      d = c[j + 4 >> 2] | 0;
      b = d & 2147483647;
      d = me(c[j >> 2] | 0, d | 0, 63) | 0;
      do
        if (b >>> 0 > 1078159481) {
          b = qe(a) | 0;
          k = z & 2147483647;
          if (!(k >>> 0 > 2146435072 | (k | 0) == 2146435072 & b >>> 0 > 0))
            if (!d)
              if (a > 709.782712893384) a = a * 8988465674311579538646525.0e283;
              else i = 11;
          else a = -1.0
        } else {
          if (b >>> 0 <= 1071001154)
            if (b >>> 0 < 1016070144) break;
            else {
              g = 0.0;
              b = 0;
              i = 14;
              break
            }
          if (b >>> 0 < 1072734898)
            if (!d) {
              b = 1;
              e = a + -.6931471803691238;
              f = 1.9082149292705877e-10;
              i = 12;
              break
            } else {
              b = -1;
              e = a + .6931471803691238;
              f = -1.9082149292705877e-10;
              i = 12;
              break
            }
          else i = 11
        }
      while (0);
      if ((i | 0) == 11) {
        b = ~~(a * 1.4426950408889634 + (d | 0 ? -.5 : .5));
        f = +(b | 0);
        e = a - f * .6931471803691238;
        f = f * 1.9082149292705877e-10;
        i = 12
      }
      if ((i | 0) == 12) {
        g = e - f;
        a = g;
        g = e - g - f;
        i = 14
      }
      a: do
        if ((i | 0) == 14) {
          f = a * .5;
          e = a * f;
          l = e * (e * (e * (e * (4.008217827329362e-06 - e * 2.0109921818362437e-07) + -7.93650757867488e-05) + 1.5873015872548146e-03) + -.03333333333333313) + 1.0;
          f = 3.0 - f * l;
          f = e * ((l - f) / (6.0 - a * f));
          if (!b) {
            a = a - (a * f - e);
            break
          }
          e = a * (f - g) - g - e;
          switch (b | 0) {
            case -1:
              {
                a = (a - e) * .5 + -.5;
                break a
              }
            case 1:
              if (a < -.25) {
                a = (e - (a + .5)) * -2.0;
                break a
              } else {
                a = (a - e) * 2.0 + 1.0;
                break a
              }
            default:
              {
                i = je(b + 1023 | 0, 0, 52) | 0;k = z;c[j >> 2] = i;c[j + 4 >> 2] = k;f = +h[j >> 3];
                if (b >>> 0 > 56) {
                  a = a - e + 1.0;
                  a = ((b | 0) == 1024 ? a * 2.0 * 8988465674311579538646525.0e283 : a * f) + -1.0;
                  break a
                } else {
                  d = je(1023 - b | 0, 0, 52) | 0;
                  i = z;
                  k = (b | 0) < 20;
                  c[j >> 2] = d;
                  c[j + 4 >> 2] = i;
                  l = +h[j >> 3];
                  a = ((k ? 1.0 - l : 1.0) + (a - (k ? e : e + l))) * f;
                  break a
                }
              }
          }
        }
      while (0);
      return +a
    }

    function lb(e, f) {
      e = e | 0;
      f = f | 0;
      var g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 0,
        t = 0,
        u = 0,
        v = 0,
        w = 0,
        x = 0,
        y = 0;
      u = f + 8 | 0;
      v = c[u >> 2] | 0;
      w = f + 4 | 0;
      i = c[w >> 2] | 0;
      l = v - i | 0;
      x = l << 1;
      r = c[f >> 2] | 0;
      i = e + i | 0;
      t = (x + r | 0) >>> 1;
      g = Ed(t + 2 | 0, 2) | 0;
      c[f + 96 >> 2] = g;
      if (!g) {
        Hb(10652, 607, 1, 10546, c[($f() | 0) >> 2] | 0);
        g = -1
      } else {
        j = e + 2 | 0;
        j = (i >>> 0 > j >>> 0 ? i : j) + ~e & -2;
        s = g + j | 0;
        k = j + 2 | 0;
        m = g + k | 0;
        h = e;
        while (1) {
          b[g >> 1] = ((a[h + 1 >> 0] ^ -128) & 255) << 8 | (d[h >> 0] | 0);
          h = h + 2 | 0;
          if (h >>> 0 >= i >>> 0) break;
          else g = g + 2 | 0
        }
        q = e + j | 0;
        h = (((a[q + 3 >> 0] ^ -128) & 255) << 8 | (d[e + k >> 0] | 0)) & 65535;
        b[m >> 1] = h;
        g = l & 2147483647;
        j = m + (g << 1) | 0;
        b[j >> 1] = h;
        h = s + 4 | 0;
        k = e + v | 0;
        m = q + 6 | 0;
        m = (k >>> 0 > m >>> 0 ? k : m) + (-5 - q) | 0;
        o = m >>> 1;
        m = m & -2;
        l = m + 4 | 0;
        n = o + g | 0;
        p = n + 2 | 0;
        m = m + 6 | 0;
        n = n + 3 | 0;
        o = o + 3 | 0;
        g = h + (g << 1) | 0;
        i = q + 4 | 0;
        while (1) {
          j = j + -2 | 0;
          y = (((a[i + 1 >> 0] ^ -128) & 255) << 8 | (d[i >> 0] | 0)) & 65535;
          i = i + 2 | 0;
          b[h >> 1] = y;
          b[j >> 1] = y;
          b[g >> 1] = b[h >> 1] | 0;
          if (i >>> 0 >= k >>> 0) break;
          else {
            g = g + 2 | 0;
            h = h + 2 | 0
          }
        }
        i = q + l | 0;
        g = i + 4 | 0;
        i = (((a[i + 3 >> 0] ^ -128) & 255) << 8 | (d[q + m >> 0] | 0)) & 65535;
        b[s + (o << 1) >> 1] = i;
        b[s + (n << 1) >> 1] = i;
        i = e + r | 0;
        if ((g | 0) != (i | 0)) {
          h = s + (p << 1) + 4 | 0;
          while (1) {
            b[h >> 1] = ((a[g + 1 >> 0] ^ -128) & 255) << 8 | (d[g >> 0] | 0);
            g = g + 2 | 0;
            if (g >>> 0 >= i >>> 0) break;
            else h = h + 2 | 0
          }
        }
        g = f + 32 | 0;
        a[g >> 0] = a[g >> 0] ^ 8;
        c[w >> 2] = v >>> 1;
        c[u >> 2] = (v + x | 0) >>> 1;
        c[f >> 2] = t;
        g = 0
      }
      return g | 0
    }

    function mb(e, f) {
      e = e | 0;
      f = f | 0;
      var g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 0,
        t = 0,
        u = 0,
        v = 0,
        w = 0,
        x = 0,
        y = 0;
      u = f + 8 | 0;
      v = c[u >> 2] | 0;
      w = f + 4 | 0;
      i = c[w >> 2] | 0;
      l = v - i | 0;
      x = l << 1;
      r = c[f >> 2] | 0;
      i = e + i | 0;
      t = (x + r | 0) >>> 1;
      g = Ed(t + 2 | 0, 2) | 0;
      c[f + 96 >> 2] = g;
      if (!g) {
        Hb(10677, 438, 1, 10546, c[($f() | 0) >> 2] | 0);
        g = -1
      } else {
        j = e + 2 | 0;
        j = (i >>> 0 > j >>> 0 ? i : j) + ~e & -2;
        s = g + j | 0;
        k = j + 2 | 0;
        m = g + k | 0;
        h = e;
        while (1) {
          b[g >> 1] = (d[h + 1 >> 0] | 0) << 8 | (d[h >> 0] | 0);
          h = h + 2 | 0;
          if (h >>> 0 >= i >>> 0) break;
          else g = g + 2 | 0
        }
        q = e + j | 0;
        h = ((d[q + 3 >> 0] | 0) << 8 | (d[e + k >> 0] | 0)) & 65535;
        b[m >> 1] = h;
        g = l & 2147483647;
        j = m + (g << 1) | 0;
        b[j >> 1] = h;
        h = s + 4 | 0;
        k = e + v | 0;
        m = q + 6 | 0;
        m = (k >>> 0 > m >>> 0 ? k : m) + (-5 - q) | 0;
        o = m >>> 1;
        m = m & -2;
        l = m + 4 | 0;
        n = o + g | 0;
        p = n + 2 | 0;
        m = m + 6 | 0;
        n = n + 3 | 0;
        o = o + 3 | 0;
        g = h + (g << 1) | 0;
        i = q + 4 | 0;
        while (1) {
          j = j + -2 | 0;
          y = ((d[i + 1 >> 0] | 0) << 8 | (d[i >> 0] | 0)) & 65535;
          i = i + 2 | 0;
          b[h >> 1] = y;
          b[j >> 1] = y;
          b[g >> 1] = b[h >> 1] | 0;
          if (i >>> 0 >= k >>> 0) break;
          else {
            g = g + 2 | 0;
            h = h + 2 | 0
          }
        }
        i = q + l | 0;
        g = i + 4 | 0;
        i = ((d[i + 3 >> 0] | 0) << 8 | (d[q + m >> 0] | 0)) & 65535;
        b[s + (o << 1) >> 1] = i;
        b[s + (n << 1) >> 1] = i;
        i = e + r | 0;
        if ((g | 0) != (i | 0)) {
          h = s + (p << 1) + 4 | 0;
          while (1) {
            b[h >> 1] = (d[g + 1 >> 0] | 0) << 8 | (d[g >> 0] | 0);
            g = g + 2 | 0;
            if (g >>> 0 >= i >>> 0) break;
            else h = h + 2 | 0
          }
        }
        g = f + 32 | 0;
        a[g >> 0] = a[g >> 0] ^ 8;
        c[w >> 2] = v >>> 1;
        c[u >> 2] = (v + x | 0) >>> 1;
        c[f >> 2] = t;
        g = 0
      }
      return g | 0
    }

    function nb(a, b, d) {
      a = a | 0;
      b = b | 0;
      d = d | 0;
      var e = 0,
        f = 0,
        g = 0.0;
      a: do
          if (b >>> 0 <= 20)
            do switch (b | 0) {
              case 9:
                {
                  e = (c[d >> 2] | 0) + (4 - 1) & ~(4 - 1);b = c[e >> 2] | 0;c[d >> 2] = e + 4;c[a >> 2] = b;
                  break a
                }
              case 10:
                {
                  e = (c[d >> 2] | 0) + (4 - 1) & ~(4 - 1);b = c[e >> 2] | 0;c[d >> 2] = e + 4;e = a;c[e >> 2] = b;c[e + 4 >> 2] = ((b | 0) < 0) << 31 >> 31;
                  break a
                }
              case 11:
                {
                  e = (c[d >> 2] | 0) + (4 - 1) & ~(4 - 1);b = c[e >> 2] | 0;c[d >> 2] = e + 4;e = a;c[e >> 2] = b;c[e + 4 >> 2] = 0;
                  break a
                }
              case 12:
                {
                  e = (c[d >> 2] | 0) + (8 - 1) & ~(8 - 1);b = e;f = c[b >> 2] | 0;b = c[b + 4 >> 2] | 0;c[d >> 2] = e + 8;e = a;c[e >> 2] = f;c[e + 4 >> 2] = b;
                  break a
                }
              case 13:
                {
                  f = (c[d >> 2] | 0) + (4 - 1) & ~(4 - 1);e = c[f >> 2] | 0;c[d >> 2] = f + 4;e = (e & 65535) << 16 >> 16;f = a;c[f >> 2] = e;c[f + 4 >> 2] = ((e | 0) < 0) << 31 >> 31;
                  break a
                }
              case 14:
                {
                  f = (c[d >> 2] | 0) + (4 - 1) & ~(4 - 1);e = c[f >> 2] | 0;c[d >> 2] = f + 4;f = a;c[f >> 2] = e & 65535;c[f + 4 >> 2] = 0;
                  break a
                }
              case 15:
                {
                  f = (c[d >> 2] | 0) + (4 - 1) & ~(4 - 1);e = c[f >> 2] | 0;c[d >> 2] = f + 4;e = (e & 255) << 24 >> 24;f = a;c[f >> 2] = e;c[f + 4 >> 2] = ((e | 0) < 0) << 31 >> 31;
                  break a
                }
              case 16:
                {
                  f = (c[d >> 2] | 0) + (4 - 1) & ~(4 - 1);e = c[f >> 2] | 0;c[d >> 2] = f + 4;f = a;c[f >> 2] = e & 255;c[f + 4 >> 2] = 0;
                  break a
                }
              case 17:
                {
                  f = (c[d >> 2] | 0) + (8 - 1) & ~(8 - 1);g = +h[f >> 3];c[d >> 2] = f + 8;h[a >> 3] = g;
                  break a
                }
              case 18:
                {
                  f = (c[d >> 2] | 0) + (8 - 1) & ~(8 - 1);g = +h[f >> 3];c[d >> 2] = f + 8;h[a >> 3] = g;
                  break a
                }
              default:
                break a
            }
            while (0); while (0);
        return
    }

    function ob(a, b) {
      a = a | 0;
      b = b | 0;
      var e = 0,
        f = 0,
        g = 0,
        h = 0,
        i = 0;
      h = a + 4 | 0;
      e = c[h >> 2] | 0;
      i = a + 100 | 0;
      if (e >>> 0 < (c[i >> 2] | 0) >>> 0) {
        c[h >> 2] = e + 1;
        e = d[e >> 0] | 0
      } else e = Ub(a) | 0;
      switch (e | 0) {
        case 43:
        case 45:
          {
            f = (e | 0) == 45 & 1;e = c[h >> 2] | 0;
            if (e >>> 0 < (c[i >> 2] | 0) >>> 0) {
              c[h >> 2] = e + 1;
              e = d[e >> 0] | 0
            } else e = Ub(a) | 0;
            if ((b | 0) != 0 & (e + -48 | 0) >>> 0 > 9)
              if (c[i >> 2] | 0) c[h >> 2] = (c[h >> 2] | 0) + -1;
            break
          }
        default:
          f = 0
      }
      if ((e + -48 | 0) >>> 0 > 9)
        if (!(c[i >> 2] | 0)) {
          f = -2147483648;
          e = 0
        } else {
          c[h >> 2] = (c[h >> 2] | 0) + -1;
          f = -2147483648;
          e = 0
        }
      else {
        g = 0;
        do {
          g = e + -48 + (g * 10 | 0) | 0;
          e = c[h >> 2] | 0;
          if (e >>> 0 < (c[i >> 2] | 0) >>> 0) {
            c[h >> 2] = e + 1;
            e = d[e >> 0] | 0
          } else e = Ub(a) | 0
        } while ((e + -48 | 0) >>> 0 < 10 & (g | 0) < 214748364);
        b = ((g | 0) < 0) << 31 >> 31;
        if ((e + -48 | 0) >>> 0 < 10)
          do {
            b = Wd(g | 0, b | 0, 10, 0) | 0;
            g = z;
            e = te(e | 0, ((e | 0) < 0) << 31 >> 31 | 0, -48, -1) | 0;
            g = te(e | 0, z | 0, b | 0, g | 0) | 0;
            b = z;
            e = c[h >> 2] | 0;
            if (e >>> 0 < (c[i >> 2] | 0) >>> 0) {
              c[h >> 2] = e + 1;
              e = d[e >> 0] | 0
            } else e = Ub(a) | 0
          } while ((e + -48 | 0) >>> 0 < 10 & ((b | 0) < 21474836 | (b | 0) == 21474836 & g >>> 0 < 2061584302));
        if ((e + -48 | 0) >>> 0 < 10)
          do {
            e = c[h >> 2] | 0;
            if (e >>> 0 < (c[i >> 2] | 0) >>> 0) {
              c[h >> 2] = e + 1;
              e = d[e >> 0] | 0
            } else e = Ub(a) | 0
          } while ((e + -48 | 0) >>> 0 < 10);
        if (c[i >> 2] | 0) c[h >> 2] = (c[h >> 2] | 0) + -1;
        i = (f | 0) != 0;
        e = ne(0, 0, g | 0, b | 0) | 0;
        f = i ? z : b;
        e = i ? e : g
      }
      z = f;
      return e | 0
    }

    function pb() {
      var a = 0,
        b = 0,
        d = 0,
        e = 0,
        f = 0.0,
        g = 0.0,
        i = 0,
        j = 0.0,
        k = 0,
        m = 0,
        n = 0,
        o = 0.0,
        p = 0.0;
      n = l;
      l = l + 288 | 0;
      m = n;
      He(41464);
      if (!(c[10368] | 0)) {
        h[1815] = 1.0;
        d = 0;
        while (1) {
          if ((d | 0) == 35) {
            b = 0;
            e = 1;
            break
          }
          b = 14520 + (d * 464 | 0) | 0;
          a = b | 0;
          h[a >> 3] = 1.0;
          b = b + (d << 3) | 0;
          h[b >> 3] = 1.0;
          e = (d | 0) > 1;
          if (e) {
            f = +(d | 0);
            k = d + -1 | 0;
            j = +h[14520 + (k * 464 | 0) >> 3] / f;
            h[a >> 3] = j;
            h[b >> 3] = j;
            b = k
          } else {
            f = +(d | 0);
            b = d + -1 | 0
          }
          a = 1;
          while (1) {
            if ((a | 0) >= (d | 0)) break;
            k = 14520 + (b * 464 | 0) | 0;
            j = +h[k + (a + -1 << 3) >> 3] + +h[k + (a << 3) >> 3];
            h[14520 + (d * 464 | 0) + (a << 3) >> 3] = e ? j / f : j;
            a = a + 1 | 0
          }
          h[m + (d << 3) >> 3] = f / 12.566370614359172;
          d = d + 1 | 0
        }
        while (1) {
          if ((b | 0) == 35) break;
          a = ~~+D(-1.0, +(+(b | 0)));
          d = 0;
          while (1) {
            if ((d | 0) == (e | 0)) break;
            k = 14520 + (b * 464 | 0) + (d << 3) | 0;
            h[k >> 3] = +h[k >> 3] * +(a | 0);
            a = 0 - a | 0;
            d = d + 1 | 0
          }
          b = b + 1 | 0;
          e = e + 1 | 0
        }
        i = La(286720) | 0;
        a = 0;
        g = 0.0;
        while (1) {
          if ((a | 0) == 1024) break;
          j = (g + 17.0) / 12.566370614359172;
          b = i + (a * 35 << 3) | 0;
          d = 0;
          while (1) {
            if ((d | 0) == 35) break;
            k = m + (d << 3) | 0;
            f = 1.0;
            e = 0;
            while (1) {
              if ((e | 0) == 35) break;
              if ((e | 0) != (d | 0)) {
                o = +h[m + (e << 3) >> 3];
                p = +F(+(j - o));
                f = f * (p / +F(+(+h[k >> 3] - o)))
              }
              e = e + 1 | 0
            }
            h[b >> 3] = f;
            b = b + 8 | 0;
            d = d + 1 | 0
          }
          a = a + 1 | 0;
          g = g + .0009765625
        }
        c[10368] = i;
        Oe(41464)
      } else Oe(41464);
      l = n;
      return
    }

    function qb(e, f) {
      e = e | 0;
      f = f | 0;
      var g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 0;
      o = f + 8 | 0;
      p = c[o >> 2] | 0;
      q = f + 4 | 0;
      n = c[q >> 2] | 0;
      l = p - n | 0;
      r = l << 1;
      h = c[f >> 2] | 0;
      s = r + h | 0;
      g = Ed((s >>> 1) + 2 | 0, 2) | 0;
      c[f + 96 >> 2] = g;
      if (!g) {
        Hb(10532, 692, 1, 10546, c[($f() | 0) >> 2] | 0);
        g = -1
      } else {
        k = h + -1 | 0;
        while (1) {
          i = e + k | 0;
          m = ((a[i >> 0] ^ -128) & 255) << 8;
          b[g >> 1] = m;
          h = k + -2 | 0;
          j = g + 2 | 0;
          b[g >> 1] = m | (d[i + -1 >> 0] | 0);
          if ((h | 0) < (p | 0)) {
            g = j;
            k = h
          } else break
        }
        h = ((a[e + h >> 0] ^ -128) & 255) << 8;
        b[j >> 1] = h;
        h = (h | (d[i + -3 >> 0] | 0)) & 65535;
        b[j >> 1] = h;
        m = l & 2147483647;
        i = j + (m << 1) | 0;
        b[i >> 1] = h;
        l = g + 4 | 0;
        m = l + (m << 1) | 0;
        k = k + -4 | 0;
        while (1) {
          h = e + k | 0;
          i = i + -2 | 0;
          j = ((a[h >> 0] ^ -128) & 255) << 8;
          b[l >> 1] = j;
          g = k + -2 | 0;
          j = (j | (d[h + -1 >> 0] | 0)) & 65535;
          b[l >> 1] = j;
          b[i >> 1] = j;
          j = m + 2 | 0;
          b[m >> 1] = b[l >> 1] | 0;
          l = l + 2 | 0;
          if ((g | 0) >= (n | 0)) break;
          else {
            m = j;
            k = g
          }
        }
        i = ((a[e + g >> 0] ^ -128) & 255) << 8;
        b[l >> 1] = i;
        i = (i | (d[h + -3 >> 0] | 0)) & 65535;
        b[l >> 1] = i;
        b[j >> 1] = i;
        i = (k | 0) < 5;
        h = m + 4 | 0;
        g = k + -4 | 0;
        while (1) {
          n = e + g | 0;
          m = ((a[n >> 0] ^ -128) & 255) << 8;
          b[h >> 1] = m;
          b[h >> 1] = m | (d[n + -1 >> 0] | 0);
          if (i) {
            h = h + 2 | 0;
            g = g + -2 | 0
          } else break
        }
        c[q >> 2] = p;
        c[o >> 2] = p + r;
        c[f >> 2] = s;
        g = f + 32 | 0;
        a[g >> 0] = a[g >> 0] ^ 26;
        g = 0
      }
      return g | 0
    }

    function rb(e, f) {
      e = e | 0;
      f = f | 0;
      var g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 0;
      o = f + 8 | 0;
      p = c[o >> 2] | 0;
      q = f + 4 | 0;
      n = c[q >> 2] | 0;
      l = p - n | 0;
      r = l << 1;
      h = c[f >> 2] | 0;
      s = r + h | 0;
      g = Ed((s >>> 1) + 2 | 0, 2) | 0;
      c[f + 96 >> 2] = g;
      if (!g) {
        Hb(10575, 523, 1, 10546, c[($f() | 0) >> 2] | 0);
        g = -1
      } else {
        k = h + -1 | 0;
        while (1) {
          i = e + k | 0;
          m = (d[i >> 0] | 0) << 8;
          b[g >> 1] = m;
          h = k + -2 | 0;
          j = g + 2 | 0;
          b[g >> 1] = m | (d[i + -1 >> 0] | 0);
          if ((h | 0) < (p | 0)) {
            g = j;
            k = h
          } else break
        }
        h = (d[e + h >> 0] | 0) << 8;
        b[j >> 1] = h;
        h = (h | (d[i + -3 >> 0] | 0)) & 65535;
        b[j >> 1] = h;
        m = l & 2147483647;
        i = j + (m << 1) | 0;
        b[i >> 1] = h;
        l = g + 4 | 0;
        m = l + (m << 1) | 0;
        k = k + -4 | 0;
        while (1) {
          h = e + k | 0;
          i = i + -2 | 0;
          j = (d[h >> 0] | 0) << 8;
          b[l >> 1] = j;
          g = k + -2 | 0;
          j = (j | (d[h + -1 >> 0] | 0)) & 65535;
          b[l >> 1] = j;
          b[i >> 1] = j;
          j = m + 2 | 0;
          b[m >> 1] = b[l >> 1] | 0;
          l = l + 2 | 0;
          if ((g | 0) >= (n | 0)) break;
          else {
            m = j;
            k = g
          }
        }
        i = (d[e + g >> 0] | 0) << 8;
        b[l >> 1] = i;
        i = (i | (d[h + -3 >> 0] | 0)) & 65535;
        b[l >> 1] = i;
        b[j >> 1] = i;
        i = (k | 0) < 5;
        h = m + 4 | 0;
        g = k + -4 | 0;
        while (1) {
          n = e + g | 0;
          m = (d[n >> 0] | 0) << 8;
          b[h >> 1] = m;
          b[h >> 1] = m | (d[n + -1 >> 0] | 0);
          if (i) {
            h = h + 2 | 0;
            g = g + -2 | 0
          } else break
        }
        c[q >> 2] = p;
        c[o >> 2] = p + r;
        c[f >> 2] = s;
        g = f + 32 | 0;
        a[g >> 0] = a[g >> 0] ^ 24;
        g = 0
      }
      return g | 0
    }

    function sb(d, e) {
      d = d | 0;
      e = e | 0;
      var f = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 0,
        t = 0,
        u = 0,
        v = 0;
      q = e + 8 | 0;
      r = c[q >> 2] | 0;
      s = e + 4 | 0;
      l = c[s >> 2] | 0;
      t = r - l << 1;
      h = c[e >> 2] | 0;
      u = t + h | 0;
      i = d + r | 0;
      f = Ed(u + 2 | 0, 2) | 0;
      c[e + 96 >> 2] = f;
      if (!f) {
        Hb(10562, 354, 1, 10546, c[($f() | 0) >> 2] | 0);
        f = -1
      } else {
        j = r + 1 | 0;
        k = h << 1;
        n = r << 1;
        p = f + (k + -4 - n) | 0;
        k = f + (k + -2 - n) | 0;
        g = f;
        f = d + h + -1 | 0;
        while (1) {
          b[g >> 1] = ((a[f >> 0] ^ -128) & 255) << 8;
          f = f + -1 | 0;
          if ((f | 0) == (i | 0)) break;
          else g = g + 2 | 0
        }
        v = d + j | 0;
        g = ((a[i >> 0] ^ -128) & 255) << 8 & 65535;
        b[k >> 1] = g;
        h = k + (t << 1) | 0;
        b[h >> 1] = g;
        g = p + 4 | 0;
        o = d + l | 0;
        k = o;
        j = l << 1;
        m = v + (n + -1 - k - j) | 0;
        j = v + (n - k - j) | 0;
        k = v + (0 - k) | 0;
        f = g + (t << 1) | 0;
        l = v + -2 | 0;
        while (1) {
          h = h + -2 | 0;
          i = l + -1 | 0;
          v = ((a[l >> 0] ^ -128) & 255) << 8 & 65535;
          b[g >> 1] = v;
          b[h >> 1] = v;
          b[f >> 1] = b[g >> 1] | 0;
          if ((i | 0) == (o | 0)) break;
          else {
            f = f + 2 | 0;
            g = g + 2 | 0;
            l = i
          }
        }
        g = ((a[o >> 0] ^ -128) & 255) << 8 & 65535;
        b[p + (k << 1) >> 1] = g;
        b[p + (j << 1) >> 1] = g;
        g = p + (m << 1) + 4 | 0;
        f = l + -2 | 0;
        while (1) {
          b[g >> 1] = ((a[f >> 0] ^ -128) & 255) << 8;
          if ((f | 0) == (d | 0)) break;
          else {
            g = g + 2 | 0;
            f = f + -1 | 0
          }
        }
        c[s >> 2] = r;
        c[q >> 2] = r + t;
        c[e >> 2] = u;
        f = e + 32 | 0;
        a[f >> 0] = a[f >> 0] ^ 26;
        f = 0
      }
      return f | 0
    }

    function tb(b, d) {
      b = b | 0;
      d = d | 0;
      var e = 0,
        f = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0;
      do
        if (!(c[10365] | 0)) {
          Hb(10177, 1733, 8, 0, 0);
          e = -1
        } else {
          if (!b) {
            Hb(10177, 1737, 9, 10105, 0);
            e = -1;
            break
          }
          if (!d) {
            Hb(10177, 1741, 9, 10195, 0);
            e = -1;
            break
          }
          He(b);
          k = b + 12 | 0;
          f = c[k >> 2] | 0;
          g = c[d >> 2] | 0;
          e = c[b + 32 >> 2] | 0;
          if (g >>> 0 > e >>> 0) c[d >> 2] = e;
          else if ((g | 0) != (e | 0)) {
            j = b + 28 | 0;
            e = c[j >> 2] | 0;
            if (e >>> 0 > g >>> 0) {
              f = c[b + 8 >> 2] | 0;
              Eb(b);
              c[j >> 2] = 0;
              i = b + 4 | 0;
              c[i >> 2] = 0;
              h = 0;
              e = 0;
              g = c[d >> 2] | 0
            } else {
              h = b + 4 | 0;
              i = h;
              h = c[h >> 2] | 0
            }
            e = h + e | 0;
            if (e >>> 0 > g >>> 0) {
              c[i >> 2] = e - g;
              c[j >> 2] = g
            } else {
              c[j >> 2] = e;
              c[i >> 2] = 0;
              g = f;
              e = 0;
              while (1) {
                if (e | 0) break;
                e = c[g >> 2] | 0;
                if (!e) break;
                Ja[e & 63](b, g + 4 | 0);
                e = c[g + 12 >> 2] | 0;
                c[i >> 2] = e;
                e = (c[j >> 2] | 0) + e | 0;
                f = c[d >> 2] | 0;
                if (e >>> 0 > f >>> 0) {
                  e = e - f | 0;
                  c[i >> 2] = e;
                  c[j >> 2] = f
                } else {
                  c[j >> 2] = e;
                  c[i >> 2] = 0;
                  e = 0
                }
                g = g + 20 | 0
              }
              c[k >> 2] = g
            }
            g = b + 564 | 0;
            e = c[g >> 2] | 0;
            if (e | 0)
              do {
                a[e + 34 >> 0] = 0;
                f = e + 36 | 0;
                if (c[f >> 2] | 0) c[f >> 2] = 0;
                e = c[e + 40 >> 2] | 0
              } while ((e | 0) != 0);
            c[g >> 2] = 0;
            Vb(c[b + 229964 >> 2] | 0);
            Oe(b);
            e = 0;
            break
          }
          Oe(b);
          e = 0
        }
      while (0);
      return e | 0
    }

    function ub(d, e) {
      d = d | 0;
      e = e | 0;
      var f = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 0,
        t = 0,
        u = 0,
        v = 0;
      q = e + 8 | 0;
      r = c[q >> 2] | 0;
      s = e + 4 | 0;
      f = c[s >> 2] | 0;
      t = r - f << 1;
      o = c[e >> 2] | 0;
      u = t + o | 0;
      i = d + f | 0;
      g = Ed(u + 2 | 0, 2) | 0;
      c[e + 96 >> 2] = g;
      if (!g) {
        Hb(10665, 278, 1, 10546, c[($f() | 0) >> 2] | 0);
        f = -1
      } else {
        j = f + -1 | 0;
        k = f << 1;
        p = g + (k + -2) | 0;
        h = g + k | 0;
        f = g;
        g = d;
        while (1) {
          b[f >> 1] = ((a[g >> 0] ^ -128) & 255) << 8;
          g = g + 1 | 0;
          if ((g | 0) == (i | 0)) break;
          else f = f + 2 | 0
        }
        j = d + j | 0;
        l = j;
        g = ((a[i >> 0] ^ -128) & 255) << 8 & 65535;
        b[h >> 1] = g;
        i = h + (t << 1) | 0;
        b[i >> 1] = g;
        g = p + 4 | 0;
        m = d + r | 0;
        f = r * 3 | 0;
        n = d + (f + -1 - l - k) | 0;
        k = d + (f - l - k) | 0;
        l = d + (r - l) | 0;
        f = g + (t << 1) | 0;
        h = j + 2 | 0;
        while (1) {
          i = i + -2 | 0;
          j = h + 1 | 0;
          v = ((a[h >> 0] ^ -128) & 255) << 8 & 65535;
          b[g >> 1] = v;
          b[i >> 1] = v;
          b[f >> 1] = b[g >> 1] | 0;
          if ((j | 0) == (m | 0)) break;
          else {
            f = f + 2 | 0;
            g = g + 2 | 0;
            h = j
          }
        }
        f = h + 2 | 0;
        h = ((a[m >> 0] ^ -128) & 255) << 8 & 65535;
        b[p + (l << 1) >> 1] = h;
        b[p + (k << 1) >> 1] = h;
        h = d + o | 0;
        if ((f | 0) != (h | 0)) {
          g = p + (n << 1) + 4 | 0;
          while (1) {
            b[g >> 1] = ((a[f >> 0] ^ -128) & 255) << 8;
            f = f + 1 | 0;
            if ((f | 0) == (h | 0)) break;
            else g = g + 2 | 0
          }
        }
        c[s >> 2] = r;
        c[q >> 2] = r + t;
        c[e >> 2] = u;
        f = e + 32 | 0;
        a[f >> 0] = a[f >> 0] ^ 10;
        f = 0
      }
      return f | 0
    }

    function vb(e, f) {
      e = e | 0;
      f = f | 0;
      var g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 0,
        t = 0,
        u = 0,
        v = 0,
        w = 0;
      r = f + 8 | 0;
      s = c[r >> 2] | 0;
      t = f + 4 | 0;
      g = c[t >> 2] | 0;
      u = s - g << 1;
      p = c[f >> 2] | 0;
      v = u + p | 0;
      j = e + g | 0;
      h = Ed(v + 2 | 0, 2) | 0;
      c[f + 96 >> 2] = h;
      if (!h) {
        Hb(10690, 129, 1, 10546, c[($f() | 0) >> 2] | 0);
        g = -1
      } else {
        k = g + -1 | 0;
        l = g << 1;
        q = h + (l + -2) | 0;
        i = h + l | 0;
        g = h;
        h = e;
        while (1) {
          b[g >> 1] = (d[h >> 0] | 0) << 8;
          h = h + 1 | 0;
          if ((h | 0) == (j | 0)) break;
          else g = g + 2 | 0
        }
        k = e + k | 0;
        m = k;
        h = (d[j >> 0] | 0) << 8 & 65535;
        b[i >> 1] = h;
        j = i + (u << 1) | 0;
        b[j >> 1] = h;
        h = q + 4 | 0;
        n = e + s | 0;
        g = s * 3 | 0;
        o = e + (g + -1 - m - l) | 0;
        l = e + (g - m - l) | 0;
        m = e + (s - m) | 0;
        g = h + (u << 1) | 0;
        i = k + 2 | 0;
        while (1) {
          j = j + -2 | 0;
          k = i + 1 | 0;
          w = (d[i >> 0] | 0) << 8 & 65535;
          b[h >> 1] = w;
          b[j >> 1] = w;
          b[g >> 1] = b[h >> 1] | 0;
          if ((k | 0) == (n | 0)) break;
          else {
            g = g + 2 | 0;
            h = h + 2 | 0;
            i = k
          }
        }
        g = i + 2 | 0;
        i = (d[n >> 0] | 0) << 8 & 65535;
        b[q + (m << 1) >> 1] = i;
        b[q + (l << 1) >> 1] = i;
        i = e + p | 0;
        if ((g | 0) != (i | 0)) {
          h = q + (o << 1) + 4 | 0;
          while (1) {
            b[h >> 1] = (d[g >> 0] | 0) << 8;
            g = g + 1 | 0;
            if ((g | 0) == (i | 0)) break;
            else h = h + 2 | 0
          }
        }
        c[t >> 2] = s;
        c[r >> 2] = s + u;
        c[f >> 2] = v;
        g = f + 32 | 0;
        a[g >> 0] = a[g >> 0] ^ 8;
        g = 0
      }
      return g | 0
    }

    function wb(e, f) {
      e = e | 0;
      f = f | 0;
      var g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 0,
        t = 0,
        u = 0,
        v = 0,
        w = 0;
      r = f + 8 | 0;
      s = c[r >> 2] | 0;
      t = f + 4 | 0;
      m = c[t >> 2] | 0;
      u = s - m << 1;
      i = c[f >> 2] | 0;
      v = u + i | 0;
      j = e + s | 0;
      g = Ed(v + 2 | 0, 2) | 0;
      c[f + 96 >> 2] = g;
      if (!g) {
        Hb(10589, 206, 1, 10546, c[($f() | 0) >> 2] | 0);
        g = -1
      } else {
        k = s + 1 | 0;
        l = i << 1;
        o = s << 1;
        q = g + (l + -4 - o) | 0;
        l = g + (l + -2 - o) | 0;
        h = g;
        g = e + i + -1 | 0;
        while (1) {
          b[h >> 1] = (d[g >> 0] | 0) << 8;
          g = g + -1 | 0;
          if ((g | 0) == (j | 0)) break;
          else h = h + 2 | 0
        }
        w = e + k | 0;
        h = (d[j >> 0] | 0) << 8 & 65535;
        b[l >> 1] = h;
        i = l + (u << 1) | 0;
        b[i >> 1] = h;
        h = q + 4 | 0;
        p = e + m | 0;
        l = p;
        k = m << 1;
        n = w + (o + -1 - l - k) | 0;
        k = w + (o - l - k) | 0;
        l = w + (0 - l) | 0;
        g = h + (u << 1) | 0;
        m = w + -2 | 0;
        while (1) {
          i = i + -2 | 0;
          j = m + -1 | 0;
          w = (d[m >> 0] | 0) << 8 & 65535;
          b[h >> 1] = w;
          b[i >> 1] = w;
          b[g >> 1] = b[h >> 1] | 0;
          if ((j | 0) == (p | 0)) break;
          else {
            g = g + 2 | 0;
            h = h + 2 | 0;
            m = j
          }
        }
        h = (d[p >> 0] | 0) << 8 & 65535;
        b[q + (l << 1) >> 1] = h;
        b[q + (k << 1) >> 1] = h;
        h = q + (n << 1) | 0;
        g = m + -2 | 0;
        while (1) {
          h = h + 4 | 0;
          b[h >> 1] = (d[g >> 0] | 0) << 8;
          if ((g | 0) == (e | 0)) break;
          else g = g + -1 | 0
        }
        c[t >> 2] = s;
        c[r >> 2] = s + u;
        c[f >> 2] = v;
        g = f + 32 | 0;
        a[g >> 0] = a[g >> 0] ^ 24;
        g = 0
      }
      return g | 0
    }

    function xb(b) {
      b = b | 0;
      var d = 0,
        e = 0,
        f = 0,
        g = 0,
        h = 0,
        i = 0;
      g = b + 229948 | 0;
      if (c[g >> 2] | 0) {
        He(41476);
        h = b + 229944 | 0;
        f = 0;
        while (1) {
          if (f >>> 0 >= (c[g >> 2] | 0) >>> 0) break;
          d = c[(c[h >> 2] | 0) + (f << 2) >> 2] | 0;
          i = d + 88 | 0;
          e = (c[i >> 2] | 0) + -1 | 0;
          c[i >> 2] = e;
          if (!e) {
            while (1) {
              e = c[d + 92 >> 2] | 0;
              if (!e) break;
              i = c[e + 100 >> 2] | 0;
              Xa(c[e + 96 >> 2] | 0);
              Xa(c[(c[(c[h >> 2] | 0) + (f << 2) >> 2] | 0) + 92 >> 2] | 0);
              d = (c[h >> 2] | 0) + (f << 2) | 0;
              c[(c[d >> 2] | 0) + 92 >> 2] = i;
              d = c[d >> 2] | 0
            }
            a[d + 2 >> 0] = 0
          }
          f = f + 1 | 0
        }
        Oe(41476);
        Xa(c[h >> 2] | 0)
      }
      h = b + 16 | 0;
      d = c[h >> 2] | 0;
      g = b + 8 | 0;
      a: do
        if (d | 0) {
          f = 0;
          while (1) {
            if (f >>> 0 >= d >>> 0) break a;
            d = c[g >> 2] | 0;
            e = c[d + (f * 20 | 0) >> 2] | 0;
            do
              if ((e | 0) == 6) Xa(c[d + (f * 20 | 0) + 8 >> 2] | 0);
              else {
                if ((e | 0) == 7) {
                  Xa(c[d + (f * 20 | 0) + 8 >> 2] | 0);
                  break
                }
                if ((e | 0) == 8) {
                  Xa(c[d + (f * 20 | 0) + 8 >> 2] | 0);
                  break
                }
                if ((e | 0) == 9) {
                  Xa(c[d + (f * 20 | 0) + 8 >> 2] | 0);
                  break
                }
                if ((e | 0) == 10) {
                  Xa(c[d + (f * 20 | 0) + 8 >> 2] | 0);
                  break
                }
                if ((e | 0) == 11) {
                  Xa(c[d + (f * 20 | 0) + 8 >> 2] | 0);
                  break
                }
                if ((e | 0) == 12) Xa(c[d + (f * 20 | 0) + 8 >> 2] | 0)
              }
            while (0);
            f = f + 1 | 0;
            d = c[h >> 2] | 0
          }
        }
      while (0);
      Xa(c[g >> 2] | 0);
      xe(c[b + 229964 >> 2] | 0);
      Xa(c[b + 229956 >> 2] | 0);
      Xa(b);
      return
    }

    function yb(b, d, e) {
      b = b | 0;
      d = d | 0;
      e = e | 0;
      var f = 0,
        g = 0,
        h = 0;
      if ((e | 0) >= 8192) return ra(b | 0, d | 0, e | 0) | 0;
      h = b | 0;
      g = b + e | 0;
      if ((b & 3) == (d & 3)) {
        while (b & 3) {
          if (!e) return h | 0;
          a[b >> 0] = a[d >> 0] | 0;
          b = b + 1 | 0;
          d = d + 1 | 0;
          e = e - 1 | 0
        }
        e = g & -4 | 0;
        f = e - 64 | 0;
        while ((b | 0) <= (f | 0)) {
          c[b >> 2] = c[d >> 2];
          c[b + 4 >> 2] = c[d + 4 >> 2];
          c[b + 8 >> 2] = c[d + 8 >> 2];
          c[b + 12 >> 2] = c[d + 12 >> 2];
          c[b + 16 >> 2] = c[d + 16 >> 2];
          c[b + 20 >> 2] = c[d + 20 >> 2];
          c[b + 24 >> 2] = c[d + 24 >> 2];
          c[b + 28 >> 2] = c[d + 28 >> 2];
          c[b + 32 >> 2] = c[d + 32 >> 2];
          c[b + 36 >> 2] = c[d + 36 >> 2];
          c[b + 40 >> 2] = c[d + 40 >> 2];
          c[b + 44 >> 2] = c[d + 44 >> 2];
          c[b + 48 >> 2] = c[d + 48 >> 2];
          c[b + 52 >> 2] = c[d + 52 >> 2];
          c[b + 56 >> 2] = c[d + 56 >> 2];
          c[b + 60 >> 2] = c[d + 60 >> 2];
          b = b + 64 | 0;
          d = d + 64 | 0
        }
        while ((b | 0) < (e | 0)) {
          c[b >> 2] = c[d >> 2];
          b = b + 4 | 0;
          d = d + 4 | 0
        }
      } else {
        e = g - 4 | 0;
        while ((b | 0) < (e | 0)) {
          a[b >> 0] = a[d >> 0] | 0;
          a[b + 1 >> 0] = a[d + 1 >> 0] | 0;
          a[b + 2 >> 0] = a[d + 2 >> 0] | 0;
          a[b + 3 >> 0] = a[d + 3 >> 0] | 0;
          b = b + 4 | 0;
          d = d + 4 | 0
        }
      }
      while ((b | 0) < (g | 0)) {
        a[b >> 0] = a[d >> 0] | 0;
        b = b + 1 | 0;
        d = d + 1 | 0
      }
      return h | 0
    }

    function zb(a, b, d) {
      a = a | 0;
      b = b | 0;
      d = d | 0;
      var e = 0,
        f = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0;
      m = 0;
      n = l;
      l = l + 48 | 0;
      k = n + 16 | 0;
      g = n;
      f = n + 32 | 0;
      i = a + 28 | 0;
      e = c[i >> 2] | 0;
      c[f >> 2] = e;
      j = a + 20 | 0;
      e = (c[j >> 2] | 0) - e | 0;
      c[f + 4 >> 2] = e;
      c[f + 8 >> 2] = b;
      c[f + 12 >> 2] = d;
      e = e + d | 0;
      h = a + 60 | 0;
      c[g >> 2] = c[h >> 2];
      c[g + 4 >> 2] = f;
      c[g + 8 >> 2] = 2;
      g = De(ca(146, g | 0) | 0) | 0;
      a: do
        if ((e | 0) == (g | 0)) m = 3;
        else {
          b = 2;
          while (1) {
            if ((g | 0) < 0) break;
            e = e - g | 0;
            p = c[f + 4 >> 2] | 0;
            o = g >>> 0 > p >>> 0;
            f = o ? f + 8 | 0 : f;
            b = b + (o << 31 >> 31) | 0;
            p = g - (o ? p : 0) | 0;
            c[f >> 2] = (c[f >> 2] | 0) + p;
            o = f + 4 | 0;
            c[o >> 2] = (c[o >> 2] | 0) - p;
            c[k >> 2] = c[h >> 2];
            c[k + 4 >> 2] = f;
            c[k + 8 >> 2] = b;
            g = De(ca(146, k | 0) | 0) | 0;
            if ((e | 0) == (g | 0)) {
              m = 3;
              break a
            }
          }
          c[a + 16 >> 2] = 0;
          c[i >> 2] = 0;
          c[j >> 2] = 0;
          c[a >> 2] = c[a >> 2] | 32;
          if ((b | 0) == 2) d = 0;
          else d = d - (c[f + 4 >> 2] | 0) | 0
        }
      while (0);
      if ((m | 0) == 3) {
        p = c[a + 44 >> 2] | 0;
        c[a + 16 >> 2] = p + (c[a + 48 >> 2] | 0);
        c[i >> 2] = p;
        c[j >> 2] = p
      }
      l = n;
      return d | 0
    }

    function Ab(b, d, e) {
      b = b | 0;
      d = d | 0;
      e = e | 0;
      var f = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 0;
      s = l;
      l = l + 224 | 0;
      n = s + 120 | 0;
      o = s + 80 | 0;
      q = s;
      r = s + 136 | 0;
      f = o;
      g = f + 40 | 0;
      do {
        c[f >> 2] = 0;
        f = f + 4 | 0
      } while ((f | 0) < (g | 0));
      c[n >> 2] = c[e >> 2];
      if ((Pa(0, d, n, q, o) | 0) < 0) e = -1;
      else {
        if ((c[b + 76 >> 2] | 0) > -1) p = Xf(b) | 0;
        else p = 0;
        e = c[b >> 2] | 0;
        m = e & 32;
        if ((a[b + 74 >> 0] | 0) < 1) c[b >> 2] = e & -33;
        f = b + 48 | 0;
        if (!(c[f >> 2] | 0)) {
          g = b + 44 | 0;
          h = c[g >> 2] | 0;
          c[g >> 2] = r;
          i = b + 28 | 0;
          c[i >> 2] = r;
          j = b + 20 | 0;
          c[j >> 2] = r;
          c[f >> 2] = 80;
          k = b + 16 | 0;
          c[k >> 2] = r + 80;
          e = Pa(b, d, n, q, o) | 0;
          if (h) {
            Ia[c[b + 36 >> 2] & 7](b, 0, 0) | 0;
            e = (c[j >> 2] | 0) == 0 ? -1 : e;
            c[g >> 2] = h;
            c[f >> 2] = 0;
            c[k >> 2] = 0;
            c[i >> 2] = 0;
            c[j >> 2] = 0
          }
        } else e = Pa(b, d, n, q, o) | 0;
        f = c[b >> 2] | 0;
        c[b >> 2] = f | m;
        if (p | 0) Wf(b);
        e = (f & 32 | 0) == 0 ? e : -1
      }
      l = s;
      return e | 0
    }

    function Bb(b, d, e) {
      b = b | 0;
      d = d | 0;
      e = e | 0;
      var f = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0;
      o = (c[b >> 2] | 0) + 1794895138 | 0;
      h = Ie(c[b + 8 >> 2] | 0, o) | 0;
      f = Ie(c[b + 12 >> 2] | 0, o) | 0;
      g = Ie(c[b + 16 >> 2] | 0, o) | 0;
      a: do
        if (h >>> 0 < d >>> 2 >>> 0) {
          n = d - (h << 2) | 0;
          if (f >>> 0 < n >>> 0 & g >>> 0 < n >>> 0)
            if (!((g | f) & 3)) {
              n = f >>> 2;
              m = g >>> 2;
              l = 0;
              while (1) {
                j = h >>> 1;
                k = l + j | 0;
                i = k << 1;
                g = i + n | 0;
                f = Ie(c[b + (g << 2) >> 2] | 0, o) | 0;
                g = Ie(c[b + (g + 1 << 2) >> 2] | 0, o) | 0;
                if (!(g >>> 0 < d >>> 0 & f >>> 0 < (d - g | 0) >>> 0)) {
                  f = 0;
                  break a
                }
                if (a[b + (g + f) >> 0] | 0) {
                  f = 0;
                  break a
                }
                f = qd(e, b + g | 0) | 0;
                if (!f) break;
                f = (f | 0) < 0;
                if ((h | 0) == 1) {
                  f = 0;
                  break a
                } else {
                  l = f ? l : k;
                  h = f ? j : h - j | 0
                }
              }
              f = i + m | 0;
              g = Ie(c[b + (f << 2) >> 2] | 0, o) | 0;
              f = Ie(c[b + (f + 1 << 2) >> 2] | 0, o) | 0;
              if (f >>> 0 < d >>> 0 & g >>> 0 < (d - f | 0) >>> 0) f = (a[b + (f + g) >> 0] | 0) == 0 ? b + f | 0 : 0;
              else f = 0
            } else f = 0;
          else f = 0
        } else f = 0; while (0);
      return f | 0
    }

    function Cb(b, d, e, f) {
      b = b | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      var g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0;
      i = e & 255;
      do switch (e << 24 >> 24) {
        case 0:
          {
            a[b + 52 + ((d & 255) << 5) >> 0] = f;e = 16;
            break
          }
        case 6:
          {
            e = 15;
            break
          }
        case 7:
          {
            a[b + 52 + ((d & 255) << 5) + 9 >> 0] = f;e = 17;
            break
          }
        case 8:
          {
            e = 18;
            break
          }
        case 10:
          {
            e = 19;
            break
          }
        case 11:
          {
            e = 20;
            break
          }
        case 38:
          {
            e = 21;
            break
          }
        case 64:
          {
            e = 22;
            break
          }
        case 96:
          {
            e = 23;
            break
          }
        case 97:
          {
            e = 24;
            break
          }
        case 98:
          {
            e = 25;
            break
          }
        case 99:
          {
            e = 26;
            break
          }
        case 100:
          {
            e = 27;
            break
          }
        case 101:
          {
            e = 28;
            break
          }
        case 120:
          {
            e = 29;
            break
          }
        case 121:
          {
            e = 30;
            break
          }
        case 123:
          {
            e = 31;
            break
          }
        default:
          e = 14
      }
      while (0);
      Ld(b);
      j = b + 8 | 0;
      h = c[j >> 2] | 0;
      b = b + 16 | 0;
      g = c[b >> 2] | 0;
      k = h + (g * 20 | 0) | 0;
      c[k >> 2] = e;
      a[k + 4 >> 0] = d;
      if ((e | 0) == 14) e = i << 8 | f & 255;
      else e = f & 255;
      c[h + (g * 20 | 0) + 8 >> 2] = e;
      k = c[b >> 2] | 0;
      c[(c[j >> 2] | 0) + (k * 20 | 0) + 12 >> 2] = 0;
      c[b >> 2] = k + 1;
      return
    }

    function Db(a) {
      a = a | 0;
      var d = 0,
        f = 0,
        g = 0,
        h = 0;
      a: do
        if (!(c[10365] | 0)) {
          Hb(10329, 2034, 8, 0, 0);
          d = 0
        } else {
          if (!a) {
            Hb(10329, 2038, 9, 10105, 0);
            d = 0;
            break
          }
          He(a);
          h = a + 44 | 0;
          d = c[h >> 2] | 0;
          do
            if (!d) {
              d = La(20) | 0;
              c[h >> 2] = d;
              if (!d) {
                Hb(10329, 2045, 1, 10346, 0);
                Oe(a);
                d = 0;
                break a
              } else {
                c[d >> 2] = 0;
                break
              }
            }
          while (0);
          g = a + 24 | 0;
          c[d + 4 >> 2] = c[a + 28 >> 2];
          c[d + 8 >> 2] = c[a + 32 >> 2];
          b[d + 12 >> 1] = b[a + 36 >> 1] | 0;
          c[d + 16 >> 2] = (((c[d + 8 >> 2] | 0) * 1e3 | 0) >>> 0) / ((e[21285] | 0) >>> 0) | 0;
          do
            if (!(c[g >> 2] | 0)) c[d >> 2] = 0;
            else {
              Xa(c[d >> 2] | 0);
              d = La((Hc(c[g >> 2] | 0) | 0) + 1 | 0) | 0;
              f = c[h >> 2] | 0;
              c[f >> 2] = d;
              if (!d) {
                Xa(f);
                c[h >> 2] = 0;
                Hb(10329, 2061, 1, 10358, 0);
                Oe(a);
                d = 0;
                break a
              } else {
                ef(d, c[g >> 2] | 0) | 0;
                break
              }
            }
          while (0);
          Oe(a);
          d = c[h >> 2] | 0
        }
      while (0);
      return d | 0
    }

    function Eb(d) {
      d = d | 0;
      var e = 0,
        f = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0;
      j = d + 8 | 0;
      c[d + 12 >> 2] = c[j >> 2];
      c[d + 4 >> 2] = 0;
      c[d + 28 >> 2] = 0;
      sc(d, 0);
      Ld(d);
      h = c[j >> 2] | 0;
      f = d + 16 | 0;
      i = c[f >> 2] | 0;
      i = h + (i * 20 | 0) | 0;
      c[i >> 2] = 0;
      a[i + 4 >> 0] = 0;
      c[i + 8 >> 2] = 0;
      j = c[j >> 2] | 0;
      f = c[f >> 2] | 0;
      c[j + (f * 20 | 0) + 12 >> 2] = 0;
      if (b[21284] & 16384) {
        if ((c[j >> 2] | 0) != 2) {
          g = d + 32 | 0;
          e = j;
          do {
            h = e + 12 | 0;
            i = c[h >> 2] | 0;
            if (i | 0) {
              c[g >> 2] = (c[g >> 2] | 0) - i;
              c[h >> 2] = 0
            }
            e = e + 20 | 0
          } while ((c[e >> 2] | 0) != 2)
        }
        e = j + ((f + -1 | 0) * 20 | 0) | 0;
        g = d + 32 | 0;
        f = c[g >> 2] | 0;
        if ((c[e >> 2] | 0) != 3) {
          do {
            d = e + 12 | 0;
            f = f - (c[d >> 2] | 0) | 0;
            c[d >> 2] = 0;
            if ((e | 0) == (j | 0)) {
              e = j;
              break
            }
            e = e + -20 | 0
          } while ((c[e >> 2] | 0) != 3);
          c[g >> 2] = f
        }
        j = e + 12 | 0;
        c[g >> 2] = f - (c[j >> 2] | 0);
        c[j >> 2] = 0
      }
      return
    }

    function Fb(b, f) {
      b = b | 0;
      f = f | 0;
      var g = 0,
        h = 0,
        i = 0,
        j = 0;
      g = c[b + 564 >> 2] | 0;
      j = d[f >> 0] | 0;
      b = b + 52 + (j << 5) + 8 | 0;
      if ((c[f + 4 >> 2] | 0) >>> 0 > 63) a[b >> 0] = 1;
      else {
        a[b >> 0] = 0;
        if (g | 0)
          do {
            if (((e[g >> 1] | 0) >>> 8 | 0) == (j | 0)) {
              h = g + 33 | 0;
              do
                if (a[h >> 0] & 2) {
                  b = g + 32 | 0;
                  i = d[b >> 0] | 0;
                  if (!(i & 64)) {
                    if (i & 4 | 0) a[b >> 0] = i ^ 4;
                    c[g + 20 >> 2] = 0;
                    break
                  }
                  b = g + 24 | 0;
                  f = a[b >> 0] | 0;
                  if (!(i & 128)) {
                    if ((f & 255) >= 3) break;
                    a[b >> 0] = 3;
                    f = c[g + 8 >> 2] | 0;
                    i = c[f + 48 >> 2] | 0;
                    c[g + 20 >> 2] = (c[g + 28 >> 2] | 0) > (c[f + 76 >> 2] | 0) ? 0 - i | 0 : i;
                    break
                  } else {
                    if ((f & 255) >= 5) break;
                    a[b >> 0] = 5;
                    f = c[g + 8 >> 2] | 0;
                    i = c[f + 56 >> 2] | 0;
                    c[g + 20 >> 2] = (c[g + 28 >> 2] | 0) > (c[f + 84 >> 2] | 0) ? 0 - i | 0 : i;
                    break
                  }
                }
              while (0);
              a[h >> 0] = 0
            }
            g = c[g + 40 >> 2] | 0
          } while ((g | 0) != 0)
      }
      return
    }

    function Gb(b) {
      b = b | 0;
      var d = 0,
        e = 0,
        f = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0;
      n = 0;
      m = Hc(b) | 0;
      do
        if (!m) d = 0;
        else {
          k = 0;
          d = 0;
          i = 0;
          l = 0;
          f = 0;
          h = 0;
          e = 0;
          a: while (1) {
            j = b + l | 0;
            switch (a[j >> 0] | 0) {
              case 35:
                {
                  g = k;
                  break a
                }
              case 9:
              case 32:
                {
                  if (!i) {
                    g = k;
                    i = 0
                  } else {
                    a[j >> 0] = 0;
                    g = k;
                    i = 0
                  }
                  break
                }
              default:
                if (!i) {
                  if ((k | 0) >= (f | 0)) {
                    f = f + 8 | 0;
                    g = zc(h, f << 2) | 0;
                    if (!g) {
                      n = 8;
                      break a
                    } else {
                      d = g;
                      e = g;
                      h = g
                    }
                  }
                  c[d + (k << 2) >> 2] = j;
                  g = k + 1 | 0;
                  i = 1
                } else g = k
            }
            l = l + 1 | 0;
            if ((l | 0) == (m | 0)) break;
            else k = g
          }
          if ((n | 0) == 8) {
            Hb(9987, 333, 1, 10007, c[($f() | 0) >> 2] | 0);
            d = 0;
            break
          }
          if (g) {
            if ((g | 0) >= (f | 0)) d = zc(e, (g << 2) + 4 | 0) | 0;
            c[d + (g << 2) >> 2] = 0
          }
        }
      while (0);
      return d | 0
    }

    function Hb(b, d, e, f, g) {
      b = b | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      g = g | 0;
      var h = 0,
        i = 0,
        j = 0,
        k = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0;
      p = l;
      l = l + 80 | 0;
      n = p + 48 | 0;
      o = p + 32 | 0;
      m = p + 16 | 0;
      k = p;
      h = e >>> 0 < 18 ? e : 18;
      c[10359] = h;
      Xa(c[10358] | 0);
      i = La(256) | 0;
      j = (f | 0) == 0;
      h = c[392 + (h << 2) >> 2] | 0;
      do
        if (!g)
          if (j) {
            c[k >> 2] = b;
            c[k + 4 >> 2] = d;
            c[k + 8 >> 2] = h;
            de(i, 8324, k) | 0;
            break
          } else {
            c[m >> 2] = b;
            c[m + 4 >> 2] = d;
            c[m + 8 >> 2] = f;
            c[m + 12 >> 2] = h;
            de(i, 8341, m) | 0;
            break
          }
      else {
        e = Ve(g) | 0;
        if (j) {
          c[o >> 2] = b;
          c[o + 4 >> 2] = d;
          c[o + 8 >> 2] = h;
          c[o + 12 >> 2] = e;
          de(i, 8363, o) | 0;
          break
        } else {
          c[n >> 2] = b;
          c[n + 4 >> 2] = d;
          c[n + 8 >> 2] = f;
          c[n + 12 >> 2] = h;
          c[n + 16 >> 2] = e;
          de(i, 8392, n) | 0;
          break
        }
      } while (0);
      a[i + 255 >> 0] = 0;
      c[10358] = i;
      l = p;
      return
    }

    function Ib() {
      var b = 0,
        d = 0,
        e = 0,
        f = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0;
      i = l;
      l = l + 32 | 0;
      h = i + 16 | 0;
      g = i + 8 | 0;
      b = i + 20 | 0;
      if ((c[1849] | 0) >= 0) {
        ge(11827, i) | 0;
        j = c[10500] | 0;
        a[b >> 0] = j;
        f = b + 1 | 0;
        a[f >> 0] = j >>> 8;
        d = b + 2 | 0;
        a[d >> 0] = j >>> 16;
        e = b + 3 | 0;
        a[e >> 0] = j >>> 24;
        ud(c[1849] | 0, 40, 0) | 0;
        if ((Pd(c[1849] | 0, b, 4) | 0) < 0) {
          j = c[1851] | 0;
          c[g >> 2] = Ve(c[($f() | 0) >> 2] | 0) | 0;
          ee(j, 11861, g) | 0
        } else {
          j = (c[10500] | 0) + 36 | 0;
          c[10500] = j;
          a[b >> 0] = j;
          a[f >> 0] = j >>> 8;
          a[d >> 0] = j >>> 16;
          a[e >> 0] = j >>> 24;
          ud(c[1849] | 0, 4, 0) | 0;
          if ((Pd(c[1849] | 0, b, 4) | 0) < 0) {
            j = c[1851] | 0;
            c[h >> 2] = Ve(c[($f() | 0) >> 2] | 0) | 0;
            ee(j, 11861, h) | 0
          }
        }
        sf(10) | 0;
        b = c[1849] | 0;
        if ((b | 0) > -1) $d(b) | 0;
        c[1849] = -1
      }
      l = i;
      return
    }

    function Jb(b) {
      b = b | 0;
      var d = 0,
        e = 0,
        f = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0;
      k = l;
      l = l + 64 | 0;
      j = k + 16 | 0;
      i = k + 8 | 0;
      d = k;
      h = k + 20 | 0;
      e = h;
      f = 11949;
      g = e + 44 | 0;
      do {
        a[e >> 0] = a[f >> 0] | 0;
        e = e + 1 | 0;
        f = f + 1 | 0
      } while ((e | 0) < (g | 0));
      do
        if (!(a[b >> 0] | 0)) b = -1;
        else {
          c[d >> 2] = 436;
          b = mc(b, 578, d) | 0;
          c[1849] = b;
          if ((b | 0) < 0) {
            b = c[1851] | 0;
            c[i >> 2] = Ve(c[($f() | 0) >> 2] | 0) | 0;
            ee(b, 11993, i) | 0;
            b = -1;
            break
          }
          a[h + 24 >> 0] = 68;
          a[h + 25 >> 0] = -84;
          a[h + 28 >> 0] = 16;
          a[h + 29 >> 0] = -79;
          a[h + 30 >> 0] = 2;
          a[h + 31 >> 0] = 0;
          if ((Pd(b, h, 44) | 0) < 0) {
            b = c[1851] | 0;
            c[j >> 2] = Ve(c[($f() | 0) >> 2] | 0) | 0;
            ee(b, 12039, j) | 0;
            $d(c[1849] | 0) | 0;
            c[1849] = -1;
            b = -1;
            break
          } else {
            c[10500] = 0;
            c[10499] = 18;
            b = 0;
            break
          }
        }
      while (0);
      l = k;
      return b | 0
    }

    function Kb(b, d, e) {
      b = b | 0;
      d = d | 0;
      e = e | 0;
      var f = 0,
        g = 0,
        h = 0;
      h = 0;
      g = d;
      a: do
        if (!((g ^ b) & 3)) {
          f = (e | 0) != 0;
          if (f & (g & 3 | 0) != 0)
            do {
              g = a[d >> 0] | 0;
              a[b >> 0] = g;
              if (!(g << 24 >> 24)) break a;
              e = e + -1 | 0;
              d = d + 1 | 0;
              b = b + 1 | 0;
              f = (e | 0) != 0
            } while (f & (d & 3 | 0) != 0);
          if (f) {
            if (a[d >> 0] | 0) {
              b: do
                if (e >>> 0 > 3) {
                  f = d;
                  while (1) {
                    d = c[f >> 2] | 0;
                    if ((d & -2139062144 ^ -2139062144) & d + -16843009 | 0) {
                      d = f;
                      break b
                    }
                    c[b >> 2] = d;
                    e = e + -4 | 0;
                    d = f + 4 | 0;
                    b = b + 4 | 0;
                    if (e >>> 0 > 3) f = d;
                    else break
                  }
                }while (0);h = 11
            }
          } else e = 0
        } else h = 11; while (0);
      c: do
          if ((h | 0) == 11)
            if (!e) e = 0;
            else
              while (1) {
                h = a[d >> 0] | 0;
                a[b >> 0] = h;
                if (!(h << 24 >> 24)) break c;
                e = e + -1 | 0;
                b = b + 1 | 0;
                if (!e) {
                  e = 0;
                  break
                } else d = d + 1 | 0
              }
        while (0);
        Tb(b | 0, 0, e | 0) | 0;
      return b | 0
    }

    function Lb(b, d, e) {
      b = b | 0;
      d = d | 0;
      e = e | 0;
      var f = 0,
        g = 0,
        h = 0,
        i = 0;
      h = d & 255;
      f = (e | 0) != 0;
      a: do
        if (f & (b & 3 | 0) != 0) {
          g = d & 255;
          while (1) {
            if ((a[b >> 0] | 0) == g << 24 >> 24) {
              i = 6;
              break a
            }
            b = b + 1 | 0;
            e = e + -1 | 0;
            f = (e | 0) != 0;
            if (!(f & (b & 3 | 0) != 0)) {
              i = 5;
              break
            }
          }
        } else i = 5; while (0);
      if ((i | 0) == 5)
        if (f) i = 6;
        else e = 0;
      b: do
        if ((i | 0) == 6) {
          g = d & 255;
          if ((a[b >> 0] | 0) != g << 24 >> 24) {
            f = O(h, 16843009) | 0;
            c: do
              if (e >>> 0 > 3)
                while (1) {
                  h = c[b >> 2] ^ f;
                  if ((h & -2139062144 ^ -2139062144) & h + -16843009 | 0) break;
                  b = b + 4 | 0;
                  e = e + -4 | 0;
                  if (e >>> 0 <= 3) {
                    i = 11;
                    break c
                  }
                } else i = 11; while (0);
            if ((i | 0) == 11)
              if (!e) {
                e = 0;
                break
              }
            while (1) {
              if ((a[b >> 0] | 0) == g << 24 >> 24) break b;
              b = b + 1 | 0;
              e = e + -1 | 0;
              if (!e) {
                e = 0;
                break
              }
            }
          }
        }
      while (0);
      return (e | 0 ? b : 0) | 0
    }

    function Mb(a) {
      a = a | 0;
      var b = 0,
        d = 0,
        e = 0;
      e = l;
      l = l + 16 | 0;
      b = e;
      c[b >> 2] = 0;
      do
        if (!(c[10365] | 0)) {
          Hb(10136, 1645, 8, 0, 0);
          a = 0
        } else {
          if (!a) {
            Hb(10136, 1649, 9, 8812, 0);
            a = 0;
            break
          }
          d = jb(a, b) | 0;
          if (!d) a = 0;
          else {
            a = c[b >> 2] | 0;
            if (a >>> 0 < 18) {
              Hb(10136, 1657, 7, 11027, 0);
              a = 0;
              break
            }
            do
              if (!(td(d, 10953, 8) | 0)) a = Va(d, a) | 0;
              else {
                if (!(td(d, 11172, 18) | 0)) {
                  a = Sa(d, a) | 0;
                  break
                }
                if (!(td(d, 10949, 4) | 0)) {
                  a = Wa(d, a) | 0;
                  break
                }
                if (!(td(d, 10150, 4) | 0)) {
                  a = _a(d, a) | 0;
                  break
                } else {
                  a = Ra(d, a) | 0;
                  break
                }
              }
            while (0);
            Xa(d);
            if (a)
              if (ac(a) | 0) {
                Qb(a) | 0;
                a = 0
              }
          }
        }
      while (0);
      l = e;
      return a | 0
    }

    function Nb(b, d, e) {
      b = b | 0;
      d = d | 0;
      e = e | 0;
      var f = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0;
      h = 0;
      f = e + 16 | 0;
      g = c[f >> 2] | 0;
      if (!g)
        if (!(bd(e) | 0)) {
          g = c[f >> 2] | 0;
          h = 5
        } else f = 0;
      else h = 5;
      a: do
        if ((h | 0) == 5) {
          j = e + 20 | 0;
          i = c[j >> 2] | 0;
          f = i;
          if ((g - i | 0) >>> 0 < d >>> 0) {
            f = Ia[c[e + 36 >> 2] & 7](e, b, d) | 0;
            break
          }
          b: do
            if ((a[e + 75 >> 0] | 0) > -1) {
              i = d;
              while (1) {
                if (!i) {
                  h = 0;
                  g = b;
                  break b
                }
                g = i + -1 | 0;
                if ((a[b + g >> 0] | 0) == 10) break;
                else i = g
              }
              f = Ia[c[e + 36 >> 2] & 7](e, b, i) | 0;
              if (f >>> 0 < i >>> 0) break a;
              h = i;
              g = b + i | 0;
              d = d - i | 0;
              f = c[j >> 2] | 0
            } else {
              h = 0;
              g = b
            }
          while (0);
          yb(f | 0, g | 0, d | 0) | 0;
          c[j >> 2] = (c[j >> 2] | 0) + d;
          f = h + d | 0
        }
      while (0);
      return f | 0
    }

    function Ob(e, f, h) {
      e = e | 0;
      f = f | 0;
      h = h | 0;
      var i = 0.0,
        j = 0.0,
        k = 0.0,
        l = 0.0,
        m = 0,
        n = 0.0;
      if (!(a[h + 53 >> 0] | 0)) {
        f = ((f & 255) < 15 ? f : 15) & 255;
        f = e + 52 + (f << 5) | 0;
        m = (d[f + 12 >> 0] | 0) + 192 + (d[f + 13 >> 0] | 0) | 0;
        f = ((O(((O(d[f + 9 >> 0] | 0, d[f + 11 >> 0] | 0) | 0) >>> 0) / 127 | 0, d[h + 2 >> 0] | 0) | 0) >>> 0) / 127 | 0;
        l = +(b[21286] | 0) * .0009765625 * .25;
        m = (m & 128 | 0) == 0 ? m & 255 : 127;
        i = +g[6372 + (127 - m << 2) >> 2];
        k = +g[6372 + (m << 2) >> 2];
        if (!(b[e + 36 >> 1] & 1)) {
          n = +(b[8068 + (f << 1) >> 1] | 0) * .0009765625;
          j = +D(10.0, +(i / 20.0)) * n;
          i = +D(10.0, +(k / 20.0)) * n
        } else {
          n = +g[6884 + (f << 2) >> 2];
          j = +D(10.0, +((i + n) / 20.0));
          i = +D(10.0, +((k + n) / 20.0))
        }
        c[h + 44 >> 2] = ~~(l * j * 1024.0);
        c[h + 48 >> 2] = ~~(l * i * 1024.0)
      }
      return
    }

    function Pb(b, d, e) {
      b = b | 0;
      d = d | 0;
      e = e | 0;
      do
        if (!b) b = 1;
        else {
          if (d >>> 0 < 128) {
            a[b >> 0] = d;
            b = 1;
            break
          }
          if (!(c[c[(Mf() | 0) + 188 >> 2] >> 2] | 0))
            if ((d & -128 | 0) == 57216) {
              a[b >> 0] = d;
              b = 1;
              break
            } else {
              c[($f() | 0) >> 2] = 84;
              b = -1;
              break
            }
          if (d >>> 0 < 2048) {
            a[b >> 0] = d >>> 6 | 192;
            a[b + 1 >> 0] = d & 63 | 128;
            b = 2;
            break
          }
          if (d >>> 0 < 55296 | (d & -8192 | 0) == 57344) {
            a[b >> 0] = d >>> 12 | 224;
            a[b + 1 >> 0] = d >>> 6 & 63 | 128;
            a[b + 2 >> 0] = d & 63 | 128;
            b = 3;
            break
          }
          if ((d + -65536 | 0) >>> 0 < 1048576) {
            a[b >> 0] = d >>> 18 | 240;
            a[b + 1 >> 0] = d >>> 12 & 63 | 128;
            a[b + 2 >> 0] = d >>> 6 & 63 | 128;
            a[b + 3 >> 0] = d & 63 | 128;
            b = 4;
            break
          } else {
            c[($f() | 0) >> 2] = 84;
            b = -1;
            break
          }
        }
      while (0);
      return b | 0
    }

    function Qb(a) {
      a = a | 0;
      var b = 0,
        d = 0,
        e = 0;
      do
        if (!(c[10365] | 0)) {
          Hb(10090, 1597, 8, 0, 0);
          b = -1
        } else {
          if (!a) {
            Hb(10090, 1601, 9, 10105, 0);
            b = -1;
            break
          }
          if (!(c[10367] | 0)) {
            Hb(10090, 1605, 9, 10119, 0);
            b = -1;
            break
          }
          He(a);
          d = c[10367] | 0;
          b = c[d >> 2] | 0;
          a: do
            if ((b | 0) == (a | 0)) {
              b = c[d + 4 >> 2] | 0;
              Xa(d);
              c[10367] = b;
              if (b | 0) c[b + 8 >> 2] = 0
            } else {
              e = d;
              while (1) {
                if ((b | 0) == (a | 0)) break;
                b = c[e + 4 >> 2] | 0;
                if (!b) break a;
                e = b;
                b = c[b >> 2] | 0
              }
              if (e | 0) {
                d = e + 4 | 0;
                b = c[e + 8 >> 2] | 0;
                c[b + 4 >> 2] = c[d >> 2];
                d = c[d >> 2] | 0;
                if (d | 0) c[d + 8 >> 2] = b;
                Xa(e)
              }
            }
          while (0);
          xb(a);
          b = 0
        }
      while (0);
      return b | 0
    }

    function Rb(b, d, e, f) {
      b = b | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      var g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        m = 0,
        n = 0;
      k = 0;
      n = l;
      l = l + 128 | 0;
      g = n + 124 | 0;
      m = n;
      h = m;
      i = 7944;
      j = h + 124 | 0;
      do {
        c[h >> 2] = c[i >> 2];
        h = h + 4 | 0;
        i = i + 4 | 0
      } while ((h | 0) < (j | 0));
      if ((d + -1 | 0) >>> 0 > 2147483646)
        if (!d) {
          b = g;
          d = 1;
          k = 4
        } else {
          c[($f() | 0) >> 2] = 75;
          d = -1
        }
      else k = 4;
      if ((k | 0) == 4) {
        k = -2 - b | 0;
        k = d >>> 0 > k >>> 0 ? k : d;
        c[m + 48 >> 2] = k;
        g = m + 20 | 0;
        c[g >> 2] = b;
        c[m + 44 >> 2] = b;
        d = b + k | 0;
        b = m + 16 | 0;
        c[b >> 2] = d;
        c[m + 28 >> 2] = d;
        d = Ab(m, e, f) | 0;
        if (k) {
          m = c[g >> 2] | 0;
          a[m + (((m | 0) == (c[b >> 2] | 0)) << 31 >> 31) >> 0] = 0
        }
      }
      l = n;
      return d | 0
    }

    function Sb(d, e) {
      d = d | 0;
      e = e | 0;
      var f = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0;
      h = 0;
      i = d + 229948 | 0;
      g = c[i >> 2] | 0;
      j = d + 229944 | 0;
      f = 0;
      while (1) {
        if (f >>> 0 >= g >>> 0) {
          h = 4;
          break
        }
        if ((b[c[(c[j >> 2] | 0) + (f << 2) >> 2] >> 1] | 0) == e << 16 >> 16) break;
        else f = f + 1 | 0
      }
      do
        if ((h | 0) == 4) {
          f = Cc(d, e) | 0;
          if (f | 0) {
            He(41476);
            if (!(a[f + 2 >> 0] | 0))
              if ((fb(f) | 0) == -1) {
                Oe(41476);
                break
              }
            if (!(c[f + 92 >> 2] | 0)) {
              Oe(41476);
              break
            } else {
              h = (c[i >> 2] | 0) + 1 | 0;
              c[i >> 2] = h;
              h = zc(c[j >> 2] | 0, h << 2) | 0;
              c[j >> 2] = h;
              c[h + ((c[i >> 2] | 0) + -1 << 2) >> 2] = f;
              j = f + 88 | 0;
              c[j >> 2] = (c[j >> 2] | 0) + 1;
              Oe(41476);
              break
            }
          }
        }
      while (0);
      return
    }

    function Tb(b, d, e) {
      b = b | 0;
      d = d | 0;
      e = e | 0;
      var f = 0,
        g = 0,
        h = 0,
        i = 0;
      h = b + e | 0;
      d = d & 255;
      if ((e | 0) >= 67) {
        while (b & 3) {
          a[b >> 0] = d;
          b = b + 1 | 0
        }
        f = h & -4 | 0;
        g = f - 64 | 0;
        i = d | d << 8 | d << 16 | d << 24;
        while ((b | 0) <= (g | 0)) {
          c[b >> 2] = i;
          c[b + 4 >> 2] = i;
          c[b + 8 >> 2] = i;
          c[b + 12 >> 2] = i;
          c[b + 16 >> 2] = i;
          c[b + 20 >> 2] = i;
          c[b + 24 >> 2] = i;
          c[b + 28 >> 2] = i;
          c[b + 32 >> 2] = i;
          c[b + 36 >> 2] = i;
          c[b + 40 >> 2] = i;
          c[b + 44 >> 2] = i;
          c[b + 48 >> 2] = i;
          c[b + 52 >> 2] = i;
          c[b + 56 >> 2] = i;
          c[b + 60 >> 2] = i;
          b = b + 64 | 0
        }
        while ((b | 0) < (f | 0)) {
          c[b >> 2] = i;
          b = b + 4 | 0
        }
      }
      while ((b | 0) < (h | 0)) {
        a[b >> 0] = d;
        b = b + 1 | 0
      }
      return h - e | 0
    }

    function Ub(b) {
      b = b | 0;
      var e = 0,
        f = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0;
      f = b + 104 | 0;
      e = c[f >> 2] | 0;
      if (!e) i = 3;
      else if ((c[b + 108 >> 2] | 0) < (e | 0)) i = 3;
      else i = 4;
      if ((i | 0) == 3) {
        e = Sd(b) | 0;
        if ((e | 0) < 0) i = 4;
        else {
          g = c[f >> 2] | 0;
          f = b + 8 | 0;
          if (!g) {
            g = c[f >> 2] | 0;
            f = g
          } else {
            j = c[f >> 2] | 0;
            h = c[b + 4 >> 2] | 0;
            f = g - (c[b + 108 >> 2] | 0) | 0;
            g = j;
            if ((j - h | 0) < (f | 0)) f = g;
            else f = h + (f + -1) | 0
          }
          c[b + 100 >> 2] = f;
          f = b + 4 | 0;
          if (!g) f = c[f >> 2] | 0;
          else {
            f = c[f >> 2] | 0;
            j = b + 108 | 0;
            c[j >> 2] = g + 1 - f + (c[j >> 2] | 0)
          }
          f = f + -1 | 0;
          if ((e | 0) != (d[f >> 0] | 0 | 0)) a[f >> 0] = e
        }
      }
      if ((i | 0) == 4) {
        c[b + 100 >> 2] = 0;
        e = -1
      }
      return e | 0
    }

    function Vb(a) {
      a = a | 0;
      var b = 0,
        d = 0,
        e = 0;
      d = a + 2504 | 0;
      e = a + 2496 | 0;
      b = 0;
      while (1) {
        if ((b | 0) >= (c[d >> 2] | 0)) break;
        c[(c[e >> 2] | 0) + (b << 2) >> 2] = 0;
        b = b + 1 | 0
      }
      d = a + 2508 | 0;
      e = a + 2500 | 0;
      b = 0;
      while (1) {
        if ((b | 0) >= (c[d >> 2] | 0)) {
          b = 0;
          break
        }
        c[(c[e >> 2] | 0) + (b << 2) >> 2] = 0;
        b = b + 1 | 0
      }
      while (1) {
        if ((b | 0) == 8) break;
        else e = 0;
        while (1) {
          if ((e | 0) == 6) break;
          else d = 0;
          while (1) {
            if ((d | 0) == 2) break;
            c[a + (b * 48 | 0) + (e << 3) + (d << 2) >> 2] = 0;
            c[a + 384 + (b * 48 | 0) + (e << 3) + (d << 2) >> 2] = 0;
            c[a + 768 + (b * 48 | 0) + (e << 3) + (d << 2) >> 2] = 0;
            c[a + 1152 + (b * 48 | 0) + (e << 3) + (d << 2) >> 2] = 0;
            d = d + 1 | 0
          }
          e = e + 1 | 0
        }
        b = b + 1 | 0
      }
      return
    }

    function Wb(e, f) {
      e = e | 0;
      f = f | 0;
      var g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0;
      i = c[f >> 2] | 0;
      j = e + i | 0;
      k = i >>> 1;
      h = Ed(k + 2 | 0, 2) | 0;
      c[f + 96 >> 2] = h;
      if (!h) {
        Hb(10602, 637, 1, 10546, c[($f() | 0) >> 2] | 0);
        e = -1
      } else {
        g = e;
        e = h + (k << 1) | 0;
        do {
          e = e + -2 | 0;
          h = g;
          g = g + 2 | 0;
          b[e >> 1] = ((a[h + 1 >> 0] ^ -128) & 255) << 8 | (d[h >> 0] | 0)
        } while (g >>> 0 < j >>> 0);
        e = f + 8 | 0;
        h = f + 4 | 0;
        j = i - (c[h >> 2] | 0) | 0;
        i = i - (c[e >> 2] | 0) | 0;
        g = f + 16 | 0;
        l = d[g >> 0] | 0;
        a[g >> 0] = l << 4 | l >>> 4;
        c[h >> 2] = i >>> 1;
        c[e >> 2] = j >>> 1;
        c[f >> 2] = k;
        e = f + 32 | 0;
        a[e >> 0] = a[e >> 0] ^ 18;
        e = 0
      }
      return e | 0
    }

    function Xb(e, f) {
      e = e | 0;
      f = f | 0;
      var g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0;
      i = c[f >> 2] | 0;
      j = e + i | 0;
      k = i >>> 1;
      h = Ed(k + 2 | 0, 2) | 0;
      c[f + 96 >> 2] = h;
      if (!h) {
        Hb(10627, 468, 1, 10546, c[($f() | 0) >> 2] | 0);
        e = -1
      } else {
        g = e;
        e = h + (k << 1) | 0;
        do {
          e = e + -2 | 0;
          h = g;
          g = g + 2 | 0;
          b[e >> 1] = (d[h + 1 >> 0] | 0) << 8 | (d[h >> 0] | 0)
        } while (g >>> 0 < j >>> 0);
        e = f + 8 | 0;
        h = f + 4 | 0;
        j = i - (c[h >> 2] | 0) | 0;
        i = i - (c[e >> 2] | 0) | 0;
        g = f + 16 | 0;
        l = d[g >> 0] | 0;
        a[g >> 0] = l << 4 | l >>> 4;
        c[h >> 2] = i >>> 1;
        c[e >> 2] = j >>> 1;
        c[f >> 2] = k;
        e = f + 32 | 0;
        a[e >> 0] = a[e >> 0] ^ 16;
        e = 0
      }
      return e | 0
    }

    function Yb(b) {
      b = b | 0;
      var e = 0,
        f = 0,
        g = 0;
      a[b + 52 >> 0] = 0;
      e = b + 32 | 0;
      g = d[e >> 0] | 0;
      do
        if (!(g & 64)) {
          if (g & 4 | 0) a[e >> 0] = g ^ 4;
          c[b + 20 >> 2] = 0
        } else {
          e = b + 33 | 0;
          f = a[e >> 0] | 0;
          if (f << 24 >> 24) {
            a[e >> 0] = f | 2;
            break
          }
          e = b + 24 | 0;
          f = a[e >> 0] | 0;
          if (!(g & 128)) {
            if ((f & 255) >= 3) break;
            a[e >> 0] = 3;
            f = c[b + 8 >> 2] | 0;
            g = c[f + 48 >> 2] | 0;
            c[b + 20 >> 2] = (c[b + 28 >> 2] | 0) > (c[f + 76 >> 2] | 0) ? 0 - g | 0 : g;
            break
          } else {
            if ((f & 255) >= 5) break;
            a[e >> 0] = 5;
            f = c[b + 8 >> 2] | 0;
            g = c[f + 56 >> 2] | 0;
            c[b + 20 >> 2] = (c[b + 28 >> 2] | 0) > (c[f + 84 >> 2] | 0) ? 0 - g | 0 : g;
            break
          }
        }
      while (0);
      return
    }

    function Zb(b, d) {
      b = b | 0;
      d = d | 0;
      var e = 0,
        f = 0,
        g = 0,
        h = 0,
        i = 0;
      i = 0;
      if ((c[d + 76 >> 2] | 0) < 0) i = 3;
      else if (!(Xf(d) | 0)) i = 3;
      else {
        f = b & 255;
        e = b & 255;
        if ((e | 0) == (a[d + 75 >> 0] | 0)) i = 10;
        else {
          g = d + 20 | 0;
          h = c[g >> 2] | 0;
          if (h >>> 0 < (c[d + 16 >> 2] | 0) >>> 0) {
            c[g >> 2] = h + 1;
            a[h >> 0] = f
          } else i = 10
        }
        if ((i | 0) == 10) e = ic(d, b) | 0;
        Wf(d)
      }
      do
        if ((i | 0) == 3) {
          h = b & 255;
          e = b & 255;
          if ((e | 0) != (a[d + 75 >> 0] | 0)) {
            f = d + 20 | 0;
            g = c[f >> 2] | 0;
            if (g >>> 0 < (c[d + 16 >> 2] | 0) >>> 0) {
              c[f >> 2] = g + 1;
              a[g >> 0] = h;
              break
            }
          }
          e = ic(d, b) | 0
        }
      while (0);
      return e | 0
    }

    function _b(b, d) {
      b = b | 0;
      d = d | 0;
      var e = 0,
        f = 0;
      f = 0;
      e = d;
      a: do
        if (!((e ^ b) & 3)) {
          if (e & 3)
            do {
              e = a[d >> 0] | 0;
              a[b >> 0] = e;
              if (!(e << 24 >> 24)) break a;
              d = d + 1 | 0;
              b = b + 1 | 0
            } while ((d & 3 | 0) != 0);
          e = c[d >> 2] | 0;
          if (!((e & -2139062144 ^ -2139062144) & e + -16843009)) {
            f = b;
            while (1) {
              d = d + 4 | 0;
              b = f + 4 | 0;
              c[f >> 2] = e;
              e = c[d >> 2] | 0;
              if ((e & -2139062144 ^ -2139062144) & e + -16843009 | 0) break;
              else f = b
            }
          }
          f = 8
        } else f = 8; while (0);
      if ((f | 0) == 8) {
        f = a[d >> 0] | 0;
        a[b >> 0] = f;
        if (f << 24 >> 24)
          do {
            d = d + 1 | 0;
            b = b + 1 | 0;
            f = a[d >> 0] | 0;
            a[b >> 0] = f
          } while (f << 24 >> 24 != 0)
      }
      return b | 0
    }

    function $b(a, d, f) {
      a = a | 0;
      d = d | 0;
      f = f | 0;
      var g = 0,
        h = 0;
      do
        if (!(c[10365] | 0)) {
          Hb(10292, 1977, 8, 0, 0);
          a = -1
        } else {
          if (!a) {
            Hb(10292, 1981, 9, 10105, 0);
            a = -1;
            break
          }
          He(a);
          g = d & 65535;
          if (!((g & 32783 | 0) != 0 & (g & 32752 | 0) == 0)) {
            Hb(10292, 1988, 9, 8869, 0);
            Oe(a);
            a = -1;
            break
          }
          if (f & 32752) {
            Hb(10292, 1993, 9, 10311, 0);
            Oe(a);
            a = -1;
            break
          }
          h = a + 36 | 0;
          b[h >> 1] = (g ^ 33023) & (e[h >> 1] | 0) | f & d & 65535;
          if (!(g & 1)) {
            if (g & 4 | 0) Vb(c[a + 229964 >> 2] | 0)
          } else Bc(a, 16);
          Oe(a);
          a = 0
        }
      while (0);
      return a | 0
    }

    function ac(a) {
      a = a | 0;
      var b = 0,
        d = 0;
      b = c[10367] | 0;
      do
        if (!b) {
          b = La(12) | 0;
          c[10367] = b;
          if (!b) {
            Hb(10154, 782, 1, 10165, c[($f() | 0) >> 2] | 0);
            b = -1;
            break
          } else {
            c[b >> 2] = a;
            c[b + 8 >> 2] = 0;
            c[b + 4 >> 2] = 0;
            b = 0;
            break
          }
        } else {
          d = c[b + 4 >> 2] | 0;
          a: do
              if (d)
                while (1) {
                  if (!d) break a;
                  b = d;
                  d = c[d + 4 >> 2] | 0
                }
            while (0);
            d = La(12) | 0;
          c[b + 4 >> 2] = d;
          if (!d) {
            Hb(10154, 796, 1, 10165, c[($f() | 0) >> 2] | 0);
            b = -1;
            break
          } else {
            c[d + 8 >> 2] = b;
            c[d + 4 >> 2] = 0;
            c[d >> 2] = a;
            b = 0;
            break
          }
        }
      while (0);
      return b | 0
    }

    function bc(e, f) {
      e = e | 0;
      f = f | 0;
      var g = 0,
        h = 0,
        i = 0,
        j = 0;
      i = c[f >> 2] | 0;
      j = e + i | 0;
      h = Ed(i + 2 | 0, 2) | 0;
      c[f + 96 >> 2] = h;
      if (!h) {
        Hb(10615, 304, 1, 10546, c[($f() | 0) >> 2] | 0);
        e = -1
      } else {
        g = e;
        e = h + (i << 1) | 0;
        do {
          e = e + -2 | 0;
          h = g;
          g = g + 1 | 0;
          b[e >> 1] = ((a[h >> 0] ^ -128) & 255) << 8
        } while ((g | 0) != (j | 0));
        h = f + 8 | 0;
        j = c[h >> 2] | 0;
        e = f + 4 | 0;
        c[h >> 2] = i - (c[e >> 2] | 0);
        c[e >> 2] = i - j;
        e = f + 16 | 0;
        j = d[e >> 0] | 0;
        a[e >> 0] = j << 4 | j >>> 4;
        e = f + 32 | 0;
        a[e >> 0] = a[e >> 0] ^ 18;
        e = 0
      }
      return e | 0
    }

    function cc(e, f) {
      e = e | 0;
      f = f | 0;
      var g = 0,
        h = 0,
        i = 0,
        j = 0;
      i = c[f >> 2] | 0;
      j = e + i | 0;
      h = Ed(i + 2 | 0, 2) | 0;
      c[f + 96 >> 2] = h;
      if (!h) {
        Hb(10640, 155, 1, 10546, c[($f() | 0) >> 2] | 0);
        e = -1
      } else {
        g = e;
        e = h + (i << 1) | 0;
        do {
          e = e + -2 | 0;
          h = g;
          g = g + 1 | 0;
          b[e >> 1] = (d[h >> 0] | 0) << 8
        } while ((g | 0) != (j | 0));
        h = f + 8 | 0;
        j = c[h >> 2] | 0;
        e = f + 4 | 0;
        c[h >> 2] = i - (c[e >> 2] | 0);
        c[e >> 2] = i - j;
        e = f + 16 | 0;
        j = d[e >> 0] | 0;
        a[e >> 0] = j << 4 | j >>> 4;
        e = f + 32 | 0;
        a[e >> 0] = a[e >> 0] ^ 16;
        e = 0
      }
      return e | 0
    }

    function dc(b, f) {
      b = b | 0;
      f = f | 0;
      var g = 0,
        h = 0,
        i = 0;
      g = c[b + 564 >> 2] | 0;
      h = d[f >> 0] | 0;
      if (!((g | 0) == 0 ? 1 : (a[b + 52 + (h << 5) + 31 >> 0] | 0) != 0))
        do {
          do
            if (((e[g >> 1] | 0) >>> 8 | 0) == (h | 0)) {
              f = g + 33 | 0;
              b = a[f >> 0] | 0;
              if (b << 24 >> 24) {
                a[f >> 0] = b | 2;
                break
              }
              if (a[g + 32 >> 0] & 64) {
                f = g + 24 | 0;
                if ((d[f >> 0] | 0) < 5) {
                  i = c[g + 8 >> 2] | 0;
                  b = c[i + 56 >> 2] | 0;
                  c[g + 20 >> 2] = (c[g + 28 >> 2] | 0) > (c[i + 84 >> 2] | 0) ? 0 - b | 0 : b;
                  a[f >> 0] = 5
                }
              }
            }
          while (0);
          g = c[g + 40 >> 2] | 0
        } while ((g | 0) != 0);
      return
    }

    function ec(a, b) {
      a = a | 0;
      b = b | 0;
      var d = 0,
        e = 0;
      He(41476);
      do
        if (!a) {
          Oe(41476);
          a = 0
        } else {
          a = a + 92 | 0;
          d = c[a >> 2] | 0;
          if (!d) {
            Oe(41476);
            a = 0;
            break
          }
          if (!b) {
            Oe(41476);
            a = c[a >> 2] | 0;
            break
          } else {
            a = d;
            e = d
          }
          while (1) {
            if (!e) {
              d = 12;
              break
            }
            if ((c[e + 20 >> 2] | 0) >>> 0 < b >>> 0)
              if ((c[e + 24 >> 2] | 0) >>> 0 > b >>> 0) {
                d = 10;
                break
              } else a = e;
            e = c[e + 100 >> 2] | 0
          }
          if ((d | 0) == 10) {
            Oe(41476);
            a = e;
            break
          } else if ((d | 0) == 12) {
            Oe(41476);
            break
          }
        }
      while (0);
      return a | 0
    }

    function fc(a, d, e) {
      a = a | 0;
      d = d | 0;
      e = e | 0;
      do
        if (!(c[10365] | 0)) {
          if (!a) {
            Hb(8828, 1543, 9, 8842, 0);
            a = -1;
            break
          }
          ue();
          if ((Bf(a) | 0) == -1) a = -1;
          else {
            if (e & 4080) {
              Hb(8828, 1553, 9, 8869, 0);
              qc();
              a = -1;
              break
            }
            b[21284] = e;
            if ((d & 65535) < 11025) {
              Hb(8828, 1561, 9, 8886, 0);
              qc();
              a = -1;
              break
            } else {
              b[21285] = d;
              c[10366] = 0;
              c[10369] = 0;
              b[21286] = 948;
              c[10365] = 1;
              a = 0;
              break
            }
          }
        } else {
          Hb(8828, 1538, 10, 0, 0);
          a = -1
        }
      while (0);
      return a | 0
    }

    function gc(b) {
      b = b | 0;
      var e = 0,
        f = 0,
        g = 0,
        h = 0;
      e = b + 564 | 0;
      h = 0;
      while (1) {
        g = c[e >> 2] | 0;
        if (!g) break;
        e = g + 32 | 0;
        f = d[e >> 0] | 0;
        if (!(f & 64)) {
          if (f & 4 | 0) a[e >> 0] = f ^ 4;
          f = (c[c[g + 8 >> 2] >> 2] | 0) - (c[g + 12 >> 2] | 0) | 0
        } else {
          f = g + 24 | 0;
          e = a[f >> 0] | 0;
          if ((e & 255) < 4) {
            a[f >> 0] = 4;
            e = 4
          }
          f = c[(c[g + 8 >> 2] | 0) + 36 + ((e & 255) << 2) >> 2] | 0;
          c[g + 20 >> 2] = 0 - f;
          f = (c[g + 28 >> 2] | 0) / (f | 0) | 0
        }
        c[g + 36 >> 2] = 0;
        e = g + 40 | 0;
        h = f >>> 0 > h >>> 0 ? f : h
      }
      c[b + 4 >> 2] = h;
      return
    }

    function hc(b, e, f) {
      b = b | 0;
      e = e | 0;
      f = f | 0;
      var g = 0,
        h = 0,
        i = 0,
        j = 0;
      Ld(b);
      j = b + 8 | 0;
      h = c[j >> 2] | 0;
      g = b + 16 | 0;
      i = c[g >> 2] | 0;
      i = h + (i * 20 | 0) | 0;
      c[i >> 2] = 32;
      a[i + 4 >> 0] = e;
      h = f & 255;
      c[i + 8 >> 2] = h;
      i = c[g >> 2] | 0;
      c[(c[j >> 2] | 0) + (i * 20 | 0) + 12 >> 2] = 0;
      c[g >> 2] = i + 1;
      e = e & 255;
      g = b + 52 + (e << 5) | 0;
      if (!(a[b + 52 + (e << 5) + 31 >> 0] | 0)) {
        Sb(b, (d[g >> 0] << 8 | h) & 65535);
        c[b + 52 + (e << 5) + 4 >> 2] = Cc(b, (d[g >> 0] << 8 | h) & 65535) | 0
      } else a[g >> 0] = f;
      return
    }

    function ic(b, e) {
      b = b | 0;
      e = e | 0;
      var f = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        m = 0;
      h = 0;
      m = l;
      l = l + 16 | 0;
      j = m;
      k = e & 255;
      a[j >> 0] = k;
      f = b + 16 | 0;
      g = c[f >> 2] | 0;
      if (!g)
        if (!(bd(b) | 0)) {
          g = c[f >> 2] | 0;
          h = 4
        } else f = -1;
      else h = 4;
      do
        if ((h | 0) == 4) {
          i = b + 20 | 0;
          h = c[i >> 2] | 0;
          if (h >>> 0 < g >>> 0) {
            f = e & 255;
            if ((f | 0) != (a[b + 75 >> 0] | 0)) {
              c[i >> 2] = h + 1;
              a[h >> 0] = k;
              break
            }
          }
          if ((Ia[c[b + 36 >> 2] & 7](b, j, 1) | 0) == 1) f = d[j >> 0] | 0;
          else f = -1
        }
      while (0);
      l = m;
      return f | 0
    }

    function jc(e, f) {
      e = e | 0;
      f = f | 0;
      var g = 0,
        h = 0,
        i = 0;
      i = c[f >> 2] | 0;
      h = e + i | 0;
      i = i >>> 1;
      g = Ed(i + 2 | 0, 2) | 0;
      c[f + 96 >> 2] = g;
      if (!g) {
        Hb(10702, 547, 1, 10546, c[($f() | 0) >> 2] | 0);
        e = -1
      } else {
        while (1) {
          b[g >> 1] = ((a[e + 1 >> 0] ^ -128) & 255) << 8 | (d[e >> 0] | 0);
          e = e + 2 | 0;
          if (e >>> 0 >= h >>> 0) break;
          else g = g + 2 | 0
        }
        e = f + 4 | 0;
        c[e >> 2] = (c[e >> 2] | 0) >>> 1;
        e = f + 8 | 0;
        c[e >> 2] = (c[e >> 2] | 0) >>> 1;
        c[f >> 2] = i;
        e = f + 32 | 0;
        a[e >> 0] = a[e >> 0] ^ 2;
        e = 0
      }
      return e | 0
    }

    function kc(b, d) {
      b = b | 0;
      d = d | 0;
      var e = 0,
        f = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0;
      i = 0;
      j = a[d >> 0] | 0;
      f = j & 255;
      h = d + 4 | 0;
      g = c[h >> 2] | 0;
      e = g >>> 8;
      d = b + 568 + (f * 7168 | 0) + (e * 56 | 0) | 0;
      if (!(a[b + 568 + (f * 7168 | 0) + (e * 56 | 0) + 34 >> 0] | 0)) {
        if (a[b + 115256 + (f * 7168 | 0) + (e * 56 | 0) + 34 >> 0] | 0) {
          d = b + 115256 + (f * 7168 | 0) + (e * 56 | 0) | 0;
          i = 3
        }
      } else i = 3;
      if ((i | 0) == 3) {
        a[d + 2 >> 0] = g;
        Ob(b, j, d);
        d = c[d + 36 >> 2] | 0;
        if (d | 0) {
          a[d + 2 >> 0] = c[h >> 2];
          Ob(b, j, d)
        }
      }
      return
    }

    function lc(b, e) {
      b = b | 0;
      e = e | 0;
      var f = 0,
        g = 0,
        h = 0;
      g = 0;
      h = d[e >> 0] | 0;
      e = (c[e + 4 >> 2] | 0) >>> 8;
      f = b + 568 + (h * 7168 | 0) + (e * 56 | 0) | 0;
      if (!(a[b + 568 + (h * 7168 | 0) + (e * 56 | 0) + 34 >> 0] | 0)) {
        if (a[b + 115256 + (h * 7168 | 0) + (e * 56 | 0) + 34 >> 0] | 0) {
          f = b + 115256 + (h * 7168 | 0) + (e * 56 | 0) | 0;
          g = 3
        }
      } else g = 3;
      do
        if ((g | 0) == 3) {
          e = a[f + 32 >> 0] | 0;
          if (!((e & 4) == 0 ? (a[b + 52 + (h << 5) + 31 >> 0] | 0) != 0 : 0)) {
            if (e & 64)
              if (!(a[f + 24 >> 0] | 0)) {
                a[f + 52 >> 0] = 1;
                break
              }
            Yb(f)
          }
        }
      while (0);
      return
    }

    function mc(a, b, d) {
      a = a | 0;
      b = b | 0;
      d = d | 0;
      var e = 0,
        f = 0,
        g = 0,
        h = 0,
        i = 0;
      h = l;
      l = l + 48 | 0;
      g = h + 16 | 0;
      f = h;
      e = h + 32 | 0;
      if (!(b & 4194368)) e = 0;
      else {
        c[e >> 2] = d;
        i = (c[e >> 2] | 0) + (4 - 1) & ~(4 - 1);
        d = c[i >> 2] | 0;
        c[e >> 2] = i + 4;
        e = d
      }
      c[f >> 2] = a;
      c[f + 4 >> 2] = b | 32768;
      c[f + 8 >> 2] = e;
      e = ka(5, f | 0) | 0;
      if (!((b & 524288 | 0) == 0 | (e | 0) < 0)) {
        c[g >> 2] = e;
        c[g + 4 >> 2] = 2;
        c[g + 8 >> 2] = 1;
        ha(221, g | 0) | 0
      }
      i = De(e) | 0;
      l = h;
      return i | 0
    }

    function nc(b) {
      b = b | 0;
      var c = 0,
        d = 0,
        e = 0,
        f = 0,
        g = 0,
        h = 0;
      g = 0;
      while (1) {
        e = a[b >> 0] | 0;
        c = e << 24 >> 24;
        f = b + 1 | 0;
        if (!(df(c) | 0)) break;
        else b = f
      }
      switch (c | 0) {
        case 45:
          {
            b = 1;g = 5;
            break
          }
        case 43:
          {
            b = 0;g = 5;
            break
          }
        default:
          {
            h = 0;d = b;b = e
          }
      }
      if ((g | 0) == 5) {
        h = b;
        d = f;
        b = a[f >> 0] | 0
      }
      c = (b << 24 >> 24) + -48 | 0;
      if (c >>> 0 < 10) {
        b = 0;
        do {
          d = d + 1 | 0;
          b = (b * 10 | 0) - c | 0;
          c = (a[d >> 0] | 0) + -48 | 0
        } while (c >>> 0 < 10)
      } else b = 0;
      return (h | 0 ? b : 0 - b | 0) | 0
    }

    function oc(a, b) {
      a = +a;
      b = b | 0;
      var d = 0,
        e = 0;
      if ((b | 0) > 1023) {
        a = a * 8988465674311579538646525.0e283;
        e = (b | 0) > 2046;
        d = b + -2046 | 0;
        a = e ? a * 8988465674311579538646525.0e283 : a;
        b = e ? ((d | 0) < 1023 ? d : 1023) : b + -1023 | 0
      } else if ((b | 0) < -1022) {
        a = a * 2.2250738585072014e-308;
        d = (b | 0) < -2044;
        e = b + 2044 | 0;
        a = d ? a * 2.2250738585072014e-308 : a;
        b = d ? ((e | 0) > -1022 ? e : -1022) : b + 1022 | 0
      }
      d = je(b + 1023 | 0, 0, 52) | 0;
      e = z;
      c[j >> 2] = d;
      c[j + 4 >> 2] = e;
      return +(a * +h[j >> 3])
    }

    function pc(a, d, e) {
      a = a | 0;
      d = d | 0;
      e = e | 0;
      do
        if ((c[10365] | 0) == 1) {
          if (!a) {
            Hb(10224, 1934, 9, 10105, 0);
            a = -1;
            break
          }
          if (!d) {
            Hb(10224, 1938, 9, 10243, 0);
            a = -1;
            break
          }
          if (!e) a = 0;
          else {
            if (e & 3 | 0) {
              Hb(10224, 1945, 9, 10265, 0);
              a = -1;
              break
            }
            if (!(b[a + 36 >> 1] & 2)) {
              a = Ua(a, d, e) | 0;
              break
            }
            if (!(c[10368] | 0)) pb();
            a = Ta(a, d, e) | 0
          }
        } else {
          Hb(10224, 1930, 8, 0, 0);
          a = -1
        }
      while (0);
      return a | 0
    }

    function qc() {
      var a = 0,
        b = 0,
        d = 0,
        e = 0;
      He(41476);
      d = 0;
      while (1) {
        if ((d | 0) == 128) break;
        e = 41480 + (d << 2) | 0;
        a = c[e >> 2] | 0;
        while (1) {
          if (!a) break;
          while (1) {
            b = c[a + 92 >> 2] | 0;
            if (!b) break;
            a = c[b + 100 >> 2] | 0;
            Xa(c[b + 96 >> 2] | 0);
            Xa(c[(c[e >> 2] | 0) + 92 >> 2] | 0);
            c[(c[e >> 2] | 0) + 92 >> 2] = a;
            a = c[e >> 2] | 0
          }
          Xa(c[a + 4 >> 2] | 0);
          b = c[e >> 2] | 0;
          a = c[b + 96 >> 2] | 0;
          Xa(b);
          c[e >> 2] = a
        }
        d = d + 1 | 0
      }
      Oe(41476);
      return
    }

    function rc(a, e) {
      a = a | 0;
      e = e | 0;
      var f = 0,
        g = 0,
        h = 0;
      h = c[e >> 2] | 0;
      g = a + h | 0;
      h = h >>> 1;
      f = Ed(h + 2 | 0, 2) | 0;
      c[e + 96 >> 2] = f;
      if (!f) {
        Hb(10725, 378, 1, 10546, c[($f() | 0) >> 2] | 0);
        a = -1
      } else {
        while (1) {
          b[f >> 1] = (d[a + 1 >> 0] | 0) << 8 | (d[a >> 0] | 0);
          a = a + 2 | 0;
          if (a >>> 0 >= g >>> 0) break;
          else f = f + 2 | 0
        }
        a = e + 4 | 0;
        c[a >> 2] = (c[a >> 2] | 0) >>> 1;
        a = e + 8 | 0;
        c[a >> 2] = (c[a >> 2] | 0) >>> 1;
        c[e >> 2] = h;
        a = 0
      }
      return a | 0
    }

    function sc(d, e) {
      d = d | 0;
      e = e | 0;
      var f = 0,
        g = 0;
      e = 0;
      while (1) {
        if ((e | 0) == 16) break;
        a[d + 52 + (e << 5) >> 0] = 0;
        if ((e | 0) == 9) f = 0;
        else f = Cc(d, 0) | 0;
        g = d + 52 + (e << 5) | 0;
        c[g + 4 >> 2] = f;
        a[g + 8 >> 0] = 0;
        a[g + 9 >> 0] = 100;
        a[g + 10 >> 0] = 127;
        a[g + 11 >> 0] = 127;
        a[g + 12 >> 0] = 64;
        a[g + 13 >> 0] = 64;
        b[g + 18 >> 1] = 0;
        b[g + 20 >> 1] = 200;
        b[g + 28 >> 1] = -1;
        a[g + 31 >> 0] = 0;
        e = e + 1 | 0
      }
      Bc(d, 16);
      a[d + 371 >> 0] = 1;
      return
    }

    function tc(a, b) {
      a = +a;
      b = b | 0;
      var d = 0,
        e = 0,
        f = 0;
      h[j >> 3] = a;
      d = c[j >> 2] | 0;
      e = c[j + 4 >> 2] | 0;
      f = me(d | 0, e | 0, 52) | 0;
      switch (f & 2047) {
        case 0:
          {
            if (a != 0.0) {
              a = +tc(a * 18446744073709551616.0, b);
              d = (c[b >> 2] | 0) + -64 | 0
            } else d = 0;c[b >> 2] = d;
            break
          }
        case 2047:
          break;
        default:
          {
            c[b >> 2] = (f & 2047) + -1022;c[j >> 2] = d;c[j + 4 >> 2] = e & -2146435073 | 1071644672;a = +h[j >> 3]
          }
      }
      return +a
    }

    function uc(b, e, f, g) {
      b = b | 0;
      e = e | 0;
      f = f | 0;
      g = g | 0;
      var h = 0,
        i = 0,
        j = 0,
        k = 0;
      Ld(b);
      j = b + 8 | 0;
      h = c[j >> 2] | 0;
      i = b + 16 | 0;
      k = c[i >> 2] | 0;
      k = h + (k * 20 | 0) | 0;
      c[k >> 2] = 2;
      a[k + 4 >> 0] = e;
      h = f & 127;
      c[k + 8 >> 2] = h << 8 | g & 255;
      f = c[i >> 2] | 0;
      c[(c[j >> 2] | 0) + (f * 20 | 0) + 12 >> 2] = 0;
      c[i >> 2] = f + 1;
      f = e & 255;
      if (a[b + 52 + (f << 5) + 31 >> 0] | 0) Sb(b, (d[b + 52 + (f << 5) >> 0] << 8 | h | 128) & 65535);
      return
    }

    function vc() {
      var d = 0,
        e = 0;
      d = La(230008) | 0;
      Tb(d | 0, 0, 230008) | 0;
      b[d + 36 >> 1] = b[21284] | 0;
      Sb(d, 0);
      c[d + 20 >> 2] = 8192;
      e = La(163840) | 0;
      c[d + 8 >> 2] = e;
      c[d + 16 >> 2] = 0;
      c[d + 12 >> 2] = e;
      c[d + 4 >> 2] = 0;
      c[d + 28 >> 2] = 0;
      c[d + 40 >> 2] = 0;
      c[d + 32 >> 2] = 0;
      h[d + 229984 >> 3] = 1.0;
      h[d + 229976 >> 3] = 0.0;
      c[d + 229968 >> 2] = 0;
      h[d + 229992 >> 3] = 1.0;
      a[d + 23e4 >> 0] = 0;
      c[d + 230004 >> 2] = 0;
      sc(d, 0);
      return d | 0
    }

    function wc(b, d) {
      b = b | 0;
      d = d | 0;
      var f = 0,
        g = 0,
        h = 0,
        i = 0;
      i = a[d >> 0] | 0;
      f = c[b + 564 >> 2] | 0;
      g = d + 4 | 0;
      h = i & 255;
      a[b + 52 + (h << 5) + 10 >> 0] = c[g >> 2];
      d = f;
      while (1) {
        if (!d) break;
        if (!(a[d + 53 >> 0] | 0))
          if (((e[d >> 1] | 0) >>> 8 | 0) == (h | 0)) {
            a[d + 2 >> 0] = c[g >> 2];
            Ob(b, i, d);
            f = c[d + 36 >> 2] | 0;
            if (f | 0) {
              a[f + 2 >> 0] = c[g >> 2];
              Ob(b, i, f)
            }
          }
        d = c[d + 40 >> 2] | 0
      }
      return
    }

    function xc(a, b, d) {
      a = a | 0;
      b = b | 0;
      d = d | 0;
      var e = 0.0,
        f = 0,
        g = 0,
        h = 0,
        i = 0;
      i = l;
      l = l + 128 | 0;
      h = i;
      f = h;
      g = f + 124 | 0;
      do {
        c[f >> 2] = 0;
        f = f + 4 | 0
      } while ((f | 0) < (g | 0));
      f = h + 4 | 0;
      c[f >> 2] = a;
      g = h + 8 | 0;
      c[g >> 2] = -1;
      c[h + 44 >> 2] = a;
      c[h + 76 >> 2] = -1;
      Od(h, 0);
      e = +bb(h, d, 1);
      d = (c[f >> 2] | 0) - (c[g >> 2] | 0) + (c[h + 108 >> 2] | 0) | 0;
      if (b | 0) c[b >> 2] = d | 0 ? a + d | 0 : a;
      l = i;
      return +e
    }

    function yc(b) {
      b = b | 0;
      var d = 0,
        e = 0;
      d = b + 74 | 0;
      e = a[d >> 0] | 0;
      a[d >> 0] = e + 255 | e;
      d = b + 20 | 0;
      e = b + 28 | 0;
      if ((c[d >> 2] | 0) >>> 0 > (c[e >> 2] | 0) >>> 0) Ia[c[b + 36 >> 2] & 7](b, 0, 0) | 0;
      c[b + 16 >> 2] = 0;
      c[e >> 2] = 0;
      c[d >> 2] = 0;
      d = c[b >> 2] | 0;
      if (!(d & 4)) {
        e = (c[b + 44 >> 2] | 0) + (c[b + 48 >> 2] | 0) | 0;
        c[b + 8 >> 2] = e;
        c[b + 4 >> 2] = e;
        d = d << 27 >> 31
      } else {
        c[b >> 2] = d | 32;
        d = -1
      }
      return d | 0
    }

    function zc(a, b) {
      a = a | 0;
      b = b | 0;
      var d = 0,
        e = 0;
      if (!a) {
        b = La(b) | 0;
        return b | 0
      }
      if (b >>> 0 > 4294967231) {
        c[($f() | 0) >> 2] = 12;
        b = 0;
        return b | 0
      }
      d = eb(a + -8 | 0, b >>> 0 < 11 ? 16 : b + 11 & -8) | 0;
      if (d | 0) {
        b = d + 8 | 0;
        return b | 0
      }
      d = La(b) | 0;
      if (!d) {
        b = 0;
        return b | 0
      }
      e = c[a + -4 >> 2] | 0;
      e = (e & -8) - ((e & 3 | 0) == 0 ? 8 : 4) | 0;
      yb(d | 0, a | 0, (e >>> 0 < b >>> 0 ? e : b) | 0) | 0;
      Xa(a);
      b = d;
      return b | 0
    }

    function Ac(b, c, d) {
      b = b | 0;
      c = c | 0;
      d = d | 0;
      var e = 0;
      if (c >>> 0 > 0 | (c | 0) == 0 & b >>> 0 > 4294967295) {
        while (1) {
          e = Rd(b | 0, c | 0, 10, 0) | 0;
          d = d + -1 | 0;
          a[d >> 0] = e & 255 | 48;
          e = b;
          b = Ke(b | 0, c | 0, 10, 0) | 0;
          if (!(c >>> 0 > 9 | (c | 0) == 9 & e >>> 0 > 4294967295)) break;
          else c = z
        }
        c = b
      } else c = b;
      if (c)
        while (1) {
          d = d + -1 | 0;
          a[d >> 0] = (c >>> 0) % 10 | 0 | 48;
          if (c >>> 0 < 10) break;
          else c = (c >>> 0) / 10 | 0
        }
      return d | 0
    }

    function Bc(b, d) {
      b = b | 0;
      d = d | 0;
      var f = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0;
      j = 0;
      f = c[b + 564 >> 2] | 0;
      if (f | 0) {
        h = (d & 255) < 16;
        i = d & 255;
        do {
          if (h) {
            if (((e[f >> 1] | 0) >>> 8 | 0) == (i | 0)) j = 5
          } else j = 5;
          if ((j | 0) == 5) {
            j = 0;
            if (!(a[f + 53 >> 0] | 0)) {
              Ob(b, d, f);
              g = c[f + 36 >> 2] | 0;
              if (g | 0) Ob(b, d, g)
            }
          }
          f = c[f + 40 >> 2] | 0
        } while ((f | 0) != 0)
      }
      return
    }

    function Cc(a, d) {
      a = a | 0;
      d = d | 0;
      var e = 0,
        f = 0;
      f = 0;
      a: while (1) {
        He(41476);
        e = d & 65535;
        a = c[41480 + ((e & 127) << 2) >> 2] | 0;
        if (!a) {
          f = 3;
          break
        }
        while (1) {
          if (!a) break;
          if ((b[a >> 1] | 0) == d << 16 >> 16) {
            f = 6;
            break a
          }
          a = c[a + 96 >> 2] | 0
        }
        Oe(41476);
        if (!(e & 65280)) {
          a = 0;
          break
        } else d = e & 255
      }
      if ((f | 0) == 3) {
        Oe(41476);
        a = 0
      } else if ((f | 0) == 6) Oe(41476);
      return a | 0
    }

    function Dc(a) {
      a = +a;
      var b = 0.0,
        d = 0.0,
        e = 0;
      h[j >> 3] = a;
      e = c[j + 4 >> 2] | 0;
      d = (e | 0) < 0 ? -.5 : .5;
      e = e & 2147483647;
      c[j >> 2] = c[j >> 2];
      c[j + 4 >> 2] = e;
      b = +h[j >> 3];
      do
        if (e >>> 0 < 1082535490) {
          b = +kb(b);
          if (e >>> 0 >= 1072693248) {
            a = d * (b + b / (b + 1.0));
            break
          }
          if (e >>> 0 >= 1045430272) a = d * (b * 2.0 - b * b / (b + 1.0))
        } else a = d * 2.0 * +Ee(b); while (0);
      return +a
    }

    function Ec() {
      var a = 0;
      if (!(c[10365] | 0)) {
        Hb(10375, 2076, 8, 0, 0);
        a = -1
      } else {
        while (1) {
          a = c[10367] | 0;
          if (!a) break;
          Qb(c[a >> 2] | 0) | 0
        }
        qc();
        We();
        Te();
        b[21286] = 948;
        b[21284] = 0;
        c[10360] = 0;
        c[10361] = 0;
        c[10362] = 0;
        g[117] = 16.875;
        g[118] = 22.5;
        g[119] = 8.4375;
        g[120] = 16.875;
        c[10365] = 0;
        Xa(c[10358] | 0);
        a = 0
      }
      return a | 0
    }

    function Fc(b, d) {
      b = b | 0;
      d = d | 0;
      var f = 0,
        g = 0;
      f = e[d >> 1] | 0;
      g = a[(c[d + 4 >> 2] | 0) + 84 >> 0] | 0;
      b = ((g << 24 >> 24 == 0 ? f & 127 : g & 255) * 100 | 0) + (c[b + 52 + (f >>> 8 << 5) + 24 >> 2] | 0) | 0;
      b = (b | 0) > 0 ? ((b | 0) < 12700 ? b : 12700) : 0;
      return ((((c[1572 + (((b >>> 0) % 1200 | 0) << 2) >> 2] | 0) >>> (10 - ((b | 0) / 1200 | 0) | 0) >>> 0) / (((e[21285] | 0) * 100 | 0) >>> 10 >>> 0) | 0) << 10 >>> 0) / ((c[(c[d + 8 >> 2] | 0) + 92 >> 2] | 0) >>> 0) | 0 | 0
    }

    function Gc(b, e) {
      b = b | 0;
      e = e | 0;
      var f = 0,
        g = 0;
      g = 0;
      while (1) {
        if ((d[12622 + g >> 0] | 0) == (b | 0)) {
          b = 2;
          break
        }
        f = g + 1 | 0;
        if ((f | 0) == 87) {
          f = 12710;
          g = 87;
          b = 5;
          break
        } else g = f
      }
      if ((b | 0) == 2)
        if (!g) f = 12710;
        else {
          f = 12710;
          b = 5
        }
      if ((b | 0) == 5)
        while (1) {
          do {
            b = f;
            f = f + 1 | 0
          } while ((a[b >> 0] | 0) != 0);
          g = g + -1 | 0;
          if (!g) break;
          else b = 5
        }
      return ff(f, c[e + 20 >> 2] | 0) | 0
    }

    function Hc(b) {
      b = b | 0;
      var d = 0,
        e = 0,
        f = 0;
      e = 0;
      f = b;
      a: do
        if (!(f & 3)) e = 4;
        else {
          d = f;
          while (1) {
            if (!(a[b >> 0] | 0)) {
              b = d;
              break a
            }
            b = b + 1 | 0;
            d = b;
            if (!(d & 3)) {
              e = 4;
              break
            }
          }
        }
      while (0);
      if ((e | 0) == 4) {
        while (1) {
          d = c[b >> 2] | 0;
          if (!((d & -2139062144 ^ -2139062144) & d + -16843009)) b = b + 4 | 0;
          else break
        }
        if ((d & 255) << 24 >> 24)
          do b = b + 1 | 0; while ((a[b >> 0] | 0) != 0)
      }
      return b - f | 0
    }

    function Ic(b, d, e) {
      b = b | 0;
      d = d | 0;
      e = e | 0;
      var f = 0,
        g = 0,
        h = 0,
        i = 0;
      Ld(b);
      h = b + 8 | 0;
      i = c[h >> 2] | 0;
      f = b + 16 | 0;
      g = c[f >> 2] | 0;
      g = i + (g * 20 | 0) | 0;
      c[g >> 2] = 41;
      a[g + 4 >> 0] = d;
      c[g + 8 >> 2] = e & 65535;
      g = c[f >> 2] | 0;
      c[(c[h >> 2] | 0) + (g * 20 | 0) + 12 >> 2] = 0;
      c[f >> 2] = g + 1;
      a[b + 52 + ((d & 255) << 5) + 31 >> 0] = e << 16 >> 16 != 0 & 1;
      return
    }

    function Jc(b, c) {
      b = b | 0;
      c = c | 0;
      var d = 0,
        e = 0,
        f = 0;
      f = 0;
      if ((b | 0) == (c | 0)) b = 0;
      else {
        e = b;
        while (1) {
          d = Ue(a[e >> 0] | 0) | 0;
          b = Ue(a[c >> 0] | 0) | 0;
          d = d << 24 >> 24;
          if (!d) {
            f = 3;
            break
          }
          b = b << 24 >> 24;
          if ((d | 0) == (b | 0)) {
            e = e + 1 | 0;
            c = c + 1 | 0
          } else {
            c = d;
            break
          }
        }
        if ((f | 0) == 3) {
          c = 0;
          b = b << 24 >> 24
        }
        b = c - b | 0
      }
      return b | 0
    }

    function Kc(a, f) {
      a = a | 0;
      f = f | 0;
      var g = 0,
        h = 0,
        i = 0;
      g = c[a + 564 >> 2] | 0;
      i = (c[f + 4 >> 2] | 0) + 57344 | 0;
      f = d[f >> 0] | 0;
      h = a + 52 + (f << 5) | 0;
      b[h + 18 >> 1] = i;
      c[h + 24 >> 2] = (O(i << 16 >> 16, b[h + 20 >> 1] | 0) | 0) / ((i >>> 15 & 1) + 8191 | 0) | 0;
      if (g | 0)
        do {
          if (((e[g >> 1] | 0) >>> 8 | 0) == (f | 0)) c[g + 16 >> 2] = Fc(a, g) | 0;
          g = c[g + 40 >> 2] | 0
        } while ((g | 0) != 0);
      return
    }

    function Lc(b, c, e) {
      b = b | 0;
      c = c | 0;
      e = e | 0;
      var f = 0,
        g = 0;
      if (!e) f = 0;
      else {
        f = a[b >> 0] | 0;
        a: do
            if (!(f << 24 >> 24)) f = 0;
            else
              while (1) {
                e = e + -1 | 0;
                g = a[c >> 0] | 0;
                if (!(f << 24 >> 24 == g << 24 >> 24 & ((e | 0) != 0 & g << 24 >> 24 != 0))) break a;
                b = b + 1 | 0;
                c = c + 1 | 0;
                f = a[b >> 0] | 0;
                if (!(f << 24 >> 24)) {
                  f = 0;
                  break
                }
              }
          while (0);
          f = (f & 255) - (d[c >> 0] | 0) | 0
      }
      return f | 0
    }

    function Mc(a, b) {
      a = a | 0;
      b = b | 0;
      var d = 0,
        e = 0,
        f = 0,
        g = 0;
      f = 0;
      g = l;
      l = l + 4112 | 0;
      e = g;
      d = g + 8 | 0;
      if (!a) {
        b = 4096;
        a = d;
        f = 4
      } else if (!b) {
        c[($f() | 0) >> 2] = 22;
        a = 0
      } else f = 4;
      if ((f | 0) == 4) {
        c[e >> 2] = a;
        c[e + 4 >> 2] = b;
        if ((De(da(183, e | 0) | 0) | 0) < 0) a = 0;
        else if ((a | 0) == (d | 0)) a = re(d) | 0
      }
      l = g;
      return a | 0
    }

    function Nc(d, e) {
      d = d | 0;
      e = e | 0;
      var f = 0,
        g = 0;
      f = c[e >> 2] | 0;
      g = d + f | 0;
      f = Ed(f + 2 | 0, 2) | 0;
      c[e + 96 >> 2] = f;
      if (!f) {
        Hb(10714, 226, 1, 10546, c[($f() | 0) >> 2] | 0);
        d = -1
      } else {
        while (1) {
          b[f >> 1] = ((a[d >> 0] ^ -128) & 255) << 8;
          d = d + 1 | 0;
          if ((d | 0) == (g | 0)) break;
          else f = f + 2 | 0
        }
        d = e + 32 | 0;
        a[d >> 0] = a[d >> 0] ^ 2;
        d = 0
      }
      return d | 0
    }

    function Oc(b) {
      b = b | 0;
      var d = 0,
        e = 0,
        f = 0;
      e = c[1883] | 0;
      if ((c[e + 76 >> 2] | 0) > -1) f = Xf(e) | 0;
      else f = 0;
      do
        if ((Ce(b, e) | 0) < 0) b = -1;
        else {
          if ((a[e + 75 >> 0] | 0) != 10) {
            b = e + 20 | 0;
            d = c[b >> 2] | 0;
            if (d >>> 0 < (c[e + 16 >> 2] | 0) >>> 0) {
              c[b >> 2] = d + 1;
              a[d >> 0] = 10;
              b = 0;
              break
            }
          }
          b = (ic(e, 10) | 0) >> 31
        }
      while (0);
      if (f | 0) Wf(e);
      return b | 0
    }

    function Pc(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      var f = 0,
        g = 0;
      g = l;
      l = l + 256 | 0;
      f = g;
      if ((c | 0) > (d | 0) & (e & 73728 | 0) == 0) {
        e = c - d | 0;
        Tb(f | 0, b | 0, (e >>> 0 < 256 ? e : 256) | 0) | 0;
        if (e >>> 0 > 255) {
          b = c - d | 0;
          do {
            Je(a, f, 256);
            e = e + -256 | 0
          } while (e >>> 0 > 255);
          e = b & 255
        }
        Je(a, f, e)
      }
      l = g;
      return
    }

    function Qc(b, c, d) {
      b = b | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        f = 0;
      if ((b | 0) == (c | 0) | (d | 0) == 0) d = 0;
      else {
        f = d;
        while (1) {
          d = Ue(a[b >> 0] | 0) | 0;
          d = d << 24 >> 24;
          e = (Ue(a[c >> 0] | 0) | 0) << 24 >> 24;
          if (!d) {
            d = 0;
            break
          }
          if ((d | 0) != (e | 0)) break;
          f = f + -1 | 0;
          if (!f) break;
          else {
            c = c + 1 | 0;
            b = b + 1 | 0
          }
        }
        d = d - e | 0
      }
      return d | 0
    }

    function Rc(b, d, e, f) {
      b = b | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      var g = 0,
        h = 0,
        i = 0;
      Ld(b);
      g = b + 8 | 0;
      i = c[g >> 2] | 0;
      b = b + 16 | 0;
      h = c[b >> 2] | 0;
      h = i + (h * 20 | 0) | 0;
      c[h >> 2] = 3;
      a[h + 4 >> 0] = d;
      c[h + 8 >> 2] = (e & 127) << 8 | f & 255;
      f = c[b >> 2] | 0;
      c[(c[g >> 2] | 0) + (f * 20 | 0) + 12 >> 2] = 0;
      c[b >> 2] = f + 1;
      return 0
    }

    function Sc(b, d, e, f) {
      b = b | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      var g = 0,
        h = 0,
        i = 0;
      Ld(b);
      g = b + 8 | 0;
      i = c[g >> 2] | 0;
      b = b + 16 | 0;
      h = c[b >> 2] | 0;
      h = i + (h * 20 | 0) | 0;
      c[h >> 2] = 13;
      a[h + 4 >> 0] = d;
      c[h + 8 >> 2] = (e & 127) << 8 | f & 255;
      f = c[b >> 2] | 0;
      c[(c[g >> 2] | 0) + (f * 20 | 0) + 12 >> 2] = 0;
      c[b >> 2] = f + 1;
      return
    }

    function Tc(a, b, d) {
      a = a | 0;
      b = b | 0;
      d = d | 0;
      var e = 0,
        f = 0,
        g = 0;
      f = l;
      l = l + 32 | 0;
      g = f;
      e = f + 20 | 0;
      c[g >> 2] = c[a + 60 >> 2];
      c[g + 4 >> 2] = 0;
      c[g + 8 >> 2] = b;
      c[g + 12 >> 2] = e;
      c[g + 16 >> 2] = d;
      if ((De(ba(140, g | 0) | 0) | 0) < 0) {
        c[e >> 2] = -1;
        a = -1
      } else a = c[e >> 2] | 0;
      l = f;
      return a | 0
    }

    function Uc(a, b) {
      a = a | 0;
      b = b | 0;
      var d = 0,
        e = 0;
      e = l;
      l = l + 16 | 0;
      d = e;
      if ((Pd(c[1849] | 0, a, b) | 0) < 0) {
        a = c[1851] | 0;
        c[d >> 2] = Ve(c[($f() | 0) >> 2] | 0) | 0;
        ee(a, 11861, d) | 0;
        $d(c[1849] | 0) | 0;
        c[1849] = -1;
        a = -1
      } else {
        c[10500] = (c[10500] | 0) + b;
        a = 0
      }
      l = e;
      return a | 0
    }

    function Vc(b, d, e) {
      b = b | 0;
      d = d | 0;
      e = e | 0;
      var f = 0,
        g = 0,
        h = 0;
      Ld(b);
      f = b + 8 | 0;
      h = c[f >> 2] | 0;
      b = b + 16 | 0;
      g = c[b >> 2] | 0;
      g = h + (g * 20 | 0) | 0;
      c[g >> 2] = 33;
      a[g + 4 >> 0] = d;
      c[g + 8 >> 2] = e & 255;
      e = c[b >> 2] | 0;
      c[(c[f >> 2] | 0) + (e * 20 | 0) + 12 >> 2] = 0;
      c[b >> 2] = e + 1;
      return
    }

    function Wc(a, e) {
      a = a | 0;
      e = e | 0;
      var f = 0,
        g = 0;
      f = c[e >> 2] | 0;
      g = a + f | 0;
      f = Ed(f + 2 | 0, 2) | 0;
      c[e + 96 >> 2] = f;
      if (!f) {
        Hb(10737, 76, 0, 10748, c[($f() | 0) >> 2] | 0);
        a = -1
      } else
        while (1) {
          b[f >> 1] = (d[a >> 0] | 0) << 8;
          a = a + 1 | 0;
          if ((a | 0) == (g | 0)) {
            a = 0;
            break
          } else f = f + 2 | 0
        }
      return a | 0
    }

    function Xc(b, d, e) {
      b = b | 0;
      d = d | 0;
      e = e | 0;
      var f = 0,
        g = 0,
        h = 0;
      Ld(b);
      f = b + 8 | 0;
      h = c[f >> 2] | 0;
      b = b + 16 | 0;
      g = c[b >> 2] | 0;
      g = h + (g * 20 | 0) | 0;
      c[g >> 2] = 34;
      a[g + 4 >> 0] = d;
      c[g + 8 >> 2] = e & 65535;
      e = c[b >> 2] | 0;
      c[(c[f >> 2] | 0) + (e * 20 | 0) + 12 >> 2] = 0;
      c[b >> 2] = e + 1;
      return
    }

    function Yc(b, d) {
      b = b | 0;
      d = d | 0;
      var e = 0,
        f = 0,
        g = 0;
      fe(d);
      Ld(b);
      e = b + 8 | 0;
      g = c[e >> 2] | 0;
      b = b + 16 | 0;
      f = c[b >> 2] | 0;
      f = g + (f * 20 | 0) | 0;
      c[f >> 2] = 9;
      a[f + 4 >> 0] = 0;
      c[f + 8 >> 2] = d;
      d = c[b >> 2] | 0;
      c[(c[e >> 2] | 0) + (d * 20 | 0) + 12 >> 2] = 0;
      c[b >> 2] = d + 1;
      return
    }

    function Zc(b, d) {
      b = b | 0;
      d = d | 0;
      var e = 0,
        f = 0,
        g = 0;
      fe(d);
      Ld(b);
      e = b + 8 | 0;
      g = c[e >> 2] | 0;
      b = b + 16 | 0;
      f = c[b >> 2] | 0;
      f = g + (f * 20 | 0) | 0;
      c[f >> 2] = 8;
      a[f + 4 >> 0] = 0;
      c[f + 8 >> 2] = d;
      d = c[b >> 2] | 0;
      c[(c[e >> 2] | 0) + (d * 20 | 0) + 12 >> 2] = 0;
      c[b >> 2] = d + 1;
      return
    }

    function _c(b, d) {
      b = b | 0;
      d = d | 0;
      var e = 0,
        f = 0,
        g = 0;
      fe(d);
      Ld(b);
      e = b + 8 | 0;
      g = c[e >> 2] | 0;
      b = b + 16 | 0;
      f = c[b >> 2] | 0;
      f = g + (f * 20 | 0) | 0;
      c[f >> 2] = 12;
      a[f + 4 >> 0] = 0;
      c[f + 8 >> 2] = d;
      d = c[b >> 2] | 0;
      c[(c[e >> 2] | 0) + (d * 20 | 0) + 12 >> 2] = 0;
      c[b >> 2] = d + 1;
      return
    }

    function $c(b, d) {
      b = b | 0;
      d = d | 0;
      var e = 0,
        f = 0,
        g = 0;
      fe(d);
      Ld(b);
      e = b + 8 | 0;
      g = c[e >> 2] | 0;
      b = b + 16 | 0;
      f = c[b >> 2] | 0;
      f = g + (f * 20 | 0) | 0;
      c[f >> 2] = 7;
      a[f + 4 >> 0] = 0;
      c[f + 8 >> 2] = d;
      d = c[b >> 2] | 0;
      c[(c[e >> 2] | 0) + (d * 20 | 0) + 12 >> 2] = 0;
      c[b >> 2] = d + 1;
      return
    }

    function ad(b, d) {
      b = b | 0;
      d = d | 0;
      var e = 0,
        f = 0,
        g = 0;
      fe(d);
      Ld(b);
      e = b + 8 | 0;
      g = c[e >> 2] | 0;
      b = b + 16 | 0;
      f = c[b >> 2] | 0;
      f = g + (f * 20 | 0) | 0;
      c[f >> 2] = 11;
      a[f + 4 >> 0] = 0;
      c[f + 8 >> 2] = d;
      d = c[b >> 2] | 0;
      c[(c[e >> 2] | 0) + (d * 20 | 0) + 12 >> 2] = 0;
      c[b >> 2] = d + 1;
      return
    }

    function bd(b) {
      b = b | 0;
      var d = 0,
        e = 0;
      d = b + 74 | 0;
      e = a[d >> 0] | 0;
      a[d >> 0] = e + 255 | e;
      d = c[b >> 2] | 0;
      if (!(d & 8)) {
        c[b + 8 >> 2] = 0;
        c[b + 4 >> 2] = 0;
        e = c[b + 44 >> 2] | 0;
        c[b + 28 >> 2] = e;
        c[b + 20 >> 2] = e;
        c[b + 16 >> 2] = e + (c[b + 48 >> 2] | 0);
        b = 0
      } else {
        c[b >> 2] = d | 32;
        b = -1
      }
      return b | 0
    }

    function cd(b, d) {
      b = b | 0;
      d = d | 0;
      var e = 0,
        f = 0,
        g = 0;
      fe(d);
      Ld(b);
      e = b + 8 | 0;
      g = c[e >> 2] | 0;
      b = b + 16 | 0;
      f = c[b >> 2] | 0;
      f = g + (f * 20 | 0) | 0;
      c[f >> 2] = 10;
      a[f + 4 >> 0] = 0;
      c[f + 8 >> 2] = d;
      d = c[b >> 2] | 0;
      c[(c[e >> 2] | 0) + (d * 20 | 0) + 12 >> 2] = 0;
      c[b >> 2] = d + 1;
      return
    }

    function dd(b, d) {
      b = b | 0;
      d = d | 0;
      var e = 0,
        f = 0,
        g = 0;
      fe(d);
      Ld(b);
      e = b + 8 | 0;
      g = c[e >> 2] | 0;
      b = b + 16 | 0;
      f = c[b >> 2] | 0;
      f = g + (f * 20 | 0) | 0;
      c[f >> 2] = 6;
      a[f + 4 >> 0] = 0;
      c[f + 8 >> 2] = d;
      d = c[b >> 2] | 0;
      c[(c[e >> 2] | 0) + (d * 20 | 0) + 12 >> 2] = 0;
      c[b >> 2] = d + 1;
      return
    }

    function ed(b, d, e) {
      b = b | 0;
      d = d | 0;
      e = e | 0;
      var f = 0,
        g = 0;
      g = l;
      l = l + 32 | 0;
      f = g;
      c[b + 36 >> 2] = 1;
      if (!(c[b >> 2] & 64)) {
        c[f >> 2] = c[b + 60 >> 2];
        c[f + 4 >> 2] = 21523;
        c[f + 8 >> 2] = g + 16;
        if (la(54, f | 0) | 0) a[b + 75 >> 0] = -1
      }
      f = zb(b, d, e) | 0;
      l = g;
      return f | 0
    }

    function fd(a) {
      a = a | 0;
      var b = 0,
        d = 0;
      d = a + 15 & -16 | 0;
      b = c[i >> 2] | 0;
      a = b + d | 0;
      if ((d | 0) > 0 & (a | 0) < (b | 0) | (a | 0) < 0) {
        W() | 0;
        aa(12);
        return -1
      }
      c[i >> 2] = a;
      if ((a | 0) > (V() | 0))
        if (!(U() | 0)) {
          c[i >> 2] = b;
          aa(12);
          return -1
        }
      return b | 0
    }

    function gd(b, d) {
      b = b | 0;
      d = d | 0;
      var e = 0,
        f = 0,
        g = 0;
      Ld(b);
      e = b + 8 | 0;
      g = c[e >> 2] | 0;
      b = b + 16 | 0;
      f = c[b >> 2] | 0;
      f = g + (f * 20 | 0) | 0;
      c[f >> 2] = 4;
      a[f + 4 >> 0] = 0;
      c[f + 8 >> 2] = d;
      d = c[b >> 2] | 0;
      c[(c[e >> 2] | 0) + (d * 20 | 0) + 12 >> 2] = 0;
      c[b >> 2] = d + 1;
      return 0
    }

    function hd(b, d) {
      b = b | 0;
      d = d | 0;
      var e = 0,
        f = 0,
        g = 0;
      Ld(b);
      e = b + 8 | 0;
      g = c[e >> 2] | 0;
      b = b + 16 | 0;
      f = c[b >> 2] | 0;
      f = g + (f * 20 | 0) | 0;
      c[f >> 2] = 39;
      a[f + 4 >> 0] = 0;
      c[f + 8 >> 2] = d;
      d = c[b >> 2] | 0;
      c[(c[e >> 2] | 0) + (d * 20 | 0) + 12 >> 2] = 0;
      c[b >> 2] = d + 1;
      return
    }

    function id(b, d) {
      b = b | 0;
      d = d | 0;
      var e = 0,
        f = 0,
        g = 0;
      Ld(b);
      e = b + 8 | 0;
      g = c[e >> 2] | 0;
      b = b + 16 | 0;
      f = c[b >> 2] | 0;
      f = g + (f * 20 | 0) | 0;
      c[f >> 2] = 36;
      a[f + 4 >> 0] = 0;
      c[f + 8 >> 2] = d;
      d = c[b >> 2] | 0;
      c[(c[e >> 2] | 0) + (d * 20 | 0) + 12 >> 2] = 0;
      c[b >> 2] = d + 1;
      return
    }

    function jd(b, d) {
      b = b | 0;
      d = d | 0;
      var e = 0,
        f = 0,
        g = 0;
      Ld(b);
      e = b + 8 | 0;
      g = c[e >> 2] | 0;
      b = b + 16 | 0;
      f = c[b >> 2] | 0;
      f = g + (f * 20 | 0) | 0;
      c[f >> 2] = 40;
      a[f + 4 >> 0] = 0;
      c[f + 8 >> 2] = d;
      d = c[b >> 2] | 0;
      c[(c[e >> 2] | 0) + (d * 20 | 0) + 12 >> 2] = 0;
      c[b >> 2] = d + 1;
      return
    }

    function kd(b, d) {
      b = b | 0;
      d = d | 0;
      var e = 0,
        f = 0,
        g = 0;
      Ld(b);
      e = b + 8 | 0;
      g = c[e >> 2] | 0;
      b = b + 16 | 0;
      f = c[b >> 2] | 0;
      f = g + (f * 20 | 0) | 0;
      c[f >> 2] = 38;
      a[f + 4 >> 0] = 0;
      c[f + 8 >> 2] = d;
      d = c[b >> 2] | 0;
      c[(c[e >> 2] | 0) + (d * 20 | 0) + 12 >> 2] = 0;
      c[b >> 2] = d + 1;
      return
    }

    function ld(b, d) {
      b = b | 0;
      d = d | 0;
      var e = 0,
        f = 0,
        g = 0;
      Ld(b);
      e = b + 8 | 0;
      g = c[e >> 2] | 0;
      b = b + 16 | 0;
      f = c[b >> 2] | 0;
      f = g + (f * 20 | 0) | 0;
      c[f >> 2] = 35;
      a[f + 4 >> 0] = 0;
      c[f + 8 >> 2] = d;
      d = c[b >> 2] | 0;
      c[(c[e >> 2] | 0) + (d * 20 | 0) + 12 >> 2] = 0;
      c[b >> 2] = d + 1;
      return
    }

    function md(b, d) {
      b = b | 0;
      d = d | 0;
      var e = 0,
        f = 0,
        g = 0;
      Ld(b);
      e = b + 8 | 0;
      g = c[e >> 2] | 0;
      b = b + 16 | 0;
      f = c[b >> 2] | 0;
      f = g + (f * 20 | 0) | 0;
      c[f >> 2] = 37;
      a[f + 4 >> 0] = 0;
      c[f + 8 >> 2] = d;
      d = c[b >> 2] | 0;
      c[(c[e >> 2] | 0) + (d * 20 | 0) + 12 >> 2] = 0;
      c[b >> 2] = d + 1;
      return
    }

    function nd(b, d) {
      b = b | 0;
      d = d | 0;
      var e = 0,
        f = 0,
        g = 0;
      Ld(b);
      e = b + 8 | 0;
      g = c[e >> 2] | 0;
      b = b + 16 | 0;
      f = c[b >> 2] | 0;
      f = g + (f * 20 | 0) | 0;
      c[f >> 2] = 5;
      a[f + 4 >> 0] = 0;
      c[f + 8 >> 2] = d;
      d = c[b >> 2] | 0;
      c[(c[e >> 2] | 0) + (d * 20 | 0) + 12 >> 2] = 0;
      c[b >> 2] = d + 1;
      return 0
    }

    function od(b) {
      b = b | 0;
      var d = 0,
        e = 0,
        f = 0;
      Ld(b);
      e = b + 8 | 0;
      f = c[e >> 2] | 0;
      b = b + 16 | 0;
      d = c[b >> 2] | 0;
      d = f + (d * 20 | 0) | 0;
      c[d >> 2] = 42;
      a[d + 4 >> 0] = 0;
      c[d + 8 >> 2] = 0;
      d = c[b >> 2] | 0;
      c[(c[e >> 2] | 0) + (d * 20 | 0) + 12 >> 2] = 0;
      c[b >> 2] = d + 1;
      return
    }

    function pd(b) {
      b = b | 0;
      var d = 0,
        e = 0,
        f = 0;
      Ld(b);
      e = b + 8 | 0;
      f = c[e >> 2] | 0;
      b = b + 16 | 0;
      d = c[b >> 2] | 0;
      d = f + (d * 20 | 0) | 0;
      c[d >> 2] = 42;
      a[d + 4 >> 0] = 0;
      c[d + 8 >> 2] = 0;
      d = c[b >> 2] | 0;
      c[(c[e >> 2] | 0) + (d * 20 | 0) + 12 >> 2] = 0;
      c[b >> 2] = d + 1;
      return
    }

    function qd(b, c) {
      b = b | 0;
      c = c | 0;
      var d = 0,
        e = 0;
      d = a[b >> 0] | 0;
      e = a[c >> 0] | 0;
      if (d << 24 >> 24 == 0 ? 1 : d << 24 >> 24 != e << 24 >> 24) b = e;
      else {
        do {
          b = b + 1 | 0;
          c = c + 1 | 0;
          d = a[b >> 0] | 0;
          e = a[c >> 0] | 0
        } while (!(d << 24 >> 24 == 0 ? 1 : d << 24 >> 24 != e << 24 >> 24));
        b = e
      }
      return (d & 255) - (b & 255) | 0
    }

    function rd(b) {
      b = b | 0;
      var d = 0,
        e = 0,
        f = 0;
      Ld(b);
      e = b + 8 | 0;
      f = c[e >> 2] | 0;
      b = b + 16 | 0;
      d = c[b >> 2] | 0;
      d = f + (d * 20 | 0) | 0;
      c[d >> 2] = 1;
      a[d + 4 >> 0] = 0;
      c[d + 8 >> 2] = 0;
      d = c[b >> 2] | 0;
      c[(c[e >> 2] | 0) + (d * 20 | 0) + 12 >> 2] = 0;
      c[b >> 2] = d + 1;
      return 0
    }

    function sd(b) {
      b = b | 0;
      var d = 0,
        e = 0,
        f = 0;
      Ld(b);
      e = b + 8 | 0;
      f = c[e >> 2] | 0;
      b = b + 16 | 0;
      d = c[b >> 2] | 0;
      d = f + (d * 20 | 0) | 0;
      c[d >> 2] = 42;
      a[d + 4 >> 0] = 0;
      c[d + 8 >> 2] = 0;
      d = c[b >> 2] | 0;
      c[(c[e >> 2] | 0) + (d * 20 | 0) + 12 >> 2] = 0;
      c[b >> 2] = d + 1;
      return
    }

    function td(b, c, d) {
      b = b | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        f = 0;
      a: do
        if (!d) b = 0;
        else {
          while (1) {
            e = a[b >> 0] | 0;
            f = a[c >> 0] | 0;
            if (e << 24 >> 24 != f << 24 >> 24) break;
            d = d + -1 | 0;
            if (!d) {
              b = 0;
              break a
            } else {
              b = b + 1 | 0;
              c = c + 1 | 0
            }
          }
          b = (e & 255) - (f & 255) | 0
        }
      while (0);
      return b | 0
    }

    function ud(a, b, d) {
      a = a | 0;
      b = b | 0;
      d = d | 0;
      var e = 0,
        f = 0,
        g = 0;
      f = l;
      l = l + 32 | 0;
      g = f;
      e = f + 20 | 0;
      c[g >> 2] = a;
      c[g + 4 >> 2] = 0;
      c[g + 8 >> 2] = b;
      c[g + 12 >> 2] = e;
      c[g + 16 >> 2] = d;
      d = (De(ba(140, g | 0) | 0) | 0) != 0;
      l = f;
      return (d ? -1 : c[e >> 2] | 0) | 0
    }

    function vd() {}

    function wd(a, b) {
      a = a | 0;
      b = b | 0;
      var c = 0,
        d = 0,
        e = 0,
        f = 0;
      f = a & 65535;
      e = b & 65535;
      c = O(e, f) | 0;
      d = a >>> 16;
      a = (c >>> 16) + (O(e, d) | 0) | 0;
      e = b >>> 16;
      b = O(e, f) | 0;
      return (z = (a >>> 16) + (O(e, d) | 0) + (((a & 65535) + b | 0) >>> 16) | 0, a + b << 16 | c & 65535 | 0) | 0
    }

    function xd(a, b, d, e) {
      a = a | 0;
      b = b | 0;
      d = d | 0;
      e = e | 0;
      var f = 0,
        g = 0;
      f = O(d, b) | 0;
      d = (b | 0) == 0 ? 0 : d;
      if ((c[e + 76 >> 2] | 0) > -1) {
        g = (Xf(e) | 0) == 0;
        a = Nb(a, f, e) | 0;
        if (!g) Wf(e)
      } else a = Nb(a, f, e) | 0;
      if ((a | 0) != (f | 0)) d = (a >>> 0) / (b >>> 0) | 0;
      return d | 0
    }

    function yd(b, f) {
      b = b | 0;
      f = f | 0;
      var g = 0;
      b = c[b + 564 >> 2] | 0;
      if (b | 0) {
        g = d[f >> 0] | 0;
        do {
          if (((e[b >> 1] | 0) >>> 8 | 0) == (g | 0)) {
            a[b + 34 >> 0] = 0;
            f = b + 36 | 0;
            if (c[f >> 2] | 0) c[f >> 2] = 0
          }
          b = c[b + 40 >> 2] | 0
        } while ((b | 0) != 0)
      }
      return
    }

    function zd(d, e) {
      d = d | 0;
      e = e | 0;
      var f = 0;
      e = a[e >> 0] | 0;
      f = e & 255;
      f = d + 52 + (f << 5) | 0;
      a[f + 11 >> 0] = 127;
      a[f + 10 >> 0] = 127;
      b[f + 28 >> 1] = -1;
      b[f + 20 >> 1] = 200;
      b[f + 18 >> 1] = 0;
      c[f + 24 >> 2] = 0;
      a[f + 8 >> 0] = 0;
      Bc(d, e);
      return
    }

    function Ad(a, b) {
      a = +a;
      b = +b;
      var d = 0,
        e = 0;
      h[j >> 3] = a;
      e = c[j >> 2] | 0;
      d = c[j + 4 >> 2] | 0;
      h[j >> 3] = b;
      d = c[j + 4 >> 2] & -2147483648 | d & 2147483647;
      c[j >> 2] = e;
      c[j + 4 >> 2] = d;
      return +(+h[j >> 3])
    }

    function Bd(e, f) {
      e = e | 0;
      f = f | 0;
      var g = 0;
      g = d[f >> 0] | 0;
      if (!(a[e + 52 + (g << 5) + 30 >> 0] | 0))
        if (!(b[e + 52 + (g << 5) + 28 >> 1] | 0)) {
          g = e + 52 + (g << 5) + 20 | 0;
          b[g >> 1] = ((((b[g >> 1] | 0) / 100 | 0) << 16 >> 16) * 100 | 0) + (c[f + 4 >> 2] | 0)
        }
      return
    }

    function Cd(b) {
      b = b | 0;
      var c = 0;
      c = a[n + (b & 255) >> 0] | 0;
      if ((c | 0) < 8) return c | 0;
      c = a[n + (b >> 8 & 255) >> 0] | 0;
      if ((c | 0) < 8) return c + 8 | 0;
      c = a[n + (b >> 16 & 255) >> 0] | 0;
      if ((c | 0) < 8) return c + 16 | 0;
      return (a[n + (b >>> 24) >> 0] | 0) + 24 | 0
    }

    function Dd(e, f) {
      e = e | 0;
      f = f | 0;
      var g = 0;
      g = d[f >> 0] | 0;
      if (!(a[e + 52 + (g << 5) + 30 >> 0] | 0))
        if (!(b[e + 52 + (g << 5) + 28 >> 1] | 0)) {
          g = e + 52 + (g << 5) + 20 | 0;
          b[g >> 1] = ((c[f + 4 >> 2] | 0) * 100 | 0) + ((b[g >> 1] | 0) % 100 | 0)
        }
      return
    }

    function Ed(a, b) {
      a = a | 0;
      b = b | 0;
      var d = 0;
      if (!a) d = 0;
      else {
        d = O(b, a) | 0;
        if ((b | a) >>> 0 > 65535) d = ((d >>> 0) / (a >>> 0) | 0 | 0) == (b | 0) ? d : -1
      }
      a = La(d) | 0;
      if (!a) return a | 0;
      if (!(c[a + -4 >> 2] & 3)) return a | 0;
      Tb(a | 0, 0, d | 0) | 0;
      return a | 0
    }

    function Fd(b, e) {
      b = b | 0;
      e = e | 0;
      var f = 0,
        g = 0;
      f = d[e >> 0] | 0;
      g = b + 52 + (f << 5) | 0;
      if (!(a[b + 52 + (f << 5) + 31 >> 0] | 0)) c[b + 52 + (f << 5) + 4 >> 2] = Cc(b, (d[g >> 0] << 8 | c[e + 4 >> 2]) & 65535) | 0;
      else a[g >> 0] = c[e + 4 >> 2];
      return
    }

    function Gd(a) {
      a = a | 0;
      do
        if (!(c[10365] | 0)) {
          Hb(10023, 1578, 8, 0, 0);
          a = -1
        } else if (a << 24 >> 24 < 0) {
        Hb(10023, 1582, 9, 10045, 0);
        a = -1;
        break
      } else {
        b[21286] = b[8068 + ((a & 255) << 1) >> 1] | 0;
        a = 0;
        break
      }
      while (0);
      return a | 0
    }

    function Hd(b, e) {
      b = b | 0;
      e = e | 0;
      var f = 0,
        g = 0;
      g = d[e >> 0] | 0;
      f = b + 52 + (g << 5) + 31 | 0;
      if (!(c[e + 4 >> 2] | 0)) {
        a[f >> 0] = 0;
        e = Cc(b, 0) | 0
      } else {
        a[f >> 0] = 1;
        e = 0
      }
      c[b + 52 + (g << 5) + 4 >> 2] = e;
      return
    }

    function Id(c, e) {
      c = c | 0;
      e = e | 0;
      e = d[e >> 0] | 0;
      if (!(a[c + 52 + (e << 5) + 30 >> 0] | 0))
        if (!(b[c + 52 + (e << 5) + 28 >> 1] | 0)) {
          e = c + 52 + (e << 5) + 20 | 0;
          c = b[e >> 1] | 0;
          if (c << 16 >> 16 < 16383) b[e >> 1] = c + 1 << 16 >> 16
        }
      return
    }

    function Jd(b) {
      b = b | 0;
      var d = 0,
        e = 0,
        f = 0;
      e = c[b >> 2] | 0;
      f = (a[e >> 0] | 0) + -48 | 0;
      if (f >>> 0 < 10) {
        d = 0;
        do {
          d = f + (d * 10 | 0) | 0;
          e = e + 1 | 0;
          c[b >> 2] = e;
          f = (a[e >> 0] | 0) + -48 | 0
        } while (f >>> 0 < 10)
      } else d = 0;
      return d | 0
    }

    function Kd(c, e) {
      c = c | 0;
      e = e | 0;
      e = d[e >> 0] | 0;
      if (!(a[c + 52 + (e << 5) + 30 >> 0] | 0))
        if (!(b[c + 52 + (e << 5) + 28 >> 1] | 0)) {
          e = c + 52 + (e << 5) + 20 | 0;
          c = b[e >> 1] | 0;
          if (c << 16 >> 16 > 0) b[e >> 1] = c + -1 << 16 >> 16
        }
      return
    }

    function Ld(a) {
      a = a | 0;
      var b = 0,
        d = 0,
        e = 0,
        f = 0;
      b = a + 20 | 0;
      f = c[b >> 2] | 0;
      d = f + 8192 | 0;
      e = a + 8 | 0;
      if (((c[a + 16 >> 2] | 0) + 1 | 0) >>> 0 >= f >>> 0) {
        c[b >> 2] = d;
        c[e >> 2] = zc(c[e >> 2] | 0, d * 20 | 0) | 0
      }
      return
    }

    function Md(b, c, e, f) {
      b = b | 0;
      c = c | 0;
      e = e | 0;
      f = f | 0;
      if (!((b | 0) == 0 & (c | 0) == 0))
        do {
          e = e + -1 | 0;
          a[e >> 0] = d[12604 + (b & 15) >> 0] | 0 | f;
          b = me(b | 0, c | 0, 4) | 0;
          c = z
        } while (!((b | 0) == 0 & (c | 0) == 0));
      return e | 0
    }

    function Nd(a, b, d) {
      a = a | 0;
      b = b | 0;
      d = d | 0;
      var e = 0,
        f = 0;
      e = a + 20 | 0;
      f = c[e >> 2] | 0;
      a = (c[a + 16 >> 2] | 0) - f | 0;
      a = a >>> 0 > d >>> 0 ? d : a;
      yb(f | 0, b | 0, a | 0) | 0;
      c[e >> 2] = (c[e >> 2] | 0) + a;
      return d | 0
    }

    function Od(a, b) {
      a = a | 0;
      b = b | 0;
      var d = 0,
        e = 0,
        f = 0;
      c[a + 104 >> 2] = b;
      d = c[a + 8 >> 2] | 0;
      e = c[a + 4 >> 2] | 0;
      f = d - e | 0;
      c[a + 108 >> 2] = f;
      c[a + 100 >> 2] = (b | 0) != 0 & (f | 0) > (b | 0) ? e + b | 0 : d;
      return
    }

    function Pd(a, b, d) {
      a = a | 0;
      b = b | 0;
      d = d | 0;
      var e = 0,
        f = 0;
      e = l;
      l = l + 16 | 0;
      f = e;
      c[f >> 2] = a;
      c[f + 4 >> 2] = b;
      c[f + 8 >> 2] = d;
      d = De(ja(4, f | 0) | 0) | 0;
      l = e;
      return d | 0
    }

    function Qd(a, b, d) {
      a = a | 0;
      b = b | 0;
      d = d | 0;
      var e = 0,
        f = 0;
      e = l;
      l = l + 16 | 0;
      f = e;
      c[f >> 2] = a;
      c[f + 4 >> 2] = b;
      c[f + 8 >> 2] = d;
      d = De(ia(3, f | 0) | 0) | 0;
      l = e;
      return d | 0
    }

    function Rd(a, b, d, e) {
      a = a | 0;
      b = b | 0;
      d = d | 0;
      e = e | 0;
      var f = 0,
        g = 0;
      g = l;
      l = l + 16 | 0;
      f = g | 0;
      db(a, b, d, e, f) | 0;
      l = g;
      return (z = c[f + 4 >> 2] | 0, c[f >> 2] | 0) | 0
    }

    function Sd(a) {
      a = a | 0;
      var b = 0,
        e = 0;
      e = l;
      l = l + 16 | 0;
      b = e;
      if (!(yc(a) | 0))
        if ((Ia[c[a + 32 >> 2] & 7](a, b, 1) | 0) == 1) a = d[b >> 0] | 0;
        else a = -1;
      else a = -1;
      l = e;
      return a | 0
    }

    function Td(b, c, d) {
      b = b | 0;
      c = c | 0;
      d = d | 0;
      if (!((b | 0) == 0 & (c | 0) == 0))
        do {
          d = d + -1 | 0;
          a[d >> 0] = b & 7 | 48;
          b = me(b | 0, c | 0, 3) | 0;
          c = z
        } while (!((b | 0) == 0 & (c | 0) == 0));
      return d | 0
    }

    function Ud(a, b) {
      a = a | 0;
      b = b | 0;
      var d = 0,
        e = 0,
        f = 0;
      d = l;
      l = l + 16 | 0;
      f = d;
      e = c[1851] | 0;
      Zb(13, e) | 0;
      c[f >> 2] = b;
      Ab(e, a, f) | 0;
      Zb(10, e) | 0;
      l = d;
      return
    }

    function Vd(e, f) {
      e = e | 0;
      f = f | 0;
      var g = 0;
      g = d[f >> 0] | 0;
      e = e + 52 + (g << 5) | 0;
      g = e + 28 | 0;
      b[g >> 1] = c[f + 4 >> 2] << 7 | b[g >> 1] & 127;
      a[e + 30 >> 0] = 1;
      return
    }

    function Wd(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        f = 0;
      e = a;
      f = c;
      c = wd(e, f) | 0;
      a = z;
      return (z = (O(b, f) | 0) + (O(d, e) | 0) + a | a & 0, c | 0 | 0) | 0
    }

    function Xd(e, f) {
      e = e | 0;
      f = f | 0;
      var g = 0;
      g = d[f >> 0] | 0;
      e = e + 52 + (g << 5) | 0;
      g = e + 28 | 0;
      b[g >> 1] = c[f + 4 >> 2] << 7 | b[g >> 1] & 127;
      a[e + 30 >> 0] = 0;
      return
    }

    function Yd(e, f) {
      e = e | 0;
      f = f | 0;
      var g = 0;
      g = d[f >> 0] | 0;
      e = e + 52 + (g << 5) | 0;
      g = e + 28 | 0;
      b[g >> 1] = c[f + 4 >> 2] | b[g >> 1] & 16256;
      a[e + 30 >> 0] = 1;
      return
    }

    function Zd(e, f) {
      e = e | 0;
      f = f | 0;
      var g = 0;
      g = d[f >> 0] | 0;
      e = e + 52 + (g << 5) | 0;
      g = e + 28 | 0;
      b[g >> 1] = c[f + 4 >> 2] | b[g >> 1] & 16256;
      a[e + 30 >> 0] = 0;
      return
    }

    function _d(a, b) {
      a = a | 0;
      b = b | 0;
      var d = 0,
        e = 0;
      d = l;
      l = l + 16 | 0;
      e = d;
      c[e >> 2] = a;
      c[e + 4 >> 2] = b;
      b = De(ea(195, e | 0) | 0) | 0;
      l = d;
      return b | 0
    }

    function $d(a) {
      a = a | 0;
      var b = 0,
        d = 0;
      b = l;
      l = l + 16 | 0;
      d = b;
      c[d >> 2] = Vf(a) | 0;
      a = ma(6, d | 0) | 0;
      a = De((a | 0) == -4 ? 0 : a) | 0;
      l = b;
      return a | 0
    }

    function ae(a) {
      a = a | 0;
      var b = 0,
        d = 0;
      b = l;
      l = l + 16 | 0;
      d = b;
      c[d >> 2] = Vf(c[a + 60 >> 2] | 0) | 0;
      a = De(ma(6, d | 0) | 0) | 0;
      l = b;
      return a | 0
    }

    function be(a) {
      a = a | 0;
      He(41452);
      switch (a << 16 >> 16) {
        case 16:
          {
            a = b[20728] | 0;
            break
          }
        case 32:
          {
            a = b[20729] | 0;
            break
          }
        default:
          a = 0
      }
      Oe(41452);
      return a | 0
    }

    function ce(b, c, d) {
      b = b | 0;
      c = c | 0;
      d = d | 0;
      var e = 0;
      e = c & 255;
      do {
        if (!d) {
          c = 0;
          break
        }
        d = d + -1 | 0;
        c = b + d | 0
      } while ((a[c >> 0] | 0) != e << 24 >> 24);
      return c | 0
    }

    function de(a, b, d) {
      a = a | 0;
      b = b | 0;
      d = d | 0;
      var e = 0,
        f = 0;
      e = l;
      l = l + 16 | 0;
      f = e;
      c[f >> 2] = d;
      d = Se(a, b, f) | 0;
      l = e;
      return d | 0
    }

    function ee(a, b, d) {
      a = a | 0;
      b = b | 0;
      d = d | 0;
      var e = 0,
        f = 0;
      e = l;
      l = l + 16 | 0;
      f = e;
      c[f >> 2] = d;
      d = Ab(a, b, f) | 0;
      l = e;
      return d | 0
    }

    function fe(b) {
      b = b | 0;
      var c = 0;
      while (1) {
        c = _e(b, 10) | 0;
        if (!c) break;
        a[c >> 0] = 32
      }
      while (1) {
        c = _e(b, 13) | 0;
        if (!c) break;
        a[c >> 0] = 32
      }
      return
    }

    function ge(a, b) {
      a = a | 0;
      b = b | 0;
      var d = 0,
        e = 0;
      d = l;
      l = l + 16 | 0;
      e = d;
      c[e >> 2] = b;
      b = Ab(c[1883] | 0, a, e) | 0;
      l = d;
      return b | 0
    }

    function he(b, d) {
      b = b | 0;
      d = d | 0;
      var e = 0;
      e = a[d >> 0] | 0;
      a[b + 52 + ((e & 255) << 5) + 11 >> 0] = c[d + 4 >> 2];
      Bc(b, e);
      return
    }

    function ie(b, d) {
      b = b | 0;
      d = d | 0;
      var e = 0;
      e = a[d >> 0] | 0;
      a[b + 52 + ((e & 255) << 5) + 12 >> 0] = c[d + 4 >> 2];
      Bc(b, e);
      return
    }

    function je(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      if ((c | 0) < 32) {
        z = b << c | (a & (1 << c) - 1 << 32 - c) >>> 32 - c;
        return a << c
      }
      z = a << c - 32;
      return 0
    }

    function ke(b, d) {
      b = b | 0;
      d = d | 0;
      var e = 0;
      e = a[d >> 0] | 0;
      a[b + 52 + ((e & 255) << 5) + 9 >> 0] = c[d + 4 >> 2];
      Bc(b, e);
      return
    }

    function le(b, d) {
      b = b | 0;
      d = d | 0;
      var e = 0;
      e = a[d >> 0] | 0;
      a[b + 52 + ((e & 255) << 5) + 13 >> 0] = c[d + 4 >> 2];
      Bc(b, e);
      return
    }

    function me(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      if ((c | 0) < 32) {
        z = b >>> c;
        return a >>> c | (b & (1 << c) - 1) << 32 - c
      }
      z = 0;
      return b >>> c - 32 | 0
    }

    function ne(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      d = b - d | 0;
      d = (d | 0) - (c >>> 0 > a >>> 0 | 0) >>> 0;
      return (z = d, a - c >>> 0 | 0) | 0
    }

    function oe(a) {
      a = +a;
      var b = 0;
      h[j >> 3] = a;
      b = c[j >> 2] | 0;
      z = c[j + 4 >> 2] | 0;
      return b | 0
    }

    function pe(a) {
      a = +a;
      var b = 0;
      h[j >> 3] = a;
      b = c[j >> 2] | 0;
      z = c[j + 4 >> 2] | 0;
      return b | 0
    }

    function qe(a) {
      a = +a;
      var b = 0;
      h[j >> 3] = a;
      b = c[j >> 2] | 0;
      z = c[j + 4 >> 2] | 0;
      return b | 0
    }

    function re(a) {
      a = a | 0;
      var b = 0,
        c = 0;
      c = (Hc(a) | 0) + 1 | 0;
      b = La(c) | 0;
      if (!b) b = 0;
      else yb(b | 0, a | 0, c | 0) | 0;
      return b | 0
    }

    function se(a, b) {
      a = a | 0;
      b = b | 0;
      if (!b) b = 0;
      else b = Bb(c[b >> 2] | 0, c[b + 4 >> 2] | 0, a) | 0;
      return (b | 0 ? b : a) | 0
    }

    function te(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      c = a + c >>> 0;
      return (z = b + d + (c >>> 0 < a >>> 0 | 0) >>> 0, c | 0) | 0
    }

    function ue() {
      var a = 0;
      a = 0;
      while (1) {
        if ((a | 0) == 128) break;
        c[41480 + (a << 2) >> 2] = 0;
        a = a + 1 | 0
      }
      return
    }

    function ve(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      return Ia[a & 7](b | 0, c | 0, d | 0) | 0
    }

    function we(a, d) {
      a = a | 0;
      d = d | 0;
      if ((b[a + 36 >> 1] | 0) >= 0) c[a + 230004 >> 2] = c[d + 4 >> 2];
      return
    }

    function xe(a) {
      a = a | 0;
      if (a | 0) {
        Xa(c[a + 2496 >> 2] | 0);
        Xa(c[a + 2500 >> 2] | 0);
        Xa(a)
      }
      return
    }

    function ye(a) {
      a = a | 0;
      var b = 0;
      b = La((Hc(a) | 0) + 5 | 0) | 0;
      if (!b) b = 0;
      else ef(b, a) | 0;
      return b | 0
    }

    function ze() {
      var a = 0,
        b = 0;
      b = l;
      l = l + 16 | 0;
      a = fa(199, b | 0) | 0;
      l = b;
      return a | 0
    }

    function Ae(a, d) {
      a = a | 0;
      d = d | 0;
      if ((b[a + 36 >> 1] | 0) < 0) c[a + 230004 >> 2] = c[d + 4 >> 2];
      return
    }

    function Be(b, e) {
      b = b | 0;
      e = e | 0;
      a[b + 52 + ((d[e >> 0] | 0) << 5) >> 0] = c[e + 4 >> 2];
      return
    }

    function Ce(a, b) {
      a = a | 0;
      b = b | 0;
      var c = 0;
      c = Hc(a) | 0;
      return ((xd(a, 1, c, b) | 0) != (c | 0)) << 31 >> 31 | 0
    }

    function De(a) {
      a = a | 0;
      if (a >>> 0 > 4294963200) {
        c[($f() | 0) >> 2] = 0 - a;
        a = -1
      }
      return a | 0
    }

    function Ee(a) {
      a = +a;
      return +(+L(+(a + -1416.0996898839683)) * 2247116418577894884661631.0e283 * 2247116418577894884661631.0e283)
    }

    function Fe() {
      var a = 0;
      c[10359] = 0;
      a = c[10358] | 0;
      if (a | 0) {
        Xa(a);
        c[10358] = 0
      }
      return
    }

    function Ge(a) {
      a = a | 0;
      var b = 0;
      b = l;
      l = l + a | 0;
      l = l + 15 & -16;
      return b | 0
    }

    function He(a) {
      a = a | 0;
      while (1) {
        if (!(c[a >> 2] | 0)) break;
        Aa(500) | 0
      }
      c[a >> 2] = 1;
      return
    }

    function Ie(a, b) {
      a = a | 0;
      b = b | 0;
      var c = 0;
      c = Me(a | 0) | 0;
      return ((b | 0) == 0 ? a : c) | 0
    }

    function Je(a, b, d) {
      a = a | 0;
      b = b | 0;
      d = d | 0;
      if (!(c[a >> 2] & 32)) Nb(b, d, a) | 0;
      return
    }

    function Ke(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      return db(a, b, c, d, 0) | 0
    }

    function Le(a, b) {
      a = a | 0;
      b = b | 0;
      return +(+(b >>> 0) / +(a >>> 0) / 1.0e6 * +(e[21285] | 0))
    }

    function Me(a) {
      a = a | 0;
      return (a & 255) << 24 | (a >> 8 & 255) << 16 | (a >> 16 & 255) << 8 | a >>> 24 | 0
    }

    function Ne(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return Ha[a & 31](b | 0, c | 0) | 0
    }

    function Oe(a) {
      a = a | 0;
      var b = 0;
      b = c[a >> 2] | 0;
      if (b | 0) c[a >> 2] = b + -1;
      return
    }

    function Pe(a, b) {
      a = a | 0;
      b = b | 0;
      oa(5, a | 0, b | 0) | 0;
      return 0
    }

    function Qe(a, b) {
      a = a | 0;
      b = b | 0;
      if (!a) a = 0;
      else a = Pb(a, b, 0) | 0;
      return a | 0
    }

    function Re(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      Ja[a & 63](b | 0, c | 0)
    }

    function Se(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return Rb(a, 2147483647, b, c) | 0
    }

    function Te() {
      He(41452);
      b[20728] = 0;
      b[20729] = 0;
      Oe(41452);
      return
    }

    function Ue(a) {
      a = a | 0;
      var b = 0;
      b = (qf(a) | 0) != 0;
      return (b ? a | 32 : a) | 0
    }

    function Ve(a) {
      a = a | 0;
      return Gc(a, c[(Pf() | 0) + 188 >> 2] | 0) | 0
    }

    function We() {
      He(41464);
      Xa(c[10368] | 0);
      c[10368] = 0;
      Oe(41464);
      return
    }

    function Xe(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      Kb(a, b, c) | 0;
      return a | 0
    }

    function Ye(a, b) {
      a = a | 0;
      b = b | 0;
      ef(a + (Hc(a) | 0) | 0, b) | 0;
      return a | 0
    }

    function Ze(a, b) {
      a = a | 0;
      b = b | 0;
      if (!o) {
        o = a;
        p = b
      }
    }

    function _e(a, b) {
      a = a | 0;
      b = b | 0;
      return ce(a, b, (Hc(a) | 0) + 1 | 0) | 0
    }

    function $e(a, b) {
      a = a | 0;
      b = b | 0;
      sc(a, 0);
      return
    }

    function af(a, b) {
      a = a | 0;
      b = b | 0;
      gc(a);
      return
    }

    function bf(a, b) {
      a = a | 0;
      b = b | 0;
      return Ga[a & 1](b | 0) | 0
    }

    function cf(a, b) {
      a = a | 0;
      b = b | 0;
      l = a;
      m = b
    }

    function df(a) {
      a = a | 0;
      return ((a | 0) == 32 | (a + -9 | 0) >>> 0 < 5) & 1 | 0
    }

    function ef(a, b) {
      a = a | 0;
      b = b | 0;
      _b(a, b) | 0;
      return a | 0
    }

    function ff(a, b) {
      a = a | 0;
      b = b | 0;
      return se(a, b) | 0
    }

    function gf(a, b) {
      a = a | 0;
      b = b | 0;
      return +(+xc(a, b, 1))
    }

    function hf(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      S(2);
      return 0
    }

    function jf(a, b) {
      a = a | 0;
      b = b | 0;
      return
    }

    function kf(a, b) {
      a = +a;
      b = +b;
      return +(+Ad(a, b))
    }

    function lf(a, b) {
      a = a | 0;
      b = b | 0;
      return
    }

    function mf(a, b) {
      a = a | 0;
      b = b | 0;
      return
    }

    function nf(a, b) {
      a = +a;
      b = b | 0;
      return +(+oc(a, b))
    }

    function of (a, b) {
      a = a | 0;
      b = b | 0;
      return
    }

    function pf(a, b) {
      a = a | 0;
      b = b | 0;
      return
    }

    function qf(a) {
      a = a | 0;
      return (a + -65 | 0) >>> 0 < 26 | 0
    }

    function rf(a) {
      a = a | 0;
      return (a + -48 | 0) >>> 0 < 10 | 0
    }

    function sf(a) {
      a = a | 0;
      return Zb(a, c[1883] | 0) | 0
    }

    function tf(a, b) {
      a = +a;
      b = b | 0;
      return +(+tc(a, b))
    }

    function uf(a, b) {
      a = a | 0;
      b = b | 0;
      return
    }

    function vf(a, b) {
      a = a | 0;
      b = b | 0;
      return
    }

    function wf(a, b) {
      a = a | 0;
      b = b | 0;
      return
    }

    function xf(a, b) {
      a = a | 0;
      b = b | 0;
      return
    }

    function yf(a, b) {
      a = a | 0;
      b = b | 0;
      return
    }

    function zf(a, b) {
      a = a | 0;
      b = b | 0;
      return
    }

    function Af(a, b) {
      a = a | 0;
      b = b | 0;
      return
    }

    function Bf(a) {
      a = a | 0;
      return Ma(a, 0) | 0
    }

    function Cf(a) {
      a = a | 0;
      return _e(a, 47) | 0
    }

    function Df(a, b) {
      a = a | 0;
      b = b | 0;
      return
    }

    function Ef(a, b) {
      a = +a;
      b = +b;
      return +(+gb(a, b))
    }

    function Ff() {
      na(4) | 0;
      return
    }

    function Gf(a, b) {
      a = a | 0;
      b = b | 0;
      return
    }

    function Hf(a) {
      a = a | 0;
      ua(a | 0);
      return
    }

    function If(a, b) {
      a = a | 0;
      b = b | 0;
      S(1);
      return 0
    }

    function Jf(a) {
      a = a | 0;
      Ea = a
    }

    function Kf(a) {
      a = a | 0;
      Da = a
    }

    function Lf(a) {
      a = a | 0;
      return +(+gf(a, 0))
    }

    function Mf() {
      return bg() | 0
    }

    function Nf(a) {
      a = a | 0;
      Ca = a
    }

    function Of(a, b) {
      a = a | 0;
      b = b | 0;
      S(3)
    }

    function Pf() {
      return bg() | 0
    }

    function Qf() {
      return c[10358] | 0
    }

    function Rf(a) {
      a = a | 0;
      l = a
    }

    function Sf(a) {
      a = a | 0;
      z = a
    }

    function Tf() {
      return Ea | 0
    }

    function Uf(a) {
      a = a | 0;
      S(0);
      return 0
    }

    function Vf(a) {
      a = a | 0;
      return a | 0
    }

    function Wf(a) {
      a = a | 0;
      return
    }

    function Xf(a) {
      a = a | 0;
      return 0
    }

    function Yf() {
      return Da | 0
    }

    function Zf() {
      return 1026
    }

    function _f() {
      return z | 0
    }

    function $f() {
      return 42564
    }

    function ag() {
      return l | 0
    }

    function bg() {
      return 7660
    }

    // EMSCRIPTEN_END_FUNCS
    var Ga = [Uf, ae];
    var Ha = [If, Wc, rc, Nc, jc, vb, mb, ub, lb, cc, Xb, bc, Wb, wb, rb, sb, qb, Pe, Uc, If, If, If, If, If, If, If, If, If, If, If, If, If];
    var Ia = [hf, zb, Tc, ed, Nd, hf, hf, hf];
    var Ja = [Of, af, hb, lc, wf, Gf, Ae, yf, xf, jf, we, Df, zf, kc, Af, Dd, Be, ke, ie, le, he, Bd, Fb, Id, Kd, Yd, Vd, Zd, Xd, yd, zd, dc, Fd, wc, Kc, uf, mf, vf, pf, lf, of , Hd, $e, Of, Of, Of, Of, Of, Of, Of, Of, Of, Of, Of, Of, Of, Of, Of, Of, Of, Of, Of, Of, Of];
    return {
      ___errno_location: $f,
      ___muldi3: Wd,
      ___udivdi3: Ke,
      ___uremdi3: Rd,
      _bitshift64Lshr: me,
      _bitshift64Shl: je,
      _free: Xa,
      _i64Add: te,
      _i64Subtract: ne,
      _llvm_bswap_i32: Me,
      _malloc: La,
      _memcpy: yb,
      _memset: Tb,
      _sbrk: fd,
      _wildwebmidi: ib,
      dynCall_ii: bf,
      dynCall_iii: Ne,
      dynCall_iiii: ve,
      dynCall_vii: Re,
      emtStackRestore: Kf,
      emtStackSave: Yf,
      emterpret: Ka,
      establishStackSpace: cf,
      getEmtStackMax: Tf,
      getTempRet0: _f,
      runPostSets: vd,
      setAsyncState: Nf,
      setEmtStackMax: Jf,
      setTempRet0: Sf,
      setThrew: Ze,
      stackAlloc: Ge,
      stackRestore: Rf,
      stackSave: ag
    }
  })


  // EMSCRIPTEN_END_ASM
  (Module.asmGlobalArg, Module.asmLibraryArg, buffer);
  var ___errno_location = Module["___errno_location"] = asm["___errno_location"];
  var ___muldi3 = Module["___muldi3"] = asm["___muldi3"];
  var ___udivdi3 = Module["___udivdi3"] = asm["___udivdi3"];
  var ___uremdi3 = Module["___uremdi3"] = asm["___uremdi3"];
  var _bitshift64Lshr = Module["_bitshift64Lshr"] = asm["_bitshift64Lshr"];
  var _bitshift64Shl = Module["_bitshift64Shl"] = asm["_bitshift64Shl"];
  var _free = Module["_free"] = asm["_free"];
  var _i64Add = Module["_i64Add"] = asm["_i64Add"];
  var _i64Subtract = Module["_i64Subtract"] = asm["_i64Subtract"];
  var _llvm_bswap_i32 = Module["_llvm_bswap_i32"] = asm["_llvm_bswap_i32"];
  var _malloc = Module["_malloc"] = asm["_malloc"];
  var _memcpy = Module["_memcpy"] = asm["_memcpy"];
  var _memset = Module["_memset"] = asm["_memset"];
  var _sbrk = Module["_sbrk"] = asm["_sbrk"];
  var _wildwebmidi = Module["_wildwebmidi"] = asm["_wildwebmidi"];
  var emtStackRestore = Module["emtStackRestore"] = asm["emtStackRestore"];
  var emtStackSave = Module["emtStackSave"] = asm["emtStackSave"];
  var emterpret = Module["emterpret"] = asm["emterpret"];
  var establishStackSpace = Module["establishStackSpace"] = asm["establishStackSpace"];
  var getEmtStackMax = Module["getEmtStackMax"] = asm["getEmtStackMax"];
  var getTempRet0 = Module["getTempRet0"] = asm["getTempRet0"];
  var runPostSets = Module["runPostSets"] = asm["runPostSets"];
  var setAsyncState = Module["setAsyncState"] = asm["setAsyncState"];
  var setEmtStackMax = Module["setEmtStackMax"] = asm["setEmtStackMax"];
  var setTempRet0 = Module["setTempRet0"] = asm["setTempRet0"];
  var setThrew = Module["setThrew"] = asm["setThrew"];
  var stackAlloc = Module["stackAlloc"] = asm["stackAlloc"];
  var stackRestore = Module["stackRestore"] = asm["stackRestore"];
  var stackSave = Module["stackSave"] = asm["stackSave"];
  var dynCall_ii = Module["dynCall_ii"] = asm["dynCall_ii"];
  var dynCall_iii = Module["dynCall_iii"] = asm["dynCall_iii"];
  var dynCall_iiii = Module["dynCall_iiii"] = asm["dynCall_iiii"];
  var dynCall_vii = Module["dynCall_vii"] = asm["dynCall_vii"];
  Module["asm"] = asm;
  Module["ccall"] = ccall;
  Module["getMemory"] = getMemory;
  Module["addRunDependency"] = addRunDependency;
  Module["removeRunDependency"] = removeRunDependency;
  Module["FS_createFolder"] = FS.createFolder;
  Module["FS_createPath"] = FS.createPath;
  Module["FS_createDataFile"] = FS.createDataFile;
  Module["FS_createPreloadedFile"] = FS.createPreloadedFile;
  Module["FS_createLazyFile"] = FS.createLazyFile;
  Module["FS_createLink"] = FS.createLink;
  Module["FS_createDevice"] = FS.createDevice;
  Module["FS_unlink"] = FS.unlink;
  if (memoryInitializer) {
    if (!isDataURI(memoryInitializer)) {
      if (typeof Module["locateFile"] === "function") {
        memoryInitializer = Module["locateFile"](memoryInitializer)
      } else if (Module["memoryInitializerPrefixURL"]) {
        memoryInitializer = Module["memoryInitializerPrefixURL"] + memoryInitializer
      }
    }
    if (ENVIRONMENT_IS_NODE || ENVIRONMENT_IS_SHELL) {
      var data = Module["readBinary"](memoryInitializer);
      HEAPU8.set(data, GLOBAL_BASE)
    } else {
      addRunDependency("memory initializer");
      var applyMemoryInitializer = (function(data) {
        if (data.byteLength) data = new Uint8Array(data);
        HEAPU8.set(data, GLOBAL_BASE);
        if (Module["memoryInitializerRequest"]) delete Module["memoryInitializerRequest"].response;
        removeRunDependency("memory initializer")
      });

      function doBrowserLoad() {
        Module["readAsync"](memoryInitializer, applyMemoryInitializer, (function() {
          throw "could not load memory initializer " + memoryInitializer
        }))
      }
      var memoryInitializerBytes = tryParseAsDataURI(memoryInitializer);
      if (memoryInitializerBytes) {
        applyMemoryInitializer(memoryInitializerBytes.buffer)
      } else if (Module["memoryInitializerRequest"]) {
        function useRequest() {
          var request = Module["memoryInitializerRequest"];
          var response = request.response;
          if (request.status !== 200 && request.status !== 0) {
            var data = tryParseAsDataURI(Module["memoryInitializerRequestURL"]);
            if (data) {
              response = data.buffer
            } else {
              console.warn("a problem seems to have happened with Module.memoryInitializerRequest, status: " + request.status + ", retrying " + memoryInitializer);
              doBrowserLoad();
              return
            }
          }
          applyMemoryInitializer(response)
        }
        if (Module["memoryInitializerRequest"].response) {
          setTimeout(useRequest, 0)
        } else {
          Module["memoryInitializerRequest"].addEventListener("load", useRequest)
        }
      } else {
        doBrowserLoad()
      }
    }
  }
  Module["then"] = (function(func) {
    if (Module["calledRun"]) {
      func(Module)
    } else {
      var old = Module["onRuntimeInitialized"];
      Module["onRuntimeInitialized"] = (function() {
        if (old) old();
        func(Module)
      })
    }
    return Module
  });

  function ExitStatus(status) {
    this.name = "ExitStatus";
    this.message = "Program terminated with exit(" + status + ")";
    this.status = status
  }
  ExitStatus.prototype = new Error;
  ExitStatus.prototype.constructor = ExitStatus;
  var initialStackTop;
  dependenciesFulfilled = function runCaller() {
    if (!Module["calledRun"]) run();
    if (!Module["calledRun"]) dependenciesFulfilled = runCaller
  };

  function run(args) {
    args = args || Module["arguments"];
    if (runDependencies > 0) {
      return
    }
    preRun();
    if (runDependencies > 0) return;
    if (Module["calledRun"]) return;

    function doRun() {
      if (Module["calledRun"]) return;
      Module["calledRun"] = true;
      if (ABORT) return;
      ensureInitRuntime();
      preMain();
      if (Module["onRuntimeInitialized"]) Module["onRuntimeInitialized"]();
      postRun()
    }
    if (Module["setStatus"]) {
      Module["setStatus"]("Running...");
      setTimeout((function() {
        setTimeout((function() {
          Module["setStatus"]("")
        }), 1);
        doRun()
      }), 1)
    } else {
      doRun()
    }
  }
  Module["run"] = run;

  function exit(status, implicit) {
    if (implicit && Module["noExitRuntime"] && status === 0) {
      return
    }
    if (Module["noExitRuntime"]) {} else {
      ABORT = true;
      EXITSTATUS = status;
      STACKTOP = initialStackTop;
      exitRuntime();
      if (Module["onExit"]) Module["onExit"](status)
    }
    if (ENVIRONMENT_IS_NODE) {
      process["exit"](status)
    }
    Module["quit"](status, new ExitStatus(status))
  }
  Module["exit"] = exit;

  function abort(what) {
    if (Module["onAbort"]) {
      Module["onAbort"](what)
    }
    if (what !== undefined) {
      Module.print(what);
      Module.printErr(what);
      what = JSON.stringify(what)
    } else {
      what = ""
    }
    ABORT = true;
    EXITSTATUS = 1;
    throw "abort(" + what + "). Build with -s ASSERTIONS=1 for more info."
  }
  Module["abort"] = abort;
  if (Module["preInit"]) {
    if (typeof Module["preInit"] == "function") Module["preInit"] = [Module["preInit"]];
    while (Module["preInit"].length > 0) {
      Module["preInit"].pop()()
    }
  }
  Module["noExitRuntime"] = true;
  run()






  return MidiModule;
};
if (typeof exports === 'object' && typeof module === 'object')
  module.exports = MidiModule;
else if (typeof define === 'function' && define['amd'])
  define([], function() {
    return MidiModule;
  });
else if (typeof exports === 'object')
  exports["MidiModule"] = MidiModule;
