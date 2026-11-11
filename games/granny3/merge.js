(function () {
  "use strict";

  const defaultConfig = {
    files: [],
    basePath: "",
    debug: true,
  };

  const config = Object.assign(
    {},
    defaultConfig,
    window.fileMergerConfig || {},
  );
  window.mergedFiles = window.mergedFiles || {};

  const CACHE_NAME = "granny3-cache-v1-port";

  const mergeStatus = {};
  const mergeProgress = {};

  let loadingDiv;
  let loadingContent;
  let updateScheduled = false;

  const fileMap = new Map();
  const urlCache = new Map();
  const downloadCache = new Map();

  const DOWNLOAD_CONCURRENCY = 6;
  const POLL_START_INTERVAL = 10;
  const MAX_POLL_INTERVAL = 100;
  const MAX_WAIT_TIME = 60000;

  let cacheRef = null;

  async function getCache() {
    if (cacheRef) return cacheRef;
    if (!("caches" in window)) return null;
    cacheRef = await caches.open(CACHE_NAME);
    return cacheRef;
  }

  function initializeUI() {
    loadingDiv = document.createElement("div");
    loadingDiv.id = "file-merger-loading";
    loadingDiv.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 30px 40px;
      border-radius: 10px;
      font-family: monospace;
      font-size: 16px;
      z-index: 10000;
      min-width: 320px;
      text-align: center;
      pointer-events: none;
    `;

    loadingContent = document.createElement("div");
    loadingContent.id = "file-merger-content";
    loadingDiv.appendChild(loadingContent);
    document.body.appendChild(loadingDiv);
  }

  function formatBytes(bytes) {
    if (!bytes) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    let i = 0;
    let n = bytes;
    while (n >= 1024 && i < units.length - 1) {
      n /= 1024;
      i++;
    }
    return `${n.toFixed(1)} ${units[i]}`;
  }

  function updateLoadingDisplay() {
    if (updateScheduled) return;

    updateScheduled = true;
    requestAnimationFrame(() => {
      if (!loadingContent) {
        updateScheduled = false;
        return;
      }

      const lines = [
        '<div style="font-size: 18px; margin-bottom: 15px; font-weight: bold; background: linear-gradient(90deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #9400d3); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent;">loading...</div>',
        '<a href="https://nostaligafun.pages.dev/" style="font-size: 15px; color: #d42222; text-decoration: underline; margin-bottom: 10px; display: block;">Nostaliga.fun</a>',
        '<a href="#" style="font-size: 15px; color: #14b4f3; text-decoration: underline; margin-bottom: 10px; display: block;">tuff website</a>',
      ];

      config.files.forEach((file) => {
        const status = mergeStatus[file.name] || "waiting";
        const progress = mergeProgress[file.name] || {
          current: 0,
          total: file.parts,
          partLoaded: 0,
          partTotal: 0,
          partIndex: 0,
        };

        let statusText = "";
        let color = "#888";
        let barHtml = "";

        if (status === "merging") {
          color = "#ffa500";
          const partNum = progress.partIndex || 0;
          const known = progress.partTotal > 0;
          const pct = known
            ? Math.min((progress.partLoaded / progress.partTotal) * 100, 100)
            : 0;
          const widthStyle = known ? `${pct.toFixed(1)}%` : "100%";
          const barColor = known
            ? "#ffa500"
            : "repeating-linear-gradient(90deg, #ffa500 0, #ffa500 10px, #663f00 10px, #663f00 20px)";
          statusText = ` part ${partNum}/${progress.total}`;
          barHtml = `
            <div style="margin: 4px 0; background: #333; border-radius: 4px; height: 10px; width: 100%; overflow: hidden;">
              <div style="height: 100%; width: ${widthStyle}; background: ${barColor}; transition: width 0.1s linear;"></div>
            </div>
            <div style="font-size: 11px; color: #aaa;">${formatBytes(progress.partLoaded)}${known ? " / " + formatBytes(progress.partTotal) : ""}</div>
          `;
        } else if (status === "ready") {
          statusText = " done";
          color = "#00ff00";
        } else if (status === "failed") {
          statusText = " failed";
          color = "#ff0000";
        } else {
          statusText = " waiting...";
        }

        lines.push(
          `<div style="margin: 8px 0; color: ${color}; font-size: 14px;">${file.name}:${statusText}${barHtml}</div>`,
        );
      });

      loadingContent.innerHTML = lines.join("");

      const allDone = config.files.every(
        (file) =>
          mergeStatus[file.name] === "ready" ||
          mergeStatus[file.name] === "failed",
      );

      if (allDone) {
        setTimeout(() => {
          if (loadingDiv) {
            loadingDiv.style.opacity = "0";
            loadingDiv.style.transition = "opacity 0.5s";
            setTimeout(() => {
              if (loadingDiv && loadingDiv.remove) loadingDiv.remove();
            }, 500);
          }
        }, 1000);
      }

      updateScheduled = false;
    });
  }

  function log(...args) {
    if (config.debug) console.log("[FileMerger]", ...args);
  }

  function error(...args) {
    console.error("[FileMerger]", ...args);
  }

  function normalizeUrl(url) {
    try {
      const cleanUrl = decodeURIComponent(url.toString().split("?")[0]);
      return cleanUrl;
    } catch (e) {
      return url;
    }
  }

  function urlsMatch(url1, url2) {
    const norm1 = normalizeUrl(url1);
    const norm2 = normalizeUrl(url2);

    if (norm1 === norm2) return true;
    if (norm1.endsWith(norm2) || norm2.endsWith(norm1)) return true;

    return norm1.split("/").pop() === norm2.split("/").pop();
  }

  function initializeFileMap() {
    fileMap.clear();
    for (const file of config.files) {
      const fileName = file.name;
      const fullPath = config.basePath ? `${config.basePath}${fileName}` : fileName;

      const variants = [
        fileName,
        fullPath,
        fileName + ".br",
        fullPath + ".br",
      ];

      for (const variant of variants) {
        const normalized = normalizeUrl(variant);
        fileMap.set(normalized, file);
      }
    }
  }

  function shouldInterceptFile(url) {
    const urlStr = normalizeUrl(url);

    if (urlStr.includes(".part")) return null;

    const direct = fileMap.get(urlStr);
    if (direct) return direct.name;

    const base = urlStr.split("/").pop();
    for (const [key, file] of fileMap) {
      if (key.split("/").pop() === base) return file.name;
    }

    return null;
  }

  function getMergedFile(filename) {
    if (window.mergedFiles[filename]) return window.mergedFiles[filename];

    for (const [key, value] of Object.entries(window.mergedFiles)) {
      if (urlsMatch(key, filename)) return value;
    }

    return null;
  }

  async function readWithProgress(response, fileName, partIndex) {
    const total = Number(response.headers.get("Content-Length")) || 0;

    if (mergeProgress[fileName]) {
      mergeProgress[fileName].partIndex = partIndex + 1;
      mergeProgress[fileName].partLoaded = 0;
      mergeProgress[fileName].partTotal = total;
      updateLoadingDisplay();
    }

    if (!response.body) {
      const buf = await response.arrayBuffer();
      if (mergeProgress[fileName]) {
        mergeProgress[fileName].partLoaded = buf.byteLength;
        mergeProgress[fileName].partTotal = buf.byteLength;
        mergeProgress[fileName].current++;
        updateLoadingDisplay();
      }
      return buf;
    }

    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
      if (mergeProgress[fileName]) {
        mergeProgress[fileName].partLoaded = received;
        if (!total || received > mergeProgress[fileName].partTotal) {
          mergeProgress[fileName].partTotal = received;
        }
        updateLoadingDisplay();
      }
    }

    if (mergeProgress[fileName]) {
      mergeProgress[fileName].partTotal = received;
    }

    const merged = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }

    if (mergeProgress[fileName]) {
      mergeProgress[fileName].current++;
      updateLoadingDisplay();
    }

    return merged.buffer;
  }

  async function downloadPart(url, partIndex, fileName) {
    if (downloadCache.has(url)) {
      return downloadCache.get(url);
    }

    const promise = (async () => {
      const cache = await getCache();

      if (cache) {
        const cached = await cache.match(url);
        if (cached) {
          log(`cache hit: ${url}`);
          const buf = await readWithProgress(cached, fileName, partIndex);
          return buf;
        }
      }

      const response = await window.originalFetch(url);
      if (!response.ok) {
        if (response.status === 403 || response.status === 404) {
          throw new Error(`Part missing: ${url}`);
        }
        throw new Error(`Failed to load part ${url}: ${response.status}`);
      }

      const buffer = await readWithProgress(response, fileName, partIndex);

      if (cache) {
        const cacheResponse = new Response(buffer.slice(0), {
          headers: { "Content-Length": buffer.byteLength.toString() },
        });
        cache.put(url, cacheResponse).catch(() => {});
      }

      return buffer;
    })();

    downloadCache.set(url, promise);
    return promise;
  }

  async function mergeSplitFiles(filePath, numParts) {
    const fileName = filePath.split("/").pop();
    mergeProgress[fileName] = {
      current: 0,
      total: numParts,
      partLoaded: 0,
      partTotal: 0,
      partIndex: 0,
    };
    updateLoadingDisplay();

    try {
      const parts = Array.from(
        { length: numParts },
        (_, i) => `${filePath}.part${i + 1}`,
      );

      log(`Merging ${filePath} from ${numParts} parts...`);

      const buffers = new Array(numParts);

      for (let i = 0; i < numParts; i++) {
        buffers[i] = await downloadPart(parts[i], i, fileName);
      }

      const totalSize = buffers.reduce((sum, buf) => sum + buf.byteLength, 0);
      const mergedArray = new Uint8Array(totalSize);
      let offset = 0;

      for (const buffer of buffers) {
        mergedArray.set(new Uint8Array(buffer), offset);
        offset += buffer.byteLength;
      }

      for (let i = 1; i <= numParts; i++) {
        downloadCache.delete(`${filePath}.part${i}`);
      }

      log(`${filePath} done: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
      return mergedArray.buffer;
    } catch (err) {
      error(`Failed to merge ${filePath}:`, err);
      throw err;
    }
  }

  if (!window.originalFetch) window.originalFetch = window.fetch;

  window.fetch = function (url, ...args) {
    const filename = shouldInterceptFile(url);

    if (filename) {
      log("Intercepting fetch for:", filename);

      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        let pollInterval = POLL_START_INTERVAL;

        const check = () => {
          const buffer = getMergedFile(filename);

          if (buffer) {
            const contentType = filename.endsWith(".wasm")
              ? "application/wasm"
              : "application/octet-stream";
            resolve(
              new Response(buffer, {
                status: 200,
                statusText: "OK",
                headers: {
                  "Content-Type": contentType,
                  "Content-Length": buffer.byteLength.toString(),
                  "Cache-Control": "no-cache",
                },
              }),
            );
          } else if (mergeStatus[filename] === "failed") {
            reject(new Error(`Merge failed for ${filename}`));
          } else if (Date.now() - startTime > MAX_WAIT_TIME) {
            reject(new Error(`Timeout waiting for ${filename}`));
          } else {
            pollInterval = Math.min(pollInterval * 1.5, MAX_POLL_INTERVAL);
            setTimeout(check, pollInterval);
          }
        };

        check();
      });
    }

    return window.originalFetch.call(this, url, ...args);
  };

  if (!window.OriginalXMLHttpRequest)
    window.OriginalXMLHttpRequest = window.XMLHttpRequest;

  window.XMLHttpRequest = function (options) {
    const xhr = new window.OriginalXMLHttpRequest(options);
    const originalOpen = xhr.open;
    const originalSend = xhr.send;
    let requestUrl = "";
    let pollInterval = POLL_START_INTERVAL;

    xhr.open = function (method, url, ...args) {
      requestUrl = url;
      return originalOpen.call(this, method, url, ...args);
    };

    xhr.send = function (...args) {
      const filename = shouldInterceptFile(requestUrl);

      if (filename) {
        log("Intercepting XHR for:", filename);

        const waitForMerge = () => {
          const buffer = getMergedFile(filename);

          if (buffer) {
            Object.defineProperties(xhr, {
              status: { value: 200, configurable: true },
              statusText: { value: "OK", configurable: true },
              response: { value: buffer, configurable: true },
              responseText: { value: null, configurable: true },
              responseType: { value: "arraybuffer", configurable: true },
              readyState: { value: 4, configurable: true },
            });

            queueMicrotask(() => {
              if (xhr.onreadystatechange) xhr.onreadystatechange();
              if (xhr.onload) xhr.onload({ type: "load", target: xhr });
            });
          } else if (mergeStatus[filename] === "failed") {
            if (xhr.onerror) xhr.onerror(new Error("Merge Failed"));
          } else {
            setTimeout(() => {
              pollInterval = Math.min(pollInterval * 1.5, MAX_POLL_INTERVAL);
              waitForMerge();
            }, pollInterval);
          }
        };

        waitForMerge();
        return;
      }

      return originalSend.call(this, ...args);
    };

    return xhr;
  };

  async function autoMergeFiles() {
    if (!config.files.length) return;

    initializeFileMap();
    updateLoadingDisplay();

    try {
      const promises = config.files.map((file) => {
        const fullPath = config.basePath
          ? `${config.basePath}${file.name}`
          : file.name;

        mergeStatus[file.name] = "merging";
        updateLoadingDisplay();

        return mergeSplitFiles(fullPath, file.parts)
          .then((buffer) => {
            window.mergedFiles[file.name] = buffer;
            window.mergedFiles[fullPath] = buffer;
            mergeStatus[file.name] = "ready";
            updateLoadingDisplay();
          })
          .catch((err) => {
            mergeStatus[file.name] = "failed";
            updateLoadingDisplay();
            error(`Failed to merge ${file.name}:`, err);
          });
      });

      await Promise.all(promises);

      downloadCache.clear();
      log("All files merged successfully");
    } catch (e) {
      error("Auto-merge failed:", e);
    }
  }

  function init() {
    if (document.body) {
      initializeUI();
      autoMergeFiles();
    } else {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
          initializeUI();
          autoMergeFiles();
        });
      } else {
        setTimeout(init, 10);
      }
    }
  }

  init();
})();