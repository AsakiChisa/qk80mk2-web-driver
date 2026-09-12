(() => {
  'use strict';

  const VID = 0x514b;
  const PID = 0x4d02;
  const RAW_USAGE_PAGE = 0xff60;
  const RAW_USAGE = 0x61;
  const BAUD = 115200;
  const CDC_PACKET_SIZE = 64;
  const CDC_PAYLOAD_SIZE = 56;
  const MATRIX_ROWS = 6;
  const MATRIX_COLS = 16;

  const CMD = {
    GET_PROTOCOL: 0x01,
    GET_KEYCODE: 0x04,
    SET_KEYCODE: 0x05,
    CUSTOM_SET: 0x07,
    CUSTOM_GET: 0x08,
    CUSTOM_SAVE: 0x09,
    EEPROM_RESET: 0x0a,
    GET_MACRO_COUNT: 0x0c,
    GET_MACRO_BUFFER_SIZE: 0x0d,
    GET_MACRO_BUFFER: 0x0e,
    SET_MACRO_BUFFER: 0x0f,
    RESET_MACROS: 0x10,
    GET_LAYER_COUNT: 0x11,
    GET_KEYMAP_BUFFER: 0x12,
    SET_KEYMAP_BUFFER: 0x13,
    CDC_SUPPORT: 0xbf,
    TAB_BLOCKS: 0xd1,
  };

  const CHANNEL = { AMBIENT: 0x15, AXIS: 0x16, DOT: 0x1a, FEATURES: 0x11, CONNECT: 0x12, MAGIC: 0x13, DATETIME: 0x19 };
  const PARAM = { BRIGHTNESS: 0x01, EFFECT: 0x02, SPEED: 0x03, COLOR: 0x04 };
  const CDC_CMD = { MATRIX_INIT: 0xc0, MATRIX_DATA: 0xc1 };

  // QK80 MK2 / QMK lighting mode tables, verified against the original QK UI.
  // 0x15 uses the classic RGBLIGHT mode numbering; 0x16 uses RGB Matrix mode numbering.
  const AMBIENT_EFFECTS = [
    'All Off','Solid Color',
    'Breathing 1','Breathing 2','Breathing 3','Breathing 4',
    'Rainbow Mood 1','Rainbow Mood 2','Rainbow Mood 3',
    'Rainbow Swirl 1','Rainbow Swirl 2','Rainbow Swirl 3','Rainbow Swirl 4','Rainbow Swirl 5','Rainbow Swirl 6',
    'Snake 1','Snake 2','Snake 3','Snake 4','Snake 5','Snake 6',
    'Knight 1','Knight 2','Knight 3','Christmas',
    'Gradient 1','Gradient 2','Gradient 3','Gradient 4','Gradient 5','Gradient 6','Gradient 7','Gradient 8','Gradient 9','Gradient 10',
    'RGB Test','Alternating',
    'Twinkle 1','Twinkle 2','Twinkle 3','Twinkle 4','Twinkle 5','Twinkle 6'
  ];

  const AXIS_EFFECTS = [
    'All Off','Solid Color','Alphas Mods','Gradient Up/Down','Gradient Left/Right','Breathing',
    'Band Sat.','Band Val.','Pinwheel Sat.','Pinwheel Val.','Spiral Sat.','Spiral Val.',
    'Cycle All','Cycle Left/Right','Cycle Up/Down','Rainbow Moving Chevron','Cycle Out/In','Cycle Out/In Dual','Cycle Pinwheel','Cycle Spiral',
    'Dual Beacon','Rainbow Beacon','Rainbow Pinwheels','Raindrops','Jellybean Raindrops',
    'Hue Breathing','Hue Pendulum','Hue Wave','Pixel Rain','Pixel Flow','Pixel Fractal','Typing Heatmap','Digital Rain',
    'Solid Reactive Simple','Solid Reactive','Solid Reactive Wide','Solid Reactive Multi Wide','Solid Reactive Cross','Solid Reactive Multi Cross',
    'Solid Reactive Nexus','Solid Reactive Multi Nexus','Spash','Multi Splash','Solid Splash','Solid Multi Splash'
  ];

  const els = Object.fromEntries([
    'httpsBadge','browserBadge','connectHidBtn','connectSerialBtn','disconnectBtn','hidDot','serialDot','hidInfo','serialInfo',
    'probeBtn','protocolValue','layersValue','cdcValue','keyboardLightingGrid','matrixLightingGrid','readKeyboardLightsBtn','readDotLightBtn','pixelGrid','paintColor','fpsSelect',
    'frameList','frameCounter','addBlankFrameBtn','duplicateFrameBtn','deleteFrameBtn','clearFrameBtn','uploadMatrixBtn',
    'uploadProgressWrap','uploadProgress','uploadProgressText','matrixPreview','playPreviewBtn','layerTabs','physicalKeyboard',
    'readPhysicalBtn','physicalStatus','selectedKeyLabel','selectedKeyMeta','pendingKeyName','pendingKeyCode','keyCategoryList',
    'keySearchInput','keyPickerHint','keyPickerContent','cancelRemapBtn','useHexBtn','selectedMatrixMeta','keyLayer','matrixRows','matrixCols',
    'scanMatrixBtn','keyMatrix','keycodeInput','writeKeyBtn','undoKeyBtn','redoKeyBtn','resetKeymapBtn','debugLog','clearLogBtn','toast',
    'readMacrosBtn','importMacrosBtn','exportMacrosBtn','macroFileInput','saveMacrosBtn','macroCountLabel','macroBufferLabel','macroList','macroTitle','macroRecordDelay','macroAddDelayBtn','macroAddActionBtn','macroRecordBtn','macroClearBtn','macroTimeline','macroExpression','macroStatus','macroRecorderOverlay','macroRecorderIndex','macroRecorderCount','macroRecorderLast','macroRecorderPreview','macroStopOverlayBtn','macroActionOverlay','macroActionTitle','macroActionTabs','macroActionKeyAction','macroActionKeyName','macroKeyDatalist','macroActionDelay','macroActionText','macroActionPosition','macroActionCloseBtn','macroActionCancelBtn','macroActionSaveBtn',
    'rgbReadBtn','rgbSaveStaticBtn','rgbClearFrameBtn','rgbPaintColor','rgbPalette','rgbFillBtn','rgbNeutralBtn','rgbPreviewFps','rgbPreviewBtn','rgbLiveFps','rgbLiveBtn','rgbFrameTitle','rgbPainterStatus','rgbWriteProgress','rgbKeyboard','rgbFrameCounter','rgbAddFrameBtn','rgbDuplicateFrameBtn','rgbDeleteFrameBtn','rgbFrameList','rgbSelectedKeyLabel','rgbLedIndexInput','rgbSetLedIndexBtn','rgbTestLedIndexBtn','rgbResetLedMapBtn','rgbMapMeta',
    'profileName','exportProfileBtn','profileExportStatus','profileFileInput','profileSummary','profileApplyConnection','profileApplyMatrix','applyProfileBtn',
    'readDeviceSettingsBtn','magicNkro','magicGui','magicAltGui','magicCapsCtrl','saveMagicBtn','featureLedPower','featureSleep','featureDebounceMode','featureDebounceDelay','saveFeaturesBtn','browserClock','syncTimeBtn','connectMode','saveConnectModeBtn','clearCurrentBindBtn','clearAllBindsBtn','receiverDfuBtn','resetConfirm','eepromResetBtn'
  ].map(id => [id, document.getElementById(id)]));

  let hidDevice = null;
  let serialPort = null;
  let pendingHid = [];
  let hidCommandChain = Promise.resolve();
  let lastHidInput = null;
  let frames = [blankFrame()];
  let currentFrame = 0;
  let activeLayer = 0;
  let layerCount = 4;
  let selectedKey = null;
  let pendingKeycode = null;
  let activeKeyCategory = 'basic';
  let currentLayerCodes = null;
  let remapUndoStack = [];
  let remapRedoStack = [];
  const REMAP_HISTORY_LIMIT = 80;
  let toastTimer = null;
  let previewTimer = null;
  let previewIndex = 0;
  let macroCount = 16;
  let macroBufferSize = 0;
  let macroExpressions = Array(16).fill('');
  let activeMacro = 0;
  let macroDirty = false;
  let macroRecording = false;
  let macroLastEventAt = 0;
  let macroRecorderBaseCount = 0;
  let macroActionEditorMode = 'insert';
  let macroActionEditorIndex = -1;
  let macroActionEditorType = 'key';
  let loadedProfile = null;
  let rgbFrames = [null];
  let rgbCurrentFrame = 0;
  let rgbPreviewTimer = null;
  let rgbPreviewIndex = 0;
  let rgbLiveRunning = false;
  let rgbSelectedVisualIndex = -1;
  let rgbLedMap = [];
  let rgbLastSentFrame = null;
  let rgbBusy = '';
  let matrixPaintMode = '';
  let matrixPaintLastIndex = -1;
  let frameDragFrom = -1;

  // QK80 MK2 visual geometry. Matrix row/col stays protocol-accurate; x/y/w only controls the UI.
  const qkLayout = [
    // Function row
    VK('Esc',0,0,0,0),
    VK('F1',0,1,1.75,0),VK('F2',0,2,2.75,0),VK('F3',0,3,3.75,0),VK('F4',0,4,4.75,0),
    VK('F5',0,5,6,0),VK('F6',0,6,7,0),VK('F7',0,7,8,0),VK('F8',0,8,9,0),
    VK('F9',0,9,10.25,0),VK('F10',0,10,11.25,0),VK('F11',0,11,12.25,0),VK('F12',0,12,13.25,0),
    VK('Ins',0,13,15.25,0),VK('Home',0,14,16.25,0),VK('Vol+',0,15,17.25,0),

    // Number row
    VK('`',1,0,0,1),VK('1',1,1,1,1),VK('2',1,2,2,1),VK('3',1,3,3,1),VK('4',1,4,4,1),VK('5',1,5,5,1),
    VK('6',1,6,6,1),VK('7',1,7,7,1),VK('8',1,8,8,1),VK('9',1,9,9,1),VK('0',1,10,10,1),VK('-',1,11,11,1),VK('=',1,12,12,1),
    VK('Backspace',1,14,13,1,2),VK('Del',2,15,15.25,1),VK('End',2,14,16.25,1),VK('Vol-',1,15,17.25,1),

    // Q row
    VK('Tab',2,0,0,2,1.5),VK('Q',2,1,1.5,2),VK('W',2,2,2.5,2),VK('E',2,3,3.5,2),VK('R',2,4,4.5,2),VK('T',2,5,5.5,2),
    VK('Y',2,6,6.5,2),VK('U',2,7,7.5,2),VK('I',2,8,8.5,2),VK('O',2,9,9.5,2),VK('P',2,10,10.5,2),VK('[',2,11,11.5,2),VK(']',2,12,12.5,2),VK('\\',1,13,13.5,2,1.5),

    // Home row
    VK('Caps',3,0,0,3,1.75),VK('A',3,1,1.75,3),VK('S',3,2,2.75,3),VK('D',3,3,3.75,3),VK('F',3,4,4.75,3),VK('G',3,5,5.75,3),
    VK('H',3,6,6.75,3),VK('J',3,7,7.75,3),VK('K',3,8,8.75,3),VK('L',3,9,9.75,3),VK(';',3,10,10.75,3),VK("'",3,11,11.75,3),VK('Enter',3,13,12.75,3,2.25),
    VK('Scr 1',3,14,15.25,3,.82,'small-special'),VK('Scr 2',3,15,16.25,3,.82,'small-special'),

    // Shift row
    VK('LShift',4,0,0,4,2.25),VK('Z',4,2,2.25,4),VK('X',4,3,3.25,4),VK('C',4,4,4.25,4),VK('V',4,5,5.25,4),VK('B',4,6,6.25,4),
    VK('N',4,7,7.25,4),VK('M',4,8,8.25,4),VK(',',4,9,9.25,4),VK('.',4,10,10.25,4),VK('/',4,11,11.25,4),VK('RShift',4,12,12.25,4,2.75),VK('↑',4,14,16.25,4),

    // Bottom row
    VK('LCtrl',5,0,0,5,1.25),VK('LWin',5,1,1.25,5,1.25),VK('LAlt',5,2,2.5,5,1.25),VK('Space',5,6,3.75,5,6.25),
    VK('RWin',5,10,10,5,1.25),VK('RAlt',5,11,11.25,5,1.25),VK('Fn',5,12,12.5,5,1.25),VK('O',5,13,13.75,5,1.25),
    VK('←',5,14,15.25,5),VK('↓',5,15,16.25,5),VK('→',4,15,17.25,5)
  ];


  function VK(label,row,col,x,y,w=1,cls='') { return {label,row,col,x,y,w,cls}; }
  function blankFrame() { return Array(49).fill('#000000'); }
  function hexByte(n) { return Number(n & 0xff).toString(16).padStart(2, '0'); }
  function hexBytes(arr, max = Infinity) { return Array.from(arr).slice(0, max).map(hexByte).join(' '); }

  function log(tag, message, bytes) {
    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    const suffix = bytes ? `\n    ${hexBytes(bytes)}` : '';
    els.debugLog.textContent += `[${time}] ${tag} ${message}${suffix}\n`;
    els.debugLog.scrollTop = els.debugLog.scrollHeight;
  }

  function toast(message, error = false) {
    clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.classList.toggle('error', error);
    els.toast.classList.add('show');
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), 3000);
  }

  function setDot(el, ok) { el.classList.toggle('ok', !!ok); }

  function checkEnvironment() {
    const secure = window.isSecureContext;
    els.httpsBadge.textContent = secure ? '安全上下文：OK' : '安全上下文：需要 HTTPS / localhost';
    els.httpsBadge.className = `badge ${secure ? 'ok' : 'bad'}`;
    const hid = 'hid' in navigator, serial = 'serial' in navigator;
    els.browserBadge.textContent = `WebHID ${hid ? '✓' : '×'} · Web Serial ${serial ? '✓' : '×'}`;
    els.browserBadge.className = `badge ${hid && serial ? 'ok' : 'bad'}`;
  }

  function isRawQK(device) {
    return device.vendorId === VID && device.productId === PID && device.collections?.some(c => c.usagePage === RAW_USAGE_PAGE && c.usage === RAW_USAGE);
  }

  async function findAuthorizedRawHid() {
    const devices = await navigator.hid.getDevices();
    return devices.find(isRawQK) || null;
  }

  async function connectHid(forcePrompt = false) {
    if (!navigator.hid) throw new Error('当前浏览器不支持 WebHID，请使用桌面 Chrome / Edge。');
    let device = !forcePrompt ? await findAuthorizedRawHid() : null;
    if (!device) {
      const picked = await navigator.hid.requestDevice({ filters: [{ vendorId: VID, productId: PID, usagePage: RAW_USAGE_PAGE, usage: RAW_USAGE }] });
      device = picked.find(isRawQK) || picked.find(d => d.vendorId === VID && d.productId === PID);
    }
    if (!device) throw new Error('没有找到 QK80 MK2 Raw HID 接口。');
    if (!device.opened) await device.open();
    attachHid(device);
    await probeDevice();
    await readPhysicalLayer();
    toast('HID 已连接');
  }

  function attachHid(device) {
    if (hidDevice && hidDevice !== device) hidDevice.removeEventListener('inputreport', onHidInput);
    hidDevice = device;
    hidCommandChain = Promise.resolve();
    lastHidInput = null;
    hidDevice.removeEventListener('inputreport', onHidInput);
    hidDevice.addEventListener('inputreport', onHidInput);
    setDot(els.hidDot, true);
    els.hidInfo.textContent = `${device.productName || 'QK80 MK2'} · 0x${device.vendorId.toString(16)}:0x${device.productId.toString(16)} · Raw HID`;
    els.connectHidBtn.textContent = 'HID 已连接';
  }

  function onHidInput(event) {
    const bytes = new Uint8Array(event.data.buffer, event.data.byteOffset, event.data.byteLength);
    lastHidInput = Array.from(bytes);
    log('HID IN', `report=${event.reportId}`, bytes);
    const idx = pendingHid.findIndex(item => item.prefix.every((v, i) => bytes[i] === v));
    if (idx >= 0) {
      const [item] = pendingHid.splice(idx, 1);
      clearTimeout(item.timer);
      item.resolve(bytes);
    }
  }

  function waitHid(prefix, timeout = 1200) {
    return new Promise((resolve, reject) => {
      const item = { prefix, resolve, reject, timer: null };
      item.timer = setTimeout(() => {
        const i = pendingHid.indexOf(item);
        if (i >= 0) pendingHid.splice(i, 1);
        const last = lastHidInput?.length ? `；最近收到：${hexBytes(lastHidInput.slice(0, Math.max(prefix.length, 8)))}` : '';
        reject(new Error(`HID 响应超时：期待 ${hexBytes(prefix)}${last}`));
      }, timeout);
      pendingHid.push(item);
    });
  }

  async function hidCommandNow(command, args = [], timeout = 1200) {
    if (!hidDevice?.opened) throw new Error('请先连接 HID。');
    const packet = new Uint8Array(32);
    packet.set([command, ...args].slice(0, 32));
    const prefix = [command, ...args];
    const wait = waitHid(prefix, timeout);
    log('HID OUT', '', packet);
    try {
      await hidDevice.sendReport(0, packet);
      return await wait;
    } catch (err) {
      // If sendReport itself fails, remove this command's waiter immediately.
      const idx = pendingHid.findIndex(item => item.prefix === prefix || (item.prefix.length === prefix.length && item.prefix.every((v,i)=>v===prefix[i])));
      if (idx >= 0) {
        const [item] = pendingHid.splice(idx, 1);
        clearTimeout(item.timer);
      }
      throw err;
    }
  }

  function hidCommand(command, args = [], timeout = 1200) {
    // QK/VIA Raw HID is strictly request -> response. Do not let two UI actions
    // talk to the device at the same time; the official driver also serializes commands.
    const task = () => hidCommandNow(command, args, timeout);
    const run = hidCommandChain.then(task, task);
    hidCommandChain = run.catch(() => undefined);
    return run;
  }

  async function getCustom(channel, id) { return await hidCommand(CMD.CUSTOM_GET, [channel, id]); }
  async function setCustom(channel, id, values) {
    await hidCommand(CMD.CUSTOM_SET, [channel, id, ...values]);
    await hidCommand(CMD.CUSTOM_SAVE, [channel]);
  }

  async function probeDevice() {
    if (!hidDevice?.opened) return;
    try {
      const proto = await hidCommand(CMD.GET_PROTOCOL);
      const version = ((proto[1] || 0) << 8) | (proto[2] || 0);
      els.protocolValue.textContent = `0x${version.toString(16).padStart(4, '0')}`;
    } catch { els.protocolValue.textContent = '读取失败'; }
    try {
      const layers = await hidCommand(CMD.GET_LAYER_COUNT);
      layerCount = Math.max(1, Number(layers[1] ?? 4));
      els.layersValue.textContent = layerCount;
      buildLayerTabs();
    } catch { els.layersValue.textContent = layerCount; buildLayerTabs(); }
    if (serialPort?.readable || serialPort?.writable) els.cdcValue.textContent = '已连接';
    else els.cdcValue.textContent = '待连接';
  }

  async function findAuthorizedSerial() {
    if (!navigator.serial) return null;
    const ports = await navigator.serial.getPorts();
    return ports.find(p => {
      const info = p.getInfo();
      return info.usbVendorId === VID && info.usbProductId === PID;
    }) || null;
  }

  async function connectSerial(forcePrompt = false) {
    if (!navigator.serial) throw new Error('当前浏览器不支持 Web Serial，请使用桌面 Chrome / Edge。');
    let port = !forcePrompt ? await findAuthorizedSerial() : null;
    if (!port) port = await navigator.serial.requestPort({ filters: [{ usbVendorId: VID, usbProductId: PID }] });
    if (!port) throw new Error('没有选择 CDC 串口。');
    try {
      if (!port.readable && !port.writable) await port.open({ baudRate: BAUD, bufferSize: CDC_PACKET_SIZE });
    } catch (err) {
      const msg = String(err?.message || err);
      if (/failed to open|access|busy|denied/i.test(msg)) {
        throw new Error('CDC 串口被占用。请关闭 QK 官方网页/串口工具，拔插键盘后再连接。');
      }
      throw err;
    }
    serialPort = port;
    const info = port.getInfo();
    setDot(els.serialDot, true);
    els.serialInfo.textContent = `CDC · ${BAUD} baud · 64 bytes · 0x${(info.usbVendorId || 0).toString(16)}:0x${(info.usbProductId || 0).toString(16)}`;
    els.connectSerialBtn.textContent = 'CDC 已连接';
    els.cdcValue.textContent = '已连接';
    toast('CDC 已连接');
  }

  async function disconnectAll() {
    stopPreview();
    if (serialPort) {
      try { if (serialPort.readable || serialPort.writable) await serialPort.close(); } catch {}
      serialPort = null;
    }
    if (hidDevice) {
      try { if (hidDevice.opened) await hidDevice.close(); } catch {}
      hidDevice = null;
    }
    pendingHid.forEach(x => { clearTimeout(x.timer); x.reject?.(new Error('连接已断开')); });
    pendingHid = [];
    setDot(els.hidDot, false); setDot(els.serialDot, false);
    els.hidInfo.textContent = '未连接'; els.serialInfo.textContent = '未连接';
    els.connectHidBtn.textContent = '连接 HID'; els.connectSerialBtn.textContent = '连接 CDC';
    els.cdcValue.textContent = '—';
    toast('已断开连接');
  }

  function numIntoBytes(num) { return [(num >>> 24) & 0xff, (num >>> 16) & 0xff, (num >>> 8) & 0xff, num & 0xff]; }

  async function readSerial64() {
    if (!serialPort?.readable) throw new Error('CDC 不可读。');
    const reader = serialPort.readable.getReader();
    const out = [];
    try {
      while (out.length < CDC_PACKET_SIZE) {
        const { value, done } = await reader.read();
        if (value) out.push(...value);
        if (done) break;
      }
    } finally { reader.releaseLock(); }
    const result = new Uint8Array(out.slice(0, CDC_PACKET_SIZE));
    log('CDC IN', `${result.length} bytes`, result);
    if (result.length !== CDC_PACKET_SIZE) throw new Error(`CDC 回包长度异常：${result.length}`);
    return result;
  }

  async function serialCommand(command, args = [], withResponse = false) {
    if (!serialPort?.writable) throw new Error('请先连接 CDC。');
    const packet = new Uint8Array(CDC_PACKET_SIZE);
    packet.set([command, ...args].slice(0, CDC_PACKET_SIZE));
    const writer = serialPort.writable.getWriter();
    try { log('CDC OUT', '', packet); await writer.write(packet); }
    finally { writer.releaseLock(); }
    if (!withResponse) return null;
    const resp = await readSerial64();
    for (let i = 0; i < args.length; i++) if (resp[i + 1] !== args[i]) throw new Error(`CDC 回显不一致 @${i}`);
    return resp;
  }

  function rgbToHsvBytes(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max-min;
    let h = 0;
    if (d !== 0) {
      if (max === r) h = 60 * (((g-b)/d)%6);
      else if (max === g) h = 60 * (((b-r)/d)+2);
      else h = 60 * (((r-g)/d)+4);
    }
    if (h < 0) h += 360;
    const s = max === 0 ? 0 : d/max;
    return [Math.round(h/360*255)&0xff, Math.round(s*255), Math.round(max*255)];
  }

  function hsvBytesToHex(hByte, sByte, vByte = 255) {
    const h = ((Number(hByte) & 0xff) / 255) * 360;
    const sat = (Number(sByte) & 0xff) / 255;
    const val = (Number(vByte) & 0xff) / 255;
    const c = val * sat, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = val - c;
    let r1=0,g1=0,b1=0;
    if (h < 60) [r1,g1,b1]=[c,x,0];
    else if (h < 120) [r1,g1,b1]=[x,c,0];
    else if (h < 180) [r1,g1,b1]=[0,c,x];
    else if (h < 240) [r1,g1,b1]=[0,x,c];
    else if (h < 300) [r1,g1,b1]=[x,0,c];
    else [r1,g1,b1]=[c,0,x];
    const toHex=v=>Math.round((v+m)*255).toString(16).padStart(2,'0');
    return `#${toHex(r1)}${toHex(g1)}${toHex(b1)}`;
  }

  async function uploadMatrix() {
    if (!hidDevice?.opened) throw new Error('点阵保存需要先连接 HID。');
    if (!serialPort?.writable) throw new Error('请先连接 CDC。QK80 MK2 自定义点阵实测使用 Web Serial / CDC。');
    const fps = Number(els.fpsSelect.value), raw = [];
    for (const frame of frames) for (const color of frame) raw.push(...rgbToHsvBytes(color));
    els.uploadProgressWrap.classList.remove('hidden'); setUploadProgress(0, raw.length);
    const initArgs = [frames.length, fps, 7, 7];
    const initResp = await serialCommand(CDC_CMD.MATRIX_INIT, initArgs, true);
    if (initResp[5] === 0xee) throw new Error('键盘拒绝点阵初始化（0xEE）。');
    const ackEachChunk = !!initResp[6];
    for (let offset=0; offset<raw.length; offset+=CDC_PAYLOAD_SIZE) {
      const chunk = raw.slice(offset, offset+CDC_PAYLOAD_SIZE);
      await serialCommand(CDC_CMD.MATRIX_DATA, [...numIntoBytes(offset), chunk.length, ...chunk], ackEachChunk);
      setUploadProgress(Math.min(offset+chunk.length, raw.length), raw.length);
    }
    await setCustom(CHANNEL.DOT, PARAM.EFFECT, [0x04]);
    setUploadProgress(raw.length, raw.length);
    toast(`点阵已保存：${frames.length} 帧 / ${fps} FPS · CDC`);
  }

  function setUploadProgress(done,total) {
    const pct = total ? Math.round(done/total*100) : 0;
    els.uploadProgress.style.width = `${pct}%`; els.uploadProgressText.textContent = `${pct}%`;
  }

  const lightDefs = [
    {key:'ambient',name:'氛围灯',channel:CHANNEL.AMBIENT,speed:true,effects:AMBIENT_EFFECTS},
    {key:'axis',name:'轴灯',channel:CHANNEL.AXIS,speed:true,effects:AXIS_EFFECTS},
    {key:'dot',name:'点阵屏',channel:CHANNEL.DOT,speed:false,dotModes:true},
  ];

  function buildLightingUI() {
    if (els.keyboardLightingGrid) els.keyboardLightingGrid.innerHTML='';
    if (els.matrixLightingGrid) els.matrixLightingGrid.innerHTML='';
    for (const def of lightDefs) {
      const host = def.key === 'dot' ? els.matrixLightingGrid : els.keyboardLightingGrid;
      if (!host) continue;
      const card=document.createElement('article'); card.className='card light-card'; card.dataset.channel=def.channel;
      const options=def.dotModes
        ? '<option value="0">All Off (0)</option><option value="1">Typewriter (1)</option><option value="2">Terminal (2)</option><option value="3">Raindrop (3)</option><option value="4">Custom (4)</option>'
        : def.effects.map((name,i)=>`<option value="${i}">${name}</option>`).join('');
      card.innerHTML=`<div class="channel">CHANNEL 0x${hexByte(def.channel)}</div><h3>${def.name}</h3><div class="controls">
        <div class="control-row"><label>亮度</label><input data-role="brightness" type="range" min="0" max="255" value="128"><output data-role="brightnessOut">128</output></div>
        <div class="control-row"><label>灯效 / 模式</label><select data-role="effect">${options}</select><output data-role="effectOut">0</output></div>
        ${def.speed?'<div class="control-row"><label>动画速度</label><input data-role="speed" type="range" min="0" max="255" value="128"><output data-role="speedOut">128</output></div>':''}
        <div class="control-row"><label>颜色</label><input data-role="color" type="color" value="#ff4fa3"><output data-role="colorOut">#FF4FA3</output></div></div>
        <div class="light-actions"><button class="ghost" data-action="read">读取</button><button class="primary" data-action="apply">应用并保存</button></div>`;
      host.appendChild(card);
      const b=card.querySelector('[data-role="brightness"]'); b.addEventListener('input',()=>card.querySelector('[data-role="brightnessOut"]').value=b.value);
      const eff=card.querySelector('[data-role="effect"]'); eff.addEventListener('change',()=>card.querySelector('[data-role="effectOut"]').value=eff.value);
      const speed=card.querySelector('[data-role="speed"]'); if(speed)speed.addEventListener('input',()=>card.querySelector('[data-role="speedOut"]').value=speed.value);
      const color=card.querySelector('[data-role="color"]'); color.addEventListener('input',()=>card.querySelector('[data-role="colorOut"]').value=color.value.toUpperCase());
      card.querySelector('[data-action="read"]').addEventListener('click',()=>safe(()=>readLightCard(card,def)));
      card.querySelector('[data-action="apply"]').addEventListener('click',()=>safe(()=>applyLightCard(card,def)));
    }
  }

  function lightCardFor(def) {
    const host = def.key === 'dot' ? els.matrixLightingGrid : els.keyboardLightingGrid;
    return host?.querySelector(`[data-channel="${def.channel}"]`) || null;
  }

  async function readLightGroup(group) {
    const defs = group === 'dot' ? lightDefs.filter(x=>x.key==='dot') : lightDefs.filter(x=>x.key!=='dot');
    for (const def of defs) {
      const card=lightCardFor(def);
      if (card) await readLightCard(card,def);
    }
    toast(group === 'dot' ? '点阵屏参数读取完成' : '主键盘灯光参数读取完成');
  }

  async function readLightCard(card,def) {
    const b=await getCustom(def.channel,PARAM.BRIGHTNESS), e=await getCustom(def.channel,PARAM.EFFECT), c=await getCustom(def.channel,PARAM.COLOR);
    const brightness=b[3]??0,effect=e[3]??0;
    card.querySelector('[data-role="brightness"]').value=brightness; card.querySelector('[data-role="brightnessOut"]').value=brightness;
    const effectSel=card.querySelector('[data-role="effect"]');
    if (![...effectSel.options].some(o=>Number(o.value)===effect)) { const o=document.createElement('option');o.value=effect;o.textContent=`未知效果 ${effect}`;effectSel.appendChild(o); }
    effectSel.value=effect; card.querySelector('[data-role="effectOut"]').value=effect;
    if(def.speed){const s=await getCustom(def.channel,PARAM.SPEED),speed=s[3]??0;card.querySelector('[data-role="speed"]').value=speed;card.querySelector('[data-role="speedOut"]').value=speed;}
    const rgb=hsvBytesToHex(c[3]||0,c[4]||0,255); card.querySelector('[data-role="color"]').value=rgb;card.querySelector('[data-role="colorOut"]').value=rgb.toUpperCase();
  }

  async function applyLightCard(card,def) {
    const brightness=Number(card.querySelector('[data-role="brightness"]').value), effect=Number(card.querySelector('[data-role="effect"]').value), color=card.querySelector('[data-role="color"]').value;
    const [h,s] = rgbToHsvBytes(color);
    await setCustom(def.channel,PARAM.BRIGHTNESS,[brightness]); await setCustom(def.channel,PARAM.EFFECT,[effect]);
    if(def.speed) await setCustom(def.channel,PARAM.SPEED,[Number(card.querySelector('[data-role="speed"]').value)]);
    await setCustom(def.channel,PARAM.COLOR,[h,s]); toast(`${def.name}已应用`);
  }

  // --- v0.5 Per-Key RGB ----------------------------------------------------
  const PER_KEY_RGB_PREFIX = [0x00, 0x01];
  const RGB_MAP_STORAGE_KEY = 'chisa-qk80mk2-perkey-led-map-v1';
  const RGB_OFF = '__off__';
  const RGB_OFF_COLOR = '#000000';
  const blankRgbFrame = () => Array(qkLayout.length).fill(RGB_OFF);
  const normalizeRgbFrameColor = color => color === RGB_OFF || String(color).toLowerCase() === RGB_OFF_COLOR ? RGB_OFF : (/^#[0-9a-f]{6}$/i.test(String(color)) ? String(color) : RGB_OFF);
  const rgbDisplayColor = color => color === RGB_OFF ? RGB_OFF_COLOR : color;

  function ensureRgbState() {
    if (!rgbLedMap.length) {
      try {
        const saved = JSON.parse(localStorage.getItem(RGB_MAP_STORAGE_KEY) || 'null');
        if (Array.isArray(saved) && saved.length === qkLayout.length) rgbLedMap = saved.map((v,i)=>Number.isFinite(Number(v)) ? Number(v) : i);
      } catch {}
      if (!rgbLedMap.length) rgbLedMap = qkLayout.map((_, i) => i);
    }
    if (!rgbFrames.length || !Array.isArray(rgbFrames[0])) rgbFrames = [blankRgbFrame()];
    rgbFrames = rgbFrames.map(frame => {
      const out = blankRgbFrame();
      if (Array.isArray(frame)) frame.slice(0, qkLayout.length).forEach((c,i)=>out[i]=normalizeRgbFrameColor(c));
      return out;
    });
    rgbCurrentFrame = Math.max(0, Math.min(rgbCurrentFrame, rgbFrames.length - 1));
  }

  function rgbFrame() { ensureRgbState(); return rgbFrames[rgbCurrentFrame]; }
  function rgbToHs(hex) { const [h,s] = rgbToHsvBytes(hex); return [h,s]; }
  function hsToRgb(h,s) { return hsvBytesToHex(h,s,255); }
  function rgbSleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  async function getPerKeyRgb(ledIndex) {
    const resp = await hidCommand(CMD.CUSTOM_GET, [...PER_KEY_RGB_PREFIX, Number(ledIndex)&0xff, 0x01], 1500);
    return [resp[5] ?? 0, resp[6] ?? 0];
  }

  async function setPerKeyRgb(ledIndex, color, commit = false) {
    const [h,s] = rgbToHs(color);
    await hidCommand(CMD.CUSTOM_SET, [...PER_KEY_RGB_PREFIX, Number(ledIndex)&0xff, 0x01, h, s], 1500);
    if (commit) await hidCommand(CMD.CUSTOM_SAVE, [0x00], 1500);
  }

  function buildRgbPalette() {
    const palette = [RGB_OFF_COLOR,'#ff4fa3','#ff3b30','#ff9500','#ffd60a','#34c759','#00c7be','#0a84ff','#5e5ce6','#bf5af2','#ffffff'];
    els.rgbPalette.innerHTML = '';
    palette.forEach(color => {
      const b = document.createElement('button');
      b.className = 'rgb-palette-chip'; b.type = 'button'; b.title = color === RGB_OFF_COLOR ? '黑色 · 熄灭预览' : color; b.style.background = color;
      b.addEventListener('click', () => { els.rgbPaintColor.value = color; });
      els.rgbPalette.appendChild(b);
    });
  }

  function selectRgbKey(i) {
    rgbSelectedVisualIndex = i;
    const item = qkLayout[i];
    document.querySelectorAll('.rgb-keycap.selected').forEach(x=>x.classList.remove('selected'));
    els.rgbKeyboard.querySelector(`[data-rgb-index="${i}"]`)?.classList.add('selected');
    els.rgbSelectedKeyLabel.textContent = `${item.label} · r${item.row} c${item.col}`;
    els.rgbLedIndexInput.value = rgbLedMap[i] ?? i;
  }

  function paintRgbKey(i, color) {
    ensureRgbState();
    const storedColor = normalizeRgbFrameColor(color);
    const displayColor = rgbDisplayColor(storedColor);
    rgbFrames[rgbCurrentFrame][i] = storedColor;
    const key = els.rgbKeyboard.querySelector(`[data-rgb-index="${i}"]`);
    if (key) {
      key.style.setProperty('--rgb-key-color', displayColor);
      key.dataset.color = storedColor;
      key.classList.toggle('rgb-off', storedColor === RGB_OFF);
    }
    updateRgbFrameThumb(rgbCurrentFrame);
    selectRgbKey(i);
  }

  function buildRgbKeyboard() {
    ensureRgbState();
    els.rgbKeyboard.innerHTML = '';
    qkLayout.forEach((item,i) => {
      const b = document.createElement('button');
      b.type='button'; b.className = `rgb-keycap ${item.cls||''}`;
      b.dataset.rgbIndex=i; b.dataset.ledIndex=rgbLedMap[i];
      b.style.setProperty('--kx',item.x); b.style.setProperty('--ky',item.y); b.style.setProperty('--ku',item.w||1);
      b.innerHTML = `<span>${item.label}</span><small>LED ${rgbLedMap[i]}</small>`;
      const paint = (e, color) => { e.preventDefault(); paintRgbKey(i,color); };
      b.addEventListener('pointerdown', e => {
        if(e.button===0) paint(e, els.rgbPaintColor.value);
        else if(e.button===2) paint(e, RGB_OFF);
      });
      b.addEventListener('pointerover', e => {
        if(e.buttons&1) paint(e, els.rgbPaintColor.value);
        else if(e.buttons&2) paint(e, RGB_OFF);
      });
      b.addEventListener('contextmenu', e => { e.preventDefault(); paintRgbKey(i,RGB_OFF); });
      els.rgbKeyboard.appendChild(b);
    });
    renderRgbFrame();
  }

  function renderRgbFrame() {
    ensureRgbState();
    const frame = rgbFrames[rgbCurrentFrame];
    els.rgbKeyboard.querySelectorAll('.rgb-keycap').forEach((b,i)=>{
      const color=frame[i]??RGB_OFF, displayColor=rgbDisplayColor(color); b.style.setProperty('--rgb-key-color',displayColor); b.dataset.color=color;b.classList.toggle('rgb-off',color===RGB_OFF);
      b.querySelector('small').textContent=`LED ${rgbLedMap[i]}`;
      b.classList.toggle('selected',i===rgbSelectedVisualIndex);
    });
    els.rgbFrameTitle.textContent=`Frame ${rgbCurrentFrame+1}`;
    els.rgbFrameCounter.textContent=`${rgbCurrentFrame+1} / ${rgbFrames.length}`;
  }

  function makeRgbThumb(frame) {
    const d=document.createElement('div'); d.className='rgb-mini-grid';
    frame.forEach((color,i)=>{const p=document.createElement('i');p.style.background=rgbDisplayColor(color);p.style.setProperty('--mx',qkLayout[i].x);p.style.setProperty('--my',qkLayout[i].y);p.style.setProperty('--mw',Math.max(.55,qkLayout[i].w||1));d.appendChild(p);});
    return d;
  }

  function renderRgbFrameList() {
    ensureRgbState(); els.rgbFrameList.innerHTML='';
    rgbFrames.forEach((frame,i)=>{
      const b=document.createElement('button');b.type='button';b.className=`rgb-frame-item ${i===rgbCurrentFrame?'active':''}`;
      b.appendChild(makeRgbThumb(frame)); const label=document.createElement('span');label.textContent=`Frame ${i+1}`;b.appendChild(label);
      b.addEventListener('click',()=>{rgbCurrentFrame=i;renderRgbFrame();renderRgbFrameList();}); els.rgbFrameList.appendChild(b);
    });
    els.rgbFrameCounter.textContent=`${rgbCurrentFrame+1} / ${rgbFrames.length}`;
  }

  function updateRgbFrameThumb(i) {
    const item=els.rgbFrameList.children[i]; if(!item)return; const old=item.querySelector('.rgb-mini-grid'); const n=makeRgbThumb(rgbFrames[i]); old?.replaceWith(n);
  }

  function addRgbFrame(copy=true) {
    ensureRgbState(); const frame=copy?[...rgbFrames[rgbCurrentFrame]]:blankRgbFrame();
    rgbFrames.splice(rgbCurrentFrame+1,0,frame);rgbCurrentFrame++;renderRgbFrame();renderRgbFrameList();
  }
  function deleteRgbFrame() {
    ensureRgbState(); if(rgbFrames.length===1){rgbFrames[0]=blankRgbFrame();rgbCurrentFrame=0;}else{rgbFrames.splice(rgbCurrentFrame,1);rgbCurrentFrame=Math.min(rgbCurrentFrame,rgbFrames.length-1);}renderRgbFrame();renderRgbFrameList();
  }
  function fillRgbFrame(color){ensureRgbState();rgbFrames[rgbCurrentFrame]=Array(qkLayout.length).fill(normalizeRgbFrameColor(color));renderRgbFrame();renderRgbFrameList();}
  function clearRgbFrame(){fillRgbFrame(RGB_OFF);els.rgbPainterStatus.textContent='当前帧已清空为熄灭预览；固件不支持把该状态写成单键熄灭。';toast('当前 RGB 帧已清空');}

  function setRgbBusy(label = '') {
    rgbBusy = label;
    const busy = !!label;
    [els.rgbReadBtn, els.rgbSaveStaticBtn, els.rgbTestLedIndexBtn, els.rgbSetLedIndexBtn].forEach(btn => { if (btn) btn.disabled = busy; });
    if (els.rgbLiveBtn && !rgbLiveRunning) els.rgbLiveBtn.disabled = busy;
  }

  async function runRgbExclusive(label, fn) {
    if (rgbBusy) throw new Error(`主键盘 RGB 正在${rgbBusy}，请等待当前操作完成。`);
    if (rgbLiveRunning) throw new Error('请先停止“实时播放到键盘”，再读取或写入静态帧。');
    setRgbBusy(label);
    try { return await fn(); }
    finally { setRgbBusy(''); }
  }

  async function readPerKeyRgbFromKeyboard() {
    if(!hidDevice?.opened)throw new Error('请先连接 HID。'); ensureRgbState();
    els.rgbPainterStatus.textContent='正在读取逐键 RGB…'; const frame=Array(qkLayout.length).fill('#ffffff'); let ok=0,fail=0;
    for(let i=0;i<qkLayout.length;i++){
      try{const [h,s]=await getPerKeyRgb(rgbLedMap[i]);frame[i]=hsToRgb(h,s);ok++;}
      catch(err){fail++;log('WARN',`Per-Key RGB LED ${rgbLedMap[i]} 读取失败：${err.message}`);}
      if(i%5===0||i===qkLayout.length-1)els.rgbWriteProgress.textContent=`读取 ${i+1}/${qkLayout.length}`;
    }
    rgbFrames[rgbCurrentFrame]=frame;renderRgbFrame();renderRgbFrameList();els.rgbWriteProgress.textContent=`读取完成 ${ok}/${qkLayout.length}`;
    els.rgbPainterStatus.textContent=fail?`读取完成：${ok} 成功 / ${fail} 失败；如颜色位置不对应，请用 LED 索引校准。`:'已读取键盘当前逐键色。';toast(`逐键 RGB 读取完成：${ok}/${qkLayout.length}`);
  }

  async function writeRgbFrameToKeyboard(frame, {commit=true, diffFrom=null, progress=true}={}) {
    if(!hidDevice?.opened)throw new Error('请先连接 HID。'); ensureRgbState(); let sent=0;
    const offCount=frame.filter(color=>color===RGB_OFF).length;
    if(offCount)throw new Error(`当前帧含 ${offCount} 个熄灭预览键；QK/VIA 固件没有逐键亮度，无法将黑色写成单键熄灭。请先为这些键选择可写入颜色。`);
    for(let i=0;i<qkLayout.length;i++){
      if(diffFrom && diffFrom[i]===frame[i]) continue;
      await setPerKeyRgb(rgbLedMap[i],frame[i],false); sent++;
      if(progress && (sent%5===0||i===qkLayout.length-1))els.rgbWriteProgress.textContent=`写入 ${i+1}/${qkLayout.length}`;
    }
    if(commit) await hidCommand(CMD.CUSTOM_SAVE,[0x00],1800);
    return sent;
  }

  async function saveRgbStaticFrame() {
    ensureRgbState(); els.rgbWriteProgress.textContent='正在写入…';
    const sent=await writeRgbFrameToKeyboard(rgbFrame(),{commit:true,progress:true}); rgbLastSentFrame=[...rgbFrame()];
    els.rgbWriteProgress.textContent=`已保存 · ${sent} 键`;toast('当前 RGB 帧已写入并保存到键盘');
  }

  function applyRgbWebPreviewFrame(frame) {
    els.rgbKeyboard.querySelectorAll('.rgb-keycap').forEach((b,i)=>{const color=frame[i]??RGB_OFF;b.style.setProperty('--rgb-key-color',rgbDisplayColor(color));b.classList.toggle('rgb-off',color===RGB_OFF);});
  }
  function stopRgbPreview() {
    if(rgbPreviewTimer)clearInterval(rgbPreviewTimer);rgbPreviewTimer=null;els.rgbPreviewBtn.textContent='▶ 网页预览';renderRgbFrame();
  }
  function toggleRgbPreview() {
    if(rgbPreviewTimer){stopRgbPreview();return;} ensureRgbState();rgbPreviewIndex=0;els.rgbPreviewBtn.textContent='■ 停止预览';
    const tick=()=>{applyRgbWebPreviewFrame(rgbFrames[rgbPreviewIndex%rgbFrames.length]);rgbPreviewIndex++;};tick();rgbPreviewTimer=setInterval(tick,1000/Number(els.rgbPreviewFps.value||5));
  }

  async function stopRgbLive() {
    rgbLiveRunning=false;els.rgbLiveBtn.textContent='▶ 实时播放到键盘';els.rgbLiveBtn.classList.remove('recording');els.rgbPainterStatus.textContent='实时播放已停止；键盘保持最后一帧。';
  }
  async function toggleRgbLive() {
    if(rgbLiveRunning){await stopRgbLive();return;} if(rgbBusy)throw new Error(`主键盘 RGB 正在${rgbBusy}，请等待当前操作完成。`); if(!hidDevice?.opened)throw new Error('请先连接 HID。');ensureRgbState();
    rgbLiveRunning=true;els.rgbLiveBtn.textContent='■ 停止实时播放';els.rgbLiveBtn.classList.add('recording');els.rgbPainterStatus.textContent='实时播放中：页面必须保持打开；不会写 SAVE / EEPROM。';
    let idx=0,last=null;
    try{
      while(rgbLiveRunning){
        const started=performance.now(),frame=rgbFrames[idx%rgbFrames.length]; const sent=await writeRgbFrameToKeyboard(frame,{commit:false,diffFrom:last,progress:false});
        last=[...frame];rgbLastSentFrame=last;idx++; const elapsed=performance.now()-started; const target=1000/Number(els.rgbLiveFps.value||2);
        els.rgbWriteProgress.textContent=`实时 Frame ${((idx-1)%rgbFrames.length)+1} · ${sent} 键 · ${Math.round(elapsed)} ms`;
        await rgbSleep(Math.max(0,target-elapsed));
      }
    } catch(err){rgbLiveRunning=false;els.rgbLiveBtn.textContent='▶ 实时播放到键盘';els.rgbLiveBtn.classList.remove('recording');throw err;}
  }

  async function flashTestRgbIndex() {
    if(rgbSelectedVisualIndex<0)throw new Error('请先在画板里点一个键。'); if(!hidDevice?.opened)throw new Error('请先连接 HID。');
    const led=Number(els.rgbLedIndexInput.value); const old=await getPerKeyRgb(led); const test=rgbToHs('#ff0080');
    await hidCommand(CMD.CUSTOM_SET,[...PER_KEY_RGB_PREFIX,led&0xff,1,...test]); await rgbSleep(650); await hidCommand(CMD.CUSTOM_SET,[...PER_KEY_RGB_PREFIX,led&0xff,1,...old]);
    toast(`LED ${led} 闪烁测试完成`);
  }
  function saveRgbLedMapping() {
    if(rgbSelectedVisualIndex<0)throw new Error('请先选择一个键。'); const led=Number(els.rgbLedIndexInput.value);
    if(!Number.isInteger(led)||led<0||led>255)throw new Error('LED Index 必须是 0–255。');rgbLedMap[rgbSelectedVisualIndex]=led;localStorage.setItem(RGB_MAP_STORAGE_KEY,JSON.stringify(rgbLedMap));
    els.rgbMapMeta.textContent='已保存自定义 LED 映射到浏览器本地';buildRgbKeyboard();renderRgbFrameList();selectRgbKey(rgbSelectedVisualIndex);toast('LED 映射已保存');
  }
  function resetRgbLedMapping(){rgbLedMap=qkLayout.map((_,i)=>i);localStorage.removeItem(RGB_MAP_STORAGE_KEY);els.rgbMapMeta.textContent=`默认映射：按本页物理键顺序 0…${qkLayout.length-1}`;buildRgbKeyboard();renderRgbFrameList();toast('已恢复默认 LED 映射');}

  function paintMatrixPixel(index, mode = 'paint') {
    if (!Number.isInteger(index) || index < 0 || index >= 49 || index === matrixPaintLastIndex) return;
    matrixPaintLastIndex = index;
    const frame = frames[currentFrame];
    const color = mode === 'erase' ? '#000000' : els.paintColor.value;
    frame[index] = color;
    const pixel = els.pixelGrid.querySelector(`[data-index="${index}"]`);
    if (pixel) {
      pixel.style.background = color;
      pixel.title = `(${index%7}, ${Math.floor(index/7)}) ${color}`;
    }
    renderPreviewFrame(frame);
  }

  function finishMatrixStroke() {
    if (!matrixPaintMode) return;
    matrixPaintMode = '';
    matrixPaintLastIndex = -1;
    renderFrameList();
  }

  function renderPixelGrid() {
    els.pixelGrid.innerHTML=''; const frame=frames[currentFrame];
    frame.forEach((color,index)=>{
      const p=document.createElement('button');p.type='button';p.className='pixel';p.dataset.index=index;p.style.background=color;p.title=`(${index%7}, ${Math.floor(index/7)}) ${color}`;
      els.pixelGrid.appendChild(p);
    });
    els.frameCounter.textContent=`${currentFrame+1} / ${frames.length}`; renderPreviewFrame(frame);
  }

  function moveFrame(from, to) {
    if (!Number.isInteger(from) || !Number.isInteger(to) || from===to || from<0 || to<0 || from>=frames.length || to>=frames.length) return;
    const selectedFrame = frames[currentFrame];
    const [moved] = frames.splice(from,1);
    frames.splice(to,0,moved);
    currentFrame = Math.max(0, frames.indexOf(selectedFrame));
    renderPixelGrid();
    renderFrameList();
  }

  function renderFrameList() {
    els.frameList.innerHTML=''; frames.forEach((frame,index)=>{
      const button=document.createElement('button');button.type='button';button.className=`frame-item ${index===currentFrame?'active':''}`;button.draggable=true;button.dataset.index=index;button.title='拖拽调整帧顺序';
      const canvas=document.createElement('canvas');canvas.width=7;canvas.height=7;const ctx=canvas.getContext('2d');frame.forEach((color,i)=>{ctx.fillStyle=color;ctx.fillRect(i%7,Math.floor(i/7),1,1);});
      const label=document.createElement('span');label.innerHTML=`<b>Frame ${index+1}</b><i>⋮⋮</i>`;button.append(canvas,label);
      button.addEventListener('click',()=>{currentFrame=index;renderPixelGrid();renderFrameList();});
      button.addEventListener('dragstart',e=>{frameDragFrom=index;button.classList.add('dragging');if(e.dataTransfer){e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',String(index));}});
      button.addEventListener('dragend',()=>{frameDragFrom=-1;document.querySelectorAll('.frame-item.drag-over,.frame-item.dragging').forEach(x=>x.classList.remove('drag-over','dragging'));});
      button.addEventListener('dragover',e=>{e.preventDefault();if(frameDragFrom>=0&&frameDragFrom!==index){document.querySelectorAll('.frame-item.drag-over').forEach(x=>x.classList.remove('drag-over'));button.classList.add('drag-over');if(e.dataTransfer)e.dataTransfer.dropEffect='move';}});
      button.addEventListener('dragleave',()=>button.classList.remove('drag-over'));
      button.addEventListener('drop',e=>{e.preventDefault();button.classList.remove('drag-over');const from=frameDragFrom>=0?frameDragFrom:Number(e.dataTransfer?.getData('text/plain'));moveFrame(from,index);frameDragFrom=-1;});
      els.frameList.appendChild(button);
    });
    els.frameCounter.textContent=`${currentFrame+1} / ${frames.length}`;
  }

  function renderPreviewFrame(frame) {
    const ctx=els.matrixPreview.getContext('2d'); ctx.clearRect(0,0,7,7); frame.forEach((color,i)=>{ctx.fillStyle=color;ctx.fillRect(i%7,Math.floor(i/7),1,1);});
  }
  function startPreview(){ if(previewTimer){stopPreview();return;} previewIndex=0;els.playPreviewBtn.textContent='■ 停止'; const tick=()=>{renderPreviewFrame(frames[previewIndex%frames.length]);previewIndex++;};tick();previewTimer=setInterval(tick,1000/Number(els.fpsSelect.value)); }
  function stopPreview(){ if(previewTimer)clearInterval(previewTimer);previewTimer=null;els.playPreviewBtn.textContent='▶ 预览';renderPreviewFrame(frames[currentFrame]); }
  function addFrame(copyCurrent){const frame=copyCurrent?[...frames[currentFrame]]:blankFrame();frames.splice(currentFrame+1,0,frame);currentFrame++;renderPixelGrid();renderFrameList();}
  function deleteFrame(){if(frames.length===1)return toast('至少保留 1 帧',true);frames.splice(currentFrame,1);currentFrame=Math.min(currentFrame,frames.length-1);renderPixelGrid();renderFrameList();}

  // VIA protocol 12 advanced keycode ranges.
  // Keep these in sync with the-via/app src/utils/key-to-byte/v12.ts.
  const V12 = {
    TO: 0x5200,
    MO: 0x5220,
    DF: 0x5240,
    TG: 0x5260,
    OSL: 0x5280,
    TT: 0x52c0,
    MACRO: 0x7700,
    CUSTOM: 0x7e00,
  };

  const KEY_CATEGORY_META = [
    {id:'basic', label:'基础', desc:'字母、数字、符号、功能键与导航'},
    {id:'media', label:'媒体', desc:'音量、播放与系统媒体控制'},
    {id:'macro', label:'宏', desc:'QMK Macro 0–15'},
    {id:'layer', label:'换层', desc:'MO / TO / TG / DF / OSL / TT'},
    {id:'special', label:'特殊', desc:'系统、浏览器与辅助功能'},
    {id:'lighting', label:'灯光', desc:'QMK RGB / Backlight 功能键'},
    {id:'custom', label:'自定义', desc:'QK Custom 0–15 与 Hex'},
  ];

  const keyItem = (label, code, zh='', aliases=[]) => ({label, code, zh, aliases});
  const alphaItems = Array.from({length:26},(_,i)=>keyItem(String.fromCharCode(65+i),0x0004+i));
  const digitItems = [['1',0x001e],['2',0x001f],['3',0x0020],['4',0x0021],['5',0x0022],['6',0x0023],['7',0x0024],['8',0x0025],['9',0x0026],['0',0x0027]].map(([l,c])=>keyItem(l,c));
  const fItems = Array.from({length:12},(_,i)=>keyItem(`F${i+1}`,0x003a+i));

  const BK = (label,code,x,y,w=1,h=1,zh='') => ({label,code,x,y,w,h,zh});
  // Full-size visual picker used only by the “基础” category. Other categories keep
  // the compact list UI. Positions are UI-only and do not affect the QK matrix.
  const BASIC_PICKER_LAYOUT = [
    BK('Esc',0x0029,0,0), BK('F1',0x003a,2,0),BK('F2',0x003b,3,0),BK('F3',0x003c,4,0),BK('F4',0x003d,5,0),
    BK('F5',0x003e,6.5,0),BK('F6',0x003f,7.5,0),BK('F7',0x0040,8.5,0),BK('F8',0x0041,9.5,0),
    BK('F9',0x0042,11,0),BK('F10',0x0043,12,0),BK('F11',0x0044,13,0),BK('F12',0x0045,14,0),
    BK('PrtSc',0x0046,15.5,0),BK('Scroll',0x0047,16.5,0),BK('Pause',0x0048,17.5,0),

    BK('`',0x0035,0,1),BK('1',0x001e,1,1),BK('2',0x001f,2,1),BK('3',0x0020,3,1),BK('4',0x0021,4,1),BK('5',0x0022,5,1),
    BK('6',0x0023,6,1),BK('7',0x0024,7,1),BK('8',0x0025,8,1),BK('9',0x0026,9,1),BK('0',0x0027,10,1),BK('-',0x002d,11,1),BK('=',0x002e,12,1),BK('Backspace',0x002a,13,1,2),
    BK('Ins',0x0049,15.5,1),BK('Home',0x004a,16.5,1),BK('PgUp',0x004b,17.5,1),
    BK('Num Lock',0x0053,19,1),BK('Num /',0x0054,20,1),BK('Num *',0x0055,21,1),BK('Num -',0x0056,22,1),

    BK('Tab',0x002b,0,2,1.5),BK('Q',0x0014,1.5,2),BK('W',0x001a,2.5,2),BK('E',0x0008,3.5,2),BK('R',0x0015,4.5,2),BK('T',0x0017,5.5,2),
    BK('Y',0x001c,6.5,2),BK('U',0x0018,7.5,2),BK('I',0x000c,8.5,2),BK('O',0x0012,9.5,2),BK('P',0x0013,10.5,2),BK('[',0x002f,11.5,2),BK(']',0x0030,12.5,2),BK('\\',0x0031,13.5,2,1.5),
    BK('Del',0x004c,15.5,2),BK('End',0x004d,16.5,2),BK('PgDn',0x004e,17.5,2),
    BK('Num 7',0x005f,19,2),BK('Num 8',0x0060,20,2),BK('Num 9',0x0061,21,2),BK('Num +',0x0057,22,2,1,2),

    BK('Caps',0x0039,0,3,1.75),BK('A',0x0004,1.75,3),BK('S',0x0016,2.75,3),BK('D',0x0007,3.75,3),BK('F',0x0009,4.75,3),BK('G',0x000a,5.75,3),
    BK('H',0x000b,6.75,3),BK('J',0x000d,7.75,3),BK('K',0x000e,8.75,3),BK('L',0x000f,9.75,3),BK(';',0x0033,10.75,3),BK("'",0x0034,11.75,3),BK('Enter',0x0028,12.75,3,2.25),
    BK('Num 4',0x005c,19,3),BK('Num 5',0x005d,20,3),BK('Num 6',0x005e,21,3),

    BK('LShift',0x00e1,0,4,2.25),BK('Z',0x001d,2.25,4),BK('X',0x001b,3.25,4),BK('C',0x0006,4.25,4),BK('V',0x0019,5.25,4),BK('B',0x0005,6.25,4),
    BK('N',0x0011,7.25,4),BK('M',0x0010,8.25,4),BK(',',0x0036,9.25,4),BK('.',0x0037,10.25,4),BK('/',0x0038,11.25,4),BK('RShift',0x00e5,12.25,4,2.75),
    BK('↑',0x0052,16.5,4), BK('Num 1',0x0059,19,4),BK('Num 2',0x005a,20,4),BK('Num 3',0x005b,21,4),BK('Num Enter',0x0058,22,4,1,2),

    BK('LCtrl',0x00e0,0,5,1.25),BK('LWin',0x00e3,1.25,5,1.25),BK('LAlt',0x00e2,2.5,5,1.25),BK('Space',0x002c,3.75,5,6.25),
    BK('RAlt',0x00e6,10,5,1.25),BK('RWin',0x00e7,11.25,5,1.25),BK('Menu',0x0065,12.5,5,1.25),BK('RCtrl',0x00e4,13.75,5,1.25),
    BK('←',0x0050,15.5,5),BK('↓',0x0051,16.5,5),BK('→',0x004f,17.5,5),
    BK('Num 0',0x0062,19,5,2),BK('Num .',0x0063,21,5),
  ];

  // Safe built-in default for the standard Layer 0 keys we can identify with certainty.
  // QK custom Scr 1 / Scr 2 are intentionally preserved rather than guessed.
  const FACTORY_LAYER0_BY_LABEL = new Map([
    ['Esc',0x0029],['F1',0x003a],['F2',0x003b],['F3',0x003c],['F4',0x003d],['F5',0x003e],['F6',0x003f],['F7',0x0040],['F8',0x0041],['F9',0x0042],['F10',0x0043],['F11',0x0044],['F12',0x0045],
    ['Ins',0x0049],['Home',0x004a],['Vol+',0x00a9],['`',0x0035],['1',0x001e],['2',0x001f],['3',0x0020],['4',0x0021],['5',0x0022],['6',0x0023],['7',0x0024],['8',0x0025],['9',0x0026],['0',0x0027],['-',0x002d],['=',0x002e],
    ['Backspace',0x002a],['Del',0x004c],['End',0x004d],['Vol-',0x00aa],['Tab',0x002b],['Q',0x0014],['W',0x001a],['E',0x0008],['R',0x0015],['T',0x0017],['Y',0x001c],['U',0x0018],['I',0x000c],['O',0x0012],['P',0x0013],['[',0x002f],[']',0x0030],['\\',0x0031],
    ['Caps',0x0039],['A',0x0004],['S',0x0016],['D',0x0007],['F',0x0009],['G',0x000a],['H',0x000b],['J',0x000d],['K',0x000e],['L',0x000f],[';',0x0033],["'",0x0034],['Enter',0x0028],
    ['LShift',0x00e1],['Z',0x001d],['X',0x001b],['C',0x0006],['V',0x0019],['B',0x0005],['N',0x0011],['M',0x0010],[',',0x0036],['.',0x0037],['/',0x0038],['RShift',0x00e5],['↑',0x0052],
    ['LCtrl',0x00e0],['LWin',0x00e3],['LAlt',0x00e2],['Space',0x002c],['RWin',0x00e7],['RAlt',0x00e6],['Fn',V12.MO+1],['←',0x0050],['↓',0x0051],['→',0x004f],
  ]);

  const STATIC_KEY_SECTIONS = {
    basic: [
      {title:'常用', items:[
        keyItem('KC_NO',0x0000,'禁用',['none','disabled','禁用']), keyItem('KC_TRNS',0x0001,'透明',['transparent','透传']),
        keyItem('Esc',0x0029,'退出'), keyItem('Tab',0x002b), keyItem('Caps Lock',0x0039,'大写锁定',['caps']),
        keyItem('Enter',0x0028,'回车'), keyItem('Space',0x002c,'空格'), keyItem('Backspace',0x002a,'退格',['back']),
        keyItem('LCtrl',0x00e0,'左 Ctrl',['ctrl']), keyItem('LShift',0x00e1,'左 Shift'), keyItem('LAlt',0x00e2,'左 Alt'), keyItem('LWin',0x00e3,'左 Win',['gui']),
        keyItem('RCtrl',0x00e4,'右 Ctrl'), keyItem('RShift',0x00e5,'右 Shift'), keyItem('RAlt',0x00e6,'右 Alt'), keyItem('RWin',0x00e7,'右 Win',['gui']),
      ]},
      {title:'字母', items:alphaItems},
      {title:'数字', items:digitItems},
      {title:'符号', items:[
        keyItem('-',0x002d),keyItem('=',0x002e),keyItem('[',0x002f),keyItem(']',0x0030),keyItem('\\',0x0031),
        keyItem(';',0x0033),keyItem("'",0x0034),keyItem('`',0x0035),keyItem(',',0x0036),keyItem('.',0x0037),keyItem('/',0x0038),
      ]},
      {title:'功能键', items:fItems},
      {title:'编辑 / 导航', items:[
        keyItem('Print Screen',0x0046,'截图',['print','pscr']),keyItem('Scroll Lock',0x0047),keyItem('Pause',0x0048),
        keyItem('Insert',0x0049),keyItem('Home',0x004a),keyItem('Page Up',0x004b,'上一页',['pgup']),keyItem('Delete',0x004c,'删除'),
        keyItem('End',0x004d),keyItem('Page Down',0x004e,'下一页',['pgdn']),keyItem('←',0x0050,'左'),keyItem('↓',0x0051,'下'),keyItem('↑',0x0052,'上'),keyItem('→',0x004f,'右'),
      ]},
    ],
    media: [
      {title:'音频 / 播放', items:[
        keyItem('Vol -',0x00aa,'音量-',['volume down','vold']), keyItem('Vol +',0x00a9,'音量+',['volume up','volu']), keyItem('Mute',0x00a8,'静音'),
        keyItem('Play / Pause',0x00ae,'播放/暂停',['play','pause']), keyItem('Stop',0x00ad,'停止'), keyItem('Previous',0x00ac,'上一曲',['prev']), keyItem('Next',0x00ab,'下一曲'),
        keyItem('Rewind',0x00bc,'快退'), keyItem('Fast Forward',0x00bb,'快进',['forward']), keyItem('Media Select',0x00af,'媒体选择'), keyItem('Eject',0x00b0,'弹出'),
      ]},
      {title:'快捷入口', items:[
        keyItem('Mail',0x00b1,'邮件'), keyItem('Calculator',0x00b2,'计算器',['calc']), keyItem('My Computer',0x00b3,'我的电脑'),
        keyItem('Brightness +',0x00bd,'亮度+'), keyItem('Brightness -',0x00be,'亮度-'),
      ]},
    ],
    macro: [
      {title:'Macro', items:Array.from({length:16},(_,i)=>keyItem(`Macro ${i}`,V12.MACRO+i,`宏 ${i}`,[`macro(${i})`]))},
    ],
    special: [
      {title:'系统', items:[
        keyItem('Application',0x0065,'菜单键',['app','menu']), keyItem('Power',0x0066,'电源'), keyItem('Sleep',0x00a6,'睡眠'), keyItem('Wake',0x00a7,'唤醒'),
        keyItem('Execute',0x0074,'执行'), keyItem('Help',0x0075,'帮助'), keyItem('Menu',0x0076,'菜单'), keyItem('Undo',0x007a,'撤销'), keyItem('Cut',0x007b,'剪切'), keyItem('Copy',0x007c,'复制'), keyItem('Paste',0x007d,'粘贴'), keyItem('Find',0x007e,'查找'),
      ]},
      {title:'浏览器', items:[
        keyItem('Search',0x00b4,'搜索'), keyItem('Browser Home',0x00b5,'浏览器主页'), keyItem('Browser Back',0x00b6,'后退'), keyItem('Browser Forward',0x00b7,'前进'), keyItem('Browser Stop',0x00b8,'停止加载'), keyItem('Refresh',0x00b9,'刷新'), keyItem('Favorites',0x00ba,'收藏夹'),
      ]},
    ],
    lighting: [
      {title:'RGB', items:[
        keyItem('RGB Toggle',0x7820,'RGB 开关',['rgb tog']), keyItem('RGB Mode +',0x7821,'RGB 模式+'), keyItem('RGB Mode -',0x7822,'RGB 模式-'),
        keyItem('Hue +',0x7823,'色相+'), keyItem('Hue -',0x7824,'色相-'), keyItem('Sat +',0x7825,'饱和度+'), keyItem('Sat -',0x7826,'饱和度-'),
        keyItem('Bright +',0x7827,'亮度+'), keyItem('Bright -',0x7828,'亮度-'), keyItem('Speed +',0x7829,'速度+'), keyItem('Speed -',0x782a,'速度-'),
        keyItem('Plain',0x782b,'纯色'), keyItem('Breathe',0x782c,'呼吸'), keyItem('Rainbow',0x782d,'彩虹'), keyItem('Swirl',0x782e,'旋涡'), keyItem('Snake',0x782f,'蛇形'), keyItem('Knight',0x7830,'骑士'), keyItem('Xmas',0x7831,'圣诞'), keyItem('Gradient',0x7832,'渐变'),
      ]},
      {title:'Backlight', items:[
        keyItem('BL On',0x7800,'背光开'), keyItem('BL Off',0x7801,'背光关'), keyItem('BL Toggle',0x7802,'背光开关'), keyItem('BL -',0x7803,'背光-'), keyItem('BL +',0x7804,'背光+'), keyItem('BL Cycle',0x7805,'背光循环'), keyItem('BL Breathing',0x7806,'呼吸开关'),
      ]},
    ],
    custom: [
      {title:'QK Custom', items:Array.from({length:16},(_,i)=>keyItem(`CUSTOM(${i})`,V12.CUSTOM+i,`自定义 ${i}`,[`custom ${i}`]))},
    ],
  };

  function layerSections() {
    const layers = Array.from({length:Math.max(1,Math.min(layerCount,8))},(_,i)=>i);
    return [
      {title:'按住切层 MO', items:layers.map(i=>keyItem(`MO(${i})`,V12.MO+i,`按住 Layer ${i}`,[`momentary ${i}`]))},
      {title:'直接切层 TO', items:layers.map(i=>keyItem(`TO(${i})`,V12.TO+i,`切到 Layer ${i}`))},
      {title:'开关层 TG', items:layers.map(i=>keyItem(`TG(${i})`,V12.TG+i,`切换 Layer ${i}`))},
      {title:'默认层 DF', items:layers.map(i=>keyItem(`DF(${i})`,V12.DF+i,`默认 Layer ${i}`))},
      {title:'单次层 OSL', items:layers.map(i=>keyItem(`OSL(${i})`,V12.OSL+i,`单次 Layer ${i}`))},
      {title:'Tap Toggle TT', items:layers.map(i=>keyItem(`TT(${i})`,V12.TT+i,`Tap Toggle Layer ${i}`))},
    ];
  }

  function getKeySections(categoryId) { return categoryId === 'layer' ? layerSections() : (STATIC_KEY_SECTIONS[categoryId] || []); }

  function allKeyItems() {
    return KEY_CATEGORY_META.flatMap(cat => getKeySections(cat.id).flatMap(section => section.items.map(item => ({...item, categoryId:cat.id, categoryLabel:cat.label, sectionTitle:section.title}))));
  }

  function keycodeName(code) {
    if (code>=0x0004&&code<=0x001d) return String.fromCharCode(65+code-4);
    if (code>=0x001e&&code<=0x0027) return code===0x0027?'0':String(code-0x001d);
    if (code>=0x003a&&code<=0x0045) return `F${code-0x0039}`;
    const visualHit=BASIC_PICKER_LAYOUT.find(item=>item.code===code);
    if(visualHit)return visualHit.label;
    const hit = allKeyItems().find(item => item.code === code);
    return hit?.label || `0x${code.toString(16).padStart(4,'0')}`;
  }

  function buildKeyCategories() {
    els.keyCategoryList.innerHTML='';
    for (const cat of KEY_CATEGORY_META) {
      const b=document.createElement('button');
      b.className=`key-category-btn ${cat.id===activeKeyCategory?'active':''}`;
      b.dataset.category=cat.id;
      b.innerHTML=`<strong>${cat.label}</strong><span>${cat.desc}</span>`;
      b.addEventListener('click',()=>{activeKeyCategory=cat.id;els.keySearchInput.value='';buildKeyCategories();renderKeyPicker();});
      els.keyCategoryList.appendChild(b);
    }
  }

  function matchesKeySearch(item, query) {
    const hay=[item.label,item.zh,...(item.aliases||[]),item.categoryLabel,item.sectionTitle,`0x${item.code.toString(16).padStart(4,'0')}`].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(query.toLowerCase());
  }

  function renderBasicKeyboardPicker() {
    els.keyPickerContent.innerHTML='';
    const wrap=document.createElement('section');
    wrap.className='basic-keyboard-picker';
    const quick=document.createElement('div');
    quick.className='basic-keyboard-quick';
    [keyItem('KC_NO',0x0000,'禁用'),keyItem('KC_TRNS',0x0001,'透明')].forEach(item=>{
      const b=document.createElement('button');
      b.className=`basic-quick-key ${pendingKeycode===item.code?'selected':''}`;
      b.innerHTML=`<strong>${item.label}</strong><span>${item.zh}</span>`;
      b.addEventListener('click',()=>{if(!selectedKey)return toast('请先点击上方要修改的实体键',true);setPendingKeycode(item.code,item.label);});
      quick.appendChild(b);
    });
    const note=document.createElement('span');note.className='basic-picker-note';note.textContent='按标准键盘位置选择 · 基础键更容易找到';quick.appendChild(note);
    wrap.appendChild(quick);

    const scroller=document.createElement('div');scroller.className='basic-keyboard-scroll';
    const board=document.createElement('div');board.className='basic-keyboard-board';
    for(const item of BASIC_PICKER_LAYOUT){
      const b=document.createElement('button');
      b.className=`basic-pick-key ${pendingKeycode===item.code?'selected':''}`;
      b.style.setProperty('--bx',item.x);b.style.setProperty('--by',item.y);b.style.setProperty('--bw',item.w||1);b.style.setProperty('--bh',item.h||1);
      b.innerHTML=`<strong>${item.label}</strong>`;
      b.title=`${item.label} · 0x${item.code.toString(16).padStart(4,'0')}`;
      b.addEventListener('click',()=>{if(!selectedKey)return toast('请先点击上方要修改的实体键',true);setPendingKeycode(item.code,item.label);});
      board.appendChild(b);
    }
    scroller.appendChild(board);wrap.appendChild(scroller);els.keyPickerContent.appendChild(wrap);
  }

  function renderKeyPicker() {
    const query=els.keySearchInput.value.trim();
    if(!query && activeKeyCategory==='basic'){
      els.keyPickerHint.textContent='基础 · 键盘布局';
      renderBasicKeyboardPicker();
      return;
    }
    let sections;
    if (query) {
      const results=allKeyItems().filter(item=>matchesKeySearch(item,query));
      sections=[{title:`搜索结果 · ${results.length}`,items:results,search:true}];
      els.keyPickerHint.textContent=`搜索：${query}`;
    } else {
      sections=getKeySections(activeKeyCategory);
      els.keyPickerHint.textContent=KEY_CATEGORY_META.find(x=>x.id===activeKeyCategory)?.label||'';
    }
    els.keyPickerContent.innerHTML='';
    for (const section of sections) {
      const wrap=document.createElement('section');wrap.className='key-picker-section';
      const h=document.createElement('div');h.className='key-picker-section-head';h.innerHTML=`<h4>${section.title}</h4>${section.search?'':'<span>'+section.items.length+' 项</span>'}`;wrap.appendChild(h);
      const grid=document.createElement('div');grid.className='key-option-grid';
      for (const item of section.items) {
        const b=document.createElement('button');b.className=`key-option ${pendingKeycode===item.code?'selected':''}`;
        b.dataset.code=item.code;
        const categoryBadge=section.search?`<em>${item.categoryLabel}</em>`:'';
        b.innerHTML=`${categoryBadge}<strong>${item.label}</strong><span>${item.zh||''}</span><small>0x${item.code.toString(16).padStart(4,'0')}</small>`;
        b.title=[item.label,item.zh,item.aliases?.join(' ')].filter(Boolean).join(' · ');
        b.addEventListener('click',()=>{
          if(!selectedKey){toast('请先点击上方要修改的实体键',true);return;}
          setPendingKeycode(item.code,item.label);
        });
        grid.appendChild(b);
      }
      if (!section.items.length) { const empty=document.createElement('div');empty.className='picker-empty';empty.textContent='没有找到匹配的功能。';grid.appendChild(empty); }
      wrap.appendChild(grid);els.keyPickerContent.appendChild(wrap);
    }
  }

  function updateHistoryButtons(){
    if(els.undoKeyBtn)els.undoKeyBtn.disabled=remapUndoStack.length===0;
    if(els.redoKeyBtn)els.redoKeyBtn.disabled=remapRedoStack.length===0;
    if(els.resetKeymapBtn){
      els.resetKeymapBtn.disabled=!(hidDevice?.opened&&activeLayer===0&&Array.isArray(currentLayerCodes));
      els.resetKeymapBtn.title=activeLayer===0?'恢复 Layer 0 的 QK80 基础出厂键位（Scr 1 / Scr 2 保持不变）':'当前版本仅内置 Layer 0 基础出厂键位';
    }
  }

  function pushRemapHistory(entry){
    remapUndoStack.push(entry);
    if(remapUndoStack.length>REMAP_HISTORY_LIMIT)remapUndoStack.shift();
    remapRedoStack=[];
    updateHistoryButtons();
  }

  function refreshPhysicalKeyVisual(row,col,code){
    if(Array.isArray(currentLayerCodes))currentLayerCodes[row*MATRIX_COLS+col]=code;
    const cell=[...document.querySelectorAll('.keycap')].find(b=>Number(b.dataset.row)===row&&Number(b.dataset.col)===col);
    if(!cell)return;
    cell.dataset.code=code;
    const mappedName=keycodeName(code),physicalLabel=cell.dataset.label||'';
    cell.querySelector('.legend').textContent=mappedName;
    cell.querySelector('.mapped').textContent='';
    cell.title=`${mappedName}${physicalLabel&&physicalLabel!==mappedName?` · 物理位 ${physicalLabel}`:''} · Matrix r${row} c${col}`;
    cell.classList.toggle('empty',code===0);
    if(selectedKey?.visual&&selectedKey.row===row&&selectedKey.col===col&&selectedKey.layer===activeLayer){
      selectedKey.code=code;selectedKey.cell=cell;
      els.selectedKeyMeta.textContent=`当前：${mappedName} · 0x${code.toString(16).padStart(4,'0')}`;
      els.keycodeInput.value=`0x${code.toString(16).padStart(4,'0')}`;
      pendingKeycode=null;els.pendingKeyName.textContent='—';els.pendingKeyCode.textContent='请选择下方功能';
    }
  }

  async function applyHistoryEntry(entry,useAfter){
    if(!hidDevice?.opened)throw new Error('请先连接 HID。');
    for(const change of entry.changes||[]){
      const code=useAfter?change.after:change.before;
      await hidCommand(CMD.SET_KEYCODE,[change.layer,change.row,change.col,(code>>8)&0xff,code&0xff]);
      if(change.layer===activeLayer)refreshPhysicalKeyVisual(change.row,change.col,code);
    }
  }

  async function undoRemap(){
    if(!remapUndoStack.length)return;
    const entry=remapUndoStack.pop();
    await applyHistoryEntry(entry,false);
    remapRedoStack.push(entry);
    updateRemapButtons();renderKeyPicker();
    toast(entry.changes.length>1?`已撤销：${entry.label||'批量改键'}`:`已撤销 ${entry.label||'上一次改键'}`);
  }

  async function redoRemap(){
    if(!remapRedoStack.length)return;
    const entry=remapRedoStack.pop();
    await applyHistoryEntry(entry,true);
    remapUndoStack.push(entry);
    updateRemapButtons();renderKeyPicker();
    toast(entry.changes.length>1?`已恢复：${entry.label||'批量改键'}`:`已恢复 ${entry.label||'上一次改键'}`);
  }

  async function resetLayer0FactoryKeys(){
    if(activeLayer!==0)throw new Error('当前版本仅内置 Layer 0 的基础出厂键位。');
    if(!hidDevice?.opened)throw new Error('请先连接 HID。');
    if(!Array.isArray(currentLayerCodes))await readPhysicalLayer();
    const changes=[];
    for(const item of qkLayout){
      const target=FACTORY_LAYER0_BY_LABEL.get(item.label);
      if(target===undefined)continue;
      const idx=item.row*MATRIX_COLS+item.col;
      const before=currentLayerCodes[idx]??0;
      if(before!==target)changes.push({layer:0,row:item.row,col:item.col,before,after:target,label:item.label});
    }
    if(!changes.length){toast('Layer 0 已经是默认基础键位');return;}
    if(!confirm(`将恢复 Layer 0 的 ${changes.length} 个基础键位到默认布局。\nScr 1 / Scr 2 等 QK 自定义键会保持不变。\n\n本次操作可以用“撤销”恢复。是否继续？`))return;
    for(const change of changes){
      await hidCommand(CMD.SET_KEYCODE,[0,change.row,change.col,(change.after>>8)&0xff,change.after&0xff]);
      refreshPhysicalKeyVisual(change.row,change.col,change.after);
    }
    pushRemapHistory({label:'恢复默认键位',changes});
    updateRemapButtons();renderKeyPicker();
    toast(`已恢复 ${changes.length} 个基础键位`);
  }

  function updateRemapButtons() {
    const changed=!!selectedKey && pendingKeycode!==null && pendingKeycode!==selectedKey.code;
    els.writeKeyBtn.disabled=!changed;
    els.cancelRemapBtn.disabled=pendingKeycode===null;
    updateHistoryButtons();
  }

  function clearPendingKeycode() {
    pendingKeycode=null;
    els.pendingKeyName.textContent='—';
    els.pendingKeyCode.textContent='请选择下方功能';
    if(selectedKey) els.keycodeInput.value=`0x${selectedKey.code.toString(16).padStart(4,'0')}`;
    updateRemapButtons();renderKeyPicker();
  }

  function setPendingKeycode(code,label=keycodeName(code)) {
    pendingKeycode=code;
    els.pendingKeyName.textContent=label||keycodeName(code);
    els.pendingKeyCode.textContent=`0x${code.toString(16).padStart(4,'0')}${selectedKey&&code===selectedKey.code?' · 与当前相同':''}`;
    els.keycodeInput.value=`0x${code.toString(16).padStart(4,'0')}`;
    updateRemapButtons();renderKeyPicker();
  }

  function resetSelectedEditor(message='点击上面的任意键帽开始改键。') {
    selectedKey=null;pendingKeycode=null;
    els.selectedKeyLabel.textContent='尚未选择键帽';els.selectedKeyMeta.textContent=message;
    els.selectedMatrixMeta.textContent='尚未选择键帽';
    els.pendingKeyName.textContent='—';els.pendingKeyCode.textContent='请选择下方功能';
    els.keycodeInput.value='0x0000';updateRemapButtons();renderKeyPicker();
  }

  function buildLayerTabs(){els.layerTabs.innerHTML='';for(let i=0;i<layerCount;i++){const b=document.createElement('button');b.className=`layer-btn ${i===activeLayer?'active':''}`;b.textContent=`Layer ${i}`;b.addEventListener('click',()=>safe(async()=>{activeLayer=i;els.keyLayer.value=i;buildLayerTabs();await readPhysicalLayer();}));els.layerTabs.appendChild(b);}if(activeKeyCategory==='layer')renderKeyPicker();updateHistoryButtons();}

  function buildPhysicalKeyboard(){
    els.physicalKeyboard.innerHTML='';
    for(const item of qkLayout){
      const b=document.createElement('button');
      b.className=`keycap ${item.cls||''}`;
      b.dataset.row=item.row;b.dataset.col=item.col;b.dataset.label=item.label;
      b.style.setProperty('--kx',item.x);b.style.setProperty('--ky',item.y);b.style.setProperty('--ku',item.w||1);
      b.innerHTML=`<span class="legend">${item.label}</span><span class="mapped">—</span>`;
      b.title=`${item.label} · Matrix r${item.row} c${item.col}`;
      b.addEventListener('click',()=>selectPhysicalKey(item,b));
      els.physicalKeyboard.appendChild(b);
    }
  }

  async function readLayerFast(layer){
    const totalKeys=MATRIX_ROWS*MATRIX_COLS,totalBytes=totalKeys*2,base=layer*totalBytes,bytes=[];
    for(let off=0;off<totalBytes;off+=28){const len=Math.min(28,totalBytes-off),absolute=base+off,args=[(absolute>>8)&0xff,absolute&0xff,len];const resp=await hidCommand(CMD.GET_KEYMAP_BUFFER,args,1400);bytes.push(...Array.from(resp.slice(4,4+len)));}
    if(bytes.length<totalBytes)throw new Error(`快速读取长度不足：${bytes.length}/${totalBytes}`);
    const codes=[];for(let i=0;i<totalBytes;i+=2)codes.push((bytes[i]<<8)|bytes[i+1]);return codes;
  }

  async function readLayerSlow(layer){const codes=[];for(let row=0;row<MATRIX_ROWS;row++)for(let col=0;col<MATRIX_COLS;col++){const resp=await hidCommand(CMD.GET_KEYCODE,[layer,row,col],900);codes.push(((resp[4]||0)<<8)|(resp[5]||0));}return codes;}

  async function readPhysicalLayer(){
    if(!hidDevice?.opened)throw new Error('请先连接 HID。');
    els.physicalStatus.textContent=`正在读取 Layer ${activeLayer}…`;
    try{currentLayerCodes=await readLayerFast(activeLayer);log('INFO',`Layer ${activeLayer} 使用快速 keymap buffer 读取`);}catch(err){log('WARN',`快速读取失败，回退逐键读取：${err.message}`);currentLayerCodes=await readLayerSlow(activeLayer);}
    document.querySelectorAll('.keycap').forEach(b=>{
      const row=Number(b.dataset.row),col=Number(b.dataset.col),code=currentLayerCodes[row*MATRIX_COLS+col]??0;
      b.dataset.code=code;
      const mappedName=keycodeName(code);
      const physicalLabel=b.dataset.label||'';
      b.querySelector('.legend').textContent=mappedName;
      b.querySelector('.mapped').textContent='';
      b.title=`${mappedName}${physicalLabel&&physicalLabel!==mappedName?` · 物理位 ${physicalLabel}`:''} · Matrix r${row} c${col}`;
      b.classList.toggle('empty',code===0);b.classList.remove('selected');
    });
    resetSelectedEditor(`Layer ${activeLayer} 读取完成 · ${MATRIX_ROWS}×${MATRIX_COLS}`);els.physicalStatus.textContent=`Layer ${activeLayer} 已读取 · 点击键帽改键`;updateHistoryButtons();toast(`Layer ${activeLayer} 读取完成`);
  }

  function selectPhysicalKey(item,button){
    document.querySelectorAll('.keycap.selected').forEach(x=>x.classList.remove('selected'));
    button.classList.add('selected');
    const code=Number(button.dataset.code||0);
    selectedKey={layer:activeLayer,row:item.row,col:item.col,code,cell:button,visual:true,label:item.label};
    pendingKeycode=null;
    els.selectedKeyLabel.textContent=item.label;
    els.selectedKeyMeta.textContent=`当前：${keycodeName(code)} · 0x${code.toString(16).padStart(4,'0')}`;
    els.selectedMatrixMeta.textContent=`Layer ${activeLayer} · Row ${item.row} · Col ${item.col}`;
    els.keycodeInput.value=`0x${code.toString(16).padStart(4,'0')}`;
    els.pendingKeyName.textContent='—';els.pendingKeyCode.textContent='请选择下方功能';
    updateRemapButtons();renderKeyPicker();
  }

  async function scanMatrix(){
    if(!hidDevice?.opened)throw new Error('请先连接 HID。');const layer=Number(els.keyLayer.value),rows=Number(els.matrixRows.value),cols=Number(els.matrixCols.value);els.keyMatrix.className='key-matrix';els.keyMatrix.style.gridTemplateColumns=`repeat(${cols},74px)`;els.keyMatrix.innerHTML='';
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){let code=0;try{const resp=await hidCommand(CMD.GET_KEYCODE,[layer,row,col],900);code=((resp[4]||0)<<8)|(resp[5]||0);}catch(err){log('WARN',`L${layer} R${row} C${col}: ${err.message}`);}const cell=document.createElement('button');cell.className='key-cell';cell.dataset.layer=layer;cell.dataset.row=row;cell.dataset.col=col;cell.dataset.code=code;cell.innerHTML=`<strong>${keycodeName(code)}</strong><span>r${row} c${col} · ${code.toString(16).padStart(4,'0')}</span>`;cell.addEventListener('click',()=>selectRawKeyCell(cell));els.keyMatrix.appendChild(cell);}toast('原始矩阵扫描完成');
  }

  function selectRawKeyCell(cell){
    document.querySelectorAll('.key-cell.selected').forEach(x=>x.classList.remove('selected'));cell.classList.add('selected');
    selectedKey={layer:Number(cell.dataset.layer),row:Number(cell.dataset.row),col:Number(cell.dataset.col),code:Number(cell.dataset.code),cell,visual:false,label:`Matrix r${cell.dataset.row} c${cell.dataset.col}`};
    pendingKeycode=null;
    els.selectedKeyLabel.textContent=selectedKey.label;
    els.selectedKeyMeta.textContent=`当前：${keycodeName(selectedKey.code)} · 0x${selectedKey.code.toString(16).padStart(4,'0')}`;
    els.selectedMatrixMeta.textContent=`Layer ${selectedKey.layer} · Row ${selectedKey.row} · Col ${selectedKey.col}`;
    els.keycodeInput.value=`0x${selectedKey.code.toString(16).padStart(4,'0')}`;
    els.pendingKeyName.textContent='—';els.pendingKeyCode.textContent='请选择下方功能';updateRemapButtons();renderKeyPicker();
  }

  async function writeSelectedKey(){
    if(!selectedKey)throw new Error('请先选择一个键。');
    if(pendingKeycode===null)throw new Error('请先从下方键池选择准备写入的功能。');
    const code=pendingKeycode;
    if(code===selectedKey.code){toast('目标 Keycode 与当前相同，无需写入');return;}
    const before=selectedKey.code;
    const historyChange={layer:selectedKey.layer,row:selectedKey.row,col:selectedKey.col,before,after:code,label:selectedKey.label};
    await hidCommand(CMD.SET_KEYCODE,[selectedKey.layer,selectedKey.row,selectedKey.col,(code>>8)&0xff,code&0xff]);
    selectedKey.code=code;selectedKey.cell.dataset.code=code;
    if(selectedKey.visual){
      const mappedName=keycodeName(code);
      const physicalLabel=selectedKey.cell.dataset.label||selectedKey.label||'';
      selectedKey.cell.querySelector('.legend').textContent=mappedName;
      selectedKey.cell.querySelector('.mapped').textContent='';
      selectedKey.cell.title=`${mappedName}${physicalLabel&&physicalLabel!==mappedName?` · 物理位 ${physicalLabel}`:''} · Matrix r${selectedKey.row} c${selectedKey.col}`;
      selectedKey.cell.classList.toggle('empty',code===0);
      currentLayerCodes[selectedKey.row*MATRIX_COLS+selectedKey.col]=code;
      selectedKey.cell.classList.add('write-ok');setTimeout(()=>selectedKey?.cell?.classList.remove('write-ok'),650);
    }
    else selectedKey.cell.innerHTML=`<strong>${keycodeName(code)}</strong><span>r${selectedKey.row} c${selectedKey.col} · ${code.toString(16).padStart(4,'0')}</span>`;
    els.selectedKeyMeta.textContent=`当前：${keycodeName(code)} · 0x${code.toString(16).padStart(4,'0')}`;
    pendingKeycode=null;els.pendingKeyName.textContent='—';els.pendingKeyCode.textContent='请选择下方功能';els.keycodeInput.value=`0x${code.toString(16).padStart(4,'0')}`;
    pushRemapHistory({label:`${historyChange.label}: ${keycodeName(before)} → ${keycodeName(code)}`,changes:[historyChange]});updateRemapButtons();renderKeyPicker();toast('键位已写入');
  }

  function useHexAsPending(){
    if(!selectedKey)throw new Error('请先选择一个键。');
    const text=els.keycodeInput.value.trim().toLowerCase();
    const code=text.startsWith('0x')?parseInt(text.slice(2),16):parseInt(text,16);
    if(!Number.isFinite(code)||code<0||code>0xffff)throw new Error('Keycode 请输入 0x0000 ~ 0xFFFF。');
    setPendingKeycode(code,keycodeName(code));
  }

  // ---------------- v0.4: Macros / Profiles / Device settings ----------------
  const MACRO = { PREFIX: 0x01, TERM: 0x00, DELAY_TERM: 0x7c, TAP: 0x01, DOWN: 0x02, UP: 0x03, DELAY: 0x04 };
  const macroNameToByte = {};
  const macroByteToName = {};
  function addMacroKey(name, byte, aliases=[]) {
    macroNameToByte[name] = byte; macroByteToName[byte] = name;
    for (const a of aliases) macroNameToByte[a] = byte;
  }
  for (let i=0;i<26;i++) addMacroKey(`KC_${String.fromCharCode(65+i)}`,0x04+i);
  ['1','2','3','4','5','6','7','8','9','0'].forEach((n,i)=>addMacroKey(`KC_${n}`,0x1e+i));
  [
    ['KC_ENT',0x28,['KC_ENTER']],['KC_ESC',0x29],['KC_BSPC',0x2a,['KC_BACKSPACE']],['KC_TAB',0x2b],['KC_SPC',0x2c,['KC_SPACE']],
    ['KC_MINS',0x2d],['KC_EQL',0x2e],['KC_LBRC',0x2f],['KC_RBRC',0x30],['KC_BSLS',0x31],['KC_SCLN',0x33],['KC_QUOT',0x34],['KC_GRV',0x35],['KC_COMM',0x36],['KC_DOT',0x37],['KC_SLSH',0x38],['KC_CAPS',0x39],
    ['KC_PSCR',0x46],['KC_SCRL',0x47],['KC_PAUS',0x48],['KC_INS',0x49],['KC_HOME',0x4a],['KC_PGUP',0x4b],['KC_DEL',0x4c],['KC_END',0x4d],['KC_PGDN',0x4e],['KC_RGHT',0x4f],['KC_LEFT',0x50],['KC_DOWN',0x51],['KC_UP',0x52],['KC_APP',0x65],
    ['KC_LCTL',0xe0],['KC_LSFT',0xe1],['KC_LALT',0xe2],['KC_LGUI',0xe3],['KC_RCTL',0xe4],['KC_RSFT',0xe5],['KC_RALT',0xe6],['KC_RGUI',0xe7]
  ].forEach(([n,b,a=[]])=>addMacroKey(n,b,a));
  for(let i=0;i<12;i++) addMacroKey(`KC_F${i+1}`,0x3a+i);
  [
    ['KC_MS_UP',0xcd],['KC_MS_DOWN',0xce],['KC_MS_LEFT',0xcf],['KC_MS_RIGHT',0xd0],
    ['KC_MS_BTN1',0xd1,['KC_BTN1']],['KC_MS_BTN2',0xd2,['KC_BTN2']],['KC_MS_BTN3',0xd3,['KC_BTN3']],['KC_MS_BTN4',0xd4,['KC_BTN4']],
    ['KC_MS_BTN5',0xd5,['KC_BTN5']],['KC_MS_BTN6',0xd6,['KC_BTN6']],['KC_MS_BTN7',0xd7,['KC_BTN7']],['KC_MS_BTN8',0xd8,['KC_BTN8']],
    ['KC_MS_WH_UP',0xd9],['KC_MS_WH_DOWN',0xda],['KC_MS_WH_LEFT',0xdb],['KC_MS_WH_RIGHT',0xdc]
  ].forEach(([n,b,a=[]])=>addMacroKey(n,b,a));

  const eventCodeToMacroKey = {
    Escape:'KC_ESC',Tab:'KC_TAB',CapsLock:'KC_CAPS',Enter:'KC_ENT',Space:'KC_SPC',Backspace:'KC_BSPC',
    Minus:'KC_MINS',Equal:'KC_EQL',BracketLeft:'KC_LBRC',BracketRight:'KC_RBRC',Backslash:'KC_BSLS',Semicolon:'KC_SCLN',Quote:'KC_QUOT',Backquote:'KC_GRV',Comma:'KC_COMM',Period:'KC_DOT',Slash:'KC_SLSH',
    Insert:'KC_INS',Home:'KC_HOME',PageUp:'KC_PGUP',Delete:'KC_DEL',End:'KC_END',PageDown:'KC_PGDN',ArrowRight:'KC_RGHT',ArrowLeft:'KC_LEFT',ArrowDown:'KC_DOWN',ArrowUp:'KC_UP',
    ControlLeft:'KC_LCTL',ShiftLeft:'KC_LSFT',AltLeft:'KC_LALT',MetaLeft:'KC_LGUI',ControlRight:'KC_RCTL',ShiftRight:'KC_RSFT',AltRight:'KC_RALT',MetaRight:'KC_RGUI'
  };
  for(let i=0;i<26;i++) eventCodeToMacroKey[`Key${String.fromCharCode(65+i)}`]=`KC_${String.fromCharCode(65+i)}`;
  for(let i=0;i<=9;i++) eventCodeToMacroKey[`Digit${i}`]=`KC_${i}`;
  for(let i=1;i<=12;i++) eventCodeToMacroKey[`F${i}`]=`KC_F${i}`;

  const mouseButtonToMacroKey = {
    0:'KC_MS_BTN1', // 左键
    2:'KC_MS_BTN2', // 右键
    1:'KC_MS_BTN3', // 中键
    3:'KC_MS_BTN4', // 后退侧键
    4:'KC_MS_BTN5', // 前进侧键
    5:'KC_MS_BTN6',
    6:'KC_MS_BTN7',
    7:'KC_MS_BTN8'
  };
  const macroFriendlyNames = {
    KC_MS_BTN1:'鼠标左键',KC_MS_BTN2:'鼠标右键',KC_MS_BTN3:'鼠标中键',KC_MS_BTN4:'鼠标侧键 1',KC_MS_BTN5:'鼠标侧键 2',
    KC_MS_BTN6:'鼠标按钮 6',KC_MS_BTN7:'鼠标按钮 7',KC_MS_BTN8:'鼠标按钮 8',
    KC_MS_WH_UP:'滚轮上',KC_MS_WH_DOWN:'滚轮下',KC_MS_WH_LEFT:'滚轮左',KC_MS_WH_RIGHT:'滚轮右',
    KC_MS_UP:'鼠标上移',KC_MS_DOWN:'鼠标下移',KC_MS_LEFT:'鼠标左移',KC_MS_RIGHT:'鼠标右移',
    KC_LCTL:'左 Ctrl',KC_LSFT:'左 Shift',KC_LALT:'左 Alt',KC_LGUI:'左 Win',
    KC_RCTL:'右 Ctrl',KC_RSFT:'右 Shift',KC_RALT:'右 Alt',KC_RGUI:'右 Win',
    KC_ENT:'Enter',KC_ESC:'Esc',KC_BSPC:'Backspace',KC_TAB:'Tab',KC_SPC:'Space'
  };
  function macroFriendlyName(name){return macroFriendlyNames[name]||name.replace(/^KC_/,'');}
  function macroKeyChoices(){
    return Object.entries(macroByteToName)
      .map(([byte,name])=>({byte:Number(byte),name,label:macroFriendlyName(name)}))
      .sort((a,b)=>a.label.localeCompare(b.label,'zh-CN',{numeric:true}));
  }
  function populateMacroKeyDatalist(){
    if(!els.macroKeyDatalist)return;
    els.macroKeyDatalist.innerHTML='';
    for(const item of macroKeyChoices()){
      const o=document.createElement('option');o.value=item.name;o.label=`${item.label} · 0x${item.byte.toString(16).padStart(2,'0')}`;els.macroKeyDatalist.appendChild(o);
    }
  }
  function resolveMacroKeyName(value){
    const raw=String(value||'').trim();if(!raw)return null;
    const upper=raw.toUpperCase();
    if(macroNameToByte[upper]!==undefined)return upper;
    const choices=macroKeyChoices();
    const byFriendly=choices.find(x=>x.label.toUpperCase()===upper || `${x.label} · ${x.name}`.toUpperCase()===upper);
    return byFriendly?.name||null;
  }
  function macroRawForAction(type,{name='',action='tap',ms=100,text=''}={}){
    if(type==='delay')return `{${Math.max(1,Math.min(9999,Math.round(Number(ms)||100)))}}`;
    if(type==='text')return String(text||'').replace(/[{}]/g,'');
    const key=resolveMacroKeyName(name);if(!key)throw new Error('请选择有效的键盘 / 鼠标 Keycode。');
    return action==='down'?`{+${key}}`:action==='up'?`{-${key}}`:`{${key}}`;
  }
  function setMacroActionType(type){
    macroActionEditorType=type;
    els.macroActionTabs?.querySelectorAll('[data-action-type]').forEach(b=>b.classList.toggle('active',b.dataset.actionType===type));
    document.querySelectorAll('[data-action-panel]').forEach(p=>p.classList.toggle('hidden',p.dataset.actionPanel!==type));
  }
  function openMacroActionEditor(mode='insert',index=-1,preferredType='key'){
    const events=parseMacroVisual(macroExpressions[activeMacro]||'');
    macroActionEditorMode=mode;macroActionEditorIndex=index;
    const ev=mode==='edit'?events[index]:null;
    const type=ev?.type||preferredType||'key';setMacroActionType(type);
    els.macroActionTitle.textContent=mode==='edit'?`编辑第 ${index+1} 项`:(index<0?'添加动作':`在第 ${index+1} 项后插入`);
    els.macroActionPosition.textContent=mode==='edit'?`M${activeMacro} · 第 ${index+1} 项`:(index<0?`M${activeMacro} · 追加到末尾`:`M${activeMacro} · 插入到第 ${index+2} 项`);
    if(ev?.type==='key'){
      els.macroActionKeyAction.value=ev.action||'tap';els.macroActionKeyName.value=ev.name||'';
    }else{els.macroActionKeyAction.value='tap';els.macroActionKeyName.value='KC_A';}
    els.macroActionDelay.value=String(ev?.type==='delay'?ev.ms:100);
    els.macroActionText.value=ev?.type==='text'?ev.label:'';
    els.macroActionOverlay.classList.remove('hidden');
    setTimeout(()=>{
      const focusEl=type==='key'?els.macroActionKeyName:type==='delay'?els.macroActionDelay:els.macroActionText;focusEl?.focus();if(focusEl?.select)focusEl.select();
    },20);
  }
  function closeMacroActionEditor(){els.macroActionOverlay?.classList.add('hidden');}
  function commitMacroActionEditor(){
    const events=parseMacroVisual(macroExpressions[activeMacro]||'');
    const raw=macroRawForAction(macroActionEditorType,{name:els.macroActionKeyName.value,action:els.macroActionKeyAction.value,ms:els.macroActionDelay.value,text:els.macroActionText.value});
    if(!raw&&macroActionEditorType==='text')throw new Error('文本不能为空。');
    if(macroActionEditorMode==='edit')events[macroActionEditorIndex]={...events[macroActionEditorIndex],raw};
    else events.splice(Math.max(0,Math.min(events.length,macroActionEditorIndex+1)),0,{raw});
    syncMacroExpression(events.map(x=>x.raw).join(''));
    els.macroStatus.textContent=macroActionEditorMode==='edit'?`第 ${macroActionEditorIndex+1} 项已修改，尚未保存到键盘`:'已插入新动作，尚未保存到键盘';
    closeMacroActionEditor();
  }
  function escapeHtml(v){return String(v??'').replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));}
  function macroEventIcon(name,type){
    if(name?.startsWith('KC_MS_BTN')) return '🖱';
    if(name?.startsWith('KC_MS_WH')) return '◉';
    if(name?.startsWith('KC_MS_')) return '↔';
    if(type==='delay') return '⏱';
    if(type==='text') return 'T';
    return '⌨';
  }
  function parseMacroVisual(exp){
    const events=[];let pos=0;const re=/{([^{}]+)}/g;let m;
    while((m=re.exec(exp))){
      if(m.index>pos){const text=exp.slice(pos,m.index);if(text)events.push({type:'text',raw:text,label:text});}
      const token=m[1].trim(),raw=m[0];
      if(/^\d{1,4}$/.test(token))events.push({type:'delay',raw,ms:Number(token),label:`${Number(token)} ms`});
      else{
        let action='tap',name=token;
        if(name.startsWith('+')){action='down';name=name.slice(1);}
        else if(name.startsWith('-')){action='up';name=name.slice(1);}
        name=name.trim().toUpperCase();
        events.push({type:'key',action,name,raw,label:macroFriendlyName(name)});
      }
      pos=re.lastIndex;
    }
    if(pos<exp.length){const text=exp.slice(pos);if(text)events.push({type:'text',raw:text,label:text});}
    return events;
  }
  function macroVisualSummary(exp){
    const ev=parseMacroVisual(exp);
    if(!ev.length)return '空';
    return ev.slice(0,3).map(x=>x.type==='delay'?`${x.ms}ms`:x.label).join(' · ')+(ev.length>3?'…':'');
  }
  function syncMacroExpression(exp){
    macroExpressions[activeMacro]=exp;
    els.macroExpression.value=exp;
    macroDirty=true;
    renderMacroTimeline();
    renderMacroList();
  }
  function renderMacroTimeline(){
    if(!els.macroTimeline)return;
    const events=parseMacroVisual(macroExpressions[activeMacro]||'');
    els.macroTimeline.innerHTML='';
    if(!events.length){
      const empty=document.createElement('div');empty.className='macro-empty';
      empty.innerHTML='<strong>暂无动作</strong><span>点击“＋ 动作”手动添加，或点击“录制”直接录入。</span>';
      empty.addEventListener('click',()=>openMacroActionEditor('insert',-1,'key'));
      els.macroTimeline.appendChild(empty);return;
    }
    events.forEach((ev,idx)=>{
      const row=document.createElement('div');row.className=`macro-event macro-${ev.type}`;
      const actionLabel=ev.type==='key'?(ev.action==='down'?'按下':ev.action==='up'?'松开':'单击'):ev.type==='delay'?'延时':'文本';
      const valueHtml=ev.type==='delay'
        ? `<label class="macro-inline-delay" title="悬停后可直接修改"><input class="macro-delay-value" type="number" min="1" max="9999" step="1" value="${ev.ms}" aria-label="延时毫秒"><span>ms</span></label>`
        : ev.type==='text'
          ? `<input class="macro-text-value" type="text" value="${escapeHtml(ev.label)}" aria-label="宏文本" title="悬停后可直接修改文本">`
          : `<button class="macro-key-edit-trigger" type="button" title="点击修改按键 / 鼠标功能">${escapeHtml(ev.label)}</button>`;
      row.innerHTML=`<span class="macro-event-index">${idx+1}</span><span class="macro-event-icon">${macroEventIcon(ev.name,ev.type)}</span><div class="macro-event-body">${valueHtml}<small>${actionLabel}${ev.name?` · ${escapeHtml(ev.name)}`:''}</small></div><button class="macro-event-delete" title="删除这个动作">×</button><button class="macro-event-insert" title="在此动作后插入">＋</button>`;
      row.querySelector('.macro-event-delete').addEventListener('click',e=>{
        e.stopPropagation();const next=events.filter((_,i)=>i!==idx).map(x=>x.raw).join('');syncMacroExpression(next);els.macroStatus.textContent='已删除 1 个动作，尚未保存到键盘';
      });
      row.querySelector('.macro-event-insert').addEventListener('click',e=>{e.stopPropagation();openMacroActionEditor('insert',idx,'key');});
      const keyEdit=row.querySelector('.macro-key-edit-trigger');
      if(keyEdit)keyEdit.addEventListener('click',e=>{e.stopPropagation();openMacroActionEditor('edit',idx,'key');});
      const delayInput=row.querySelector('.macro-delay-value');
      if(delayInput){
        const commitDelay=()=>{
          const ms=Math.max(1,Math.min(9999,Math.round(Number(delayInput.value)||1)));delayInput.value=String(ms);if(ms===ev.ms)return;
          const next=events.map((x,i)=>i===idx?`{${ms}}`:x.raw).join('');syncMacroExpression(next);els.macroStatus.textContent=`第 ${idx+1} 项延时已改为 ${ms} ms，尚未保存到键盘`;
        };
        delayInput.addEventListener('change',commitDelay);
        delayInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();delayInput.blur();}e.stopPropagation();});
        delayInput.addEventListener('focus',()=>delayInput.select());delayInput.addEventListener('click',e=>e.stopPropagation());
      }
      const textInput=row.querySelector('.macro-text-value');
      if(textInput){
        const commitText=()=>{const value=textInput.value;if(value===ev.label)return;const next=events.map((x,i)=>i===idx?value:x.raw).join('');syncMacroExpression(next);els.macroStatus.textContent=`第 ${idx+1} 项文本已修改，尚未保存到键盘`;};
        textInput.addEventListener('change',commitText);textInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();textInput.blur();}e.stopPropagation();});textInput.addEventListener('click',e=>e.stopPropagation());
      }
      row.addEventListener('dblclick',e=>{if(e.target.closest('button,input'))return;openMacroActionEditor('edit',idx,ev.type);});
      els.macroTimeline.appendChild(row);
    });
  }
  function recorderActionText(ev){
    if(ev.type==='delay')return `${ev.ms} ms 延时`;
    if(ev.type==='text')return `文本：${ev.label}`;
    const action=ev.action==='down'?'按下':ev.action==='up'?'松开':'单击';
    return `${ev.label} · ${action}`;
  }
  function renderMacroRecorderPreview(){
    if(!els.macroRecorderPreview)return;
    const all=parseMacroVisual(macroExpressions[activeMacro]||'');
    const events=all.slice(Math.max(0,macroRecorderBaseCount));
    els.macroRecorderCount.textContent=`${events.length} 个新动作`;
    els.macroRecorderPreview.innerHTML='';
    if(!events.length){
      els.macroRecorderLast.textContent='等待输入…';
      els.macroRecorderPreview.innerHTML='<div class="macro-recorder-empty">等待键盘 / 鼠标输入…</div>';
      return;
    }
    const last=events[events.length-1];
    els.macroRecorderLast.textContent=`刚刚：${recorderActionText(last)}`;
    events.forEach((ev,idx)=>{
      const card=document.createElement('div');
      card.className=`macro-recorder-live-item macro-${ev.type}${idx===events.length-1?' latest':''}`;
      const sub=ev.type==='key'?(ev.action==='down'?'按下':ev.action==='up'?'松开':'单击'):ev.type==='delay'?'延时':'文本';
      const main=ev.type==='delay'?`${ev.ms} ms`:ev.label;
      card.innerHTML=`<span>${idx+1}</span><b>${macroEventIcon(ev.name,ev.type)}</b><div><strong>${escapeHtml(main)}</strong><small>${escapeHtml(sub)}</small></div>`;
      els.macroRecorderPreview.appendChild(card);
    });
    requestAnimationFrame(()=>{els.macroRecorderPreview.scrollTop=els.macroRecorderPreview.scrollHeight;});
  }
  function appendRecordedMacro(raw){
    const exp=(macroExpressions[activeMacro]||'')+raw;
    syncMacroExpression(exp);
    if(macroRecording)renderMacroRecorderPreview();
  }
  function appendMacroDelay(ms){
    ms=Math.max(1,Math.min(9999,Number(ms)||0));
    if(!ms)return;
    appendRecordedMacro(`{${ms}}`);
    els.macroStatus.textContent=`已添加 ${ms} ms 延时`;
  }
  function maybeRecordDelay(now){
    if(!els.macroRecordDelay.checked||!macroLastEventAt)return '';
    const d=Math.min(9999,Math.max(0,now-macroLastEventAt));
    return d>=15?`{${d}}`:'';
  }

  async function getMacroBufferSize(){ const r=await hidCommand(CMD.GET_MACRO_BUFFER_SIZE); return ((r[1]||0)<<8)|(r[2]||0); }
  async function getMacroBytes(){
    const size=await getMacroBufferSize(), out=[];
    for(let off=0;off<size;off+=28){const len=Math.min(28,size-off);const r=await hidCommand(CMD.GET_MACRO_BUFFER,[(off>>8)&0xff,off&0xff,len],1400);out.push(...Array.from(r.slice(4,4+len)));}
    return new Uint8Array(out.slice(0,size));
  }
  async function setMacroBytes(raw){
    const size=await getMacroBufferSize(); if(raw.length>size) throw new Error(`宏数据 ${raw.length} bytes 超过键盘 Buffer ${size} bytes。`);
    await hidCommand(CMD.RESET_MACROS,[]);
    const last=size-1;
    try{
      await hidCommand(CMD.SET_MACRO_BUFFER,[(last>>8)&0xff,last&0xff,1,0xff]);
      for(let off=0;off<raw.length;off+=28){const chunk=Array.from(raw.slice(off,off+28));await hidCommand(CMD.SET_MACRO_BUFFER,[(off>>8)&0xff,off&0xff,chunk.length,...chunk],1600);}
    } finally { await hidCommand(CMD.SET_MACRO_BUFFER,[(last>>8)&0xff,last&0xff,1,0x00]); }
  }
  function decodeMacroBytes(raw,count){
    const result=[];let i=0;
    for(let m=0;m<count;m++){
      let exp='';
      while(i<raw.length){const b=raw[i++]; if(b===MACRO.TERM) break;
        if(b===MACRO.PREFIX){const action=raw[i++]; if(action===MACRO.DELAY){let digits='';while(i<raw.length&&raw[i]!==MACRO.DELAY_TERM)digits+=String.fromCharCode(raw[i++]);i++;exp+=`{${digits||0}}`;continue;} const kb=raw[i++];const name=macroByteToName[kb]||`KC_HEX_${hexByte(kb)}`;exp+=action===MACRO.TAP?`{${name}}`:action===MACRO.DOWN?`{+${name}}`:action===MACRO.UP?`{-${name}}`:`{${name}}`;}
        else exp+=String.fromCharCode(b);
      }
      result.push(exp);
    }
    return result;
  }
  function encodeMacroExpression(exp){
    const out=[];let pos=0;const re=/{([^{}]+)}/g;let m;
    while((m=re.exec(exp))){for(const ch of exp.slice(pos,m.index)){const cp=ch.charCodeAt(0);if(cp>0x7f)throw new Error('宏文字目前仅支持 ASCII；中文请改用按键表达式。');out.push(cp);}const token=m[1].trim();
      if(/^\d{1,4}$/.test(token)){out.push(MACRO.PREFIX,MACRO.DELAY,...String(Number(token)).split('').map(c=>c.charCodeAt(0)),MACRO.DELAY_TERM);}
      else{let action=MACRO.TAP,name=token;if(name.startsWith('+')){action=MACRO.DOWN;name=name.slice(1);}else if(name.startsWith('-')){action=MACRO.UP;name=name.slice(1);}name=name.trim().toUpperCase();let byte=macroNameToByte[name];if(byte===undefined&&/^KC_HEX_[0-9A-F]{2}$/.test(name))byte=parseInt(name.slice(-2),16);if(byte===undefined)throw new Error(`不认识的宏按键：${name}`);out.push(MACRO.PREFIX,action,byte);}
      pos=re.lastIndex;
    }
    for(const ch of exp.slice(pos)){const cp=ch.charCodeAt(0);if(cp>0x7f)throw new Error('宏文字目前仅支持 ASCII；中文请改用按键表达式。');out.push(cp);}out.push(MACRO.TERM);return out;
  }
  function encodeAllMacros(expressions,count){const out=[];for(let i=0;i<count;i++)out.push(...encodeMacroExpression(expressions[i]||''));return new Uint8Array(out);}
  function renderMacroList(){
    if(!els.macroList)return;els.macroList.innerHTML='';
    for(let i=0;i<macroCount;i++){
      const b=document.createElement('button');b.className=`macro-item ${i===activeMacro?'active':''}`;
      b.innerHTML=`<strong>M${i}</strong><span>${escapeHtml(macroVisualSummary(macroExpressions[i]||''))}</span>`;
      b.addEventListener('click',()=>{saveMacroEditorLocal();activeMacro=i;renderMacroList();loadMacroEditor();});
      els.macroList.appendChild(b);
    }
  }
  function saveMacroEditorLocal(){if(!els.macroExpression)return;macroExpressions[activeMacro]=els.macroExpression.value;}
  function loadMacroEditor(){
    if(!els.macroExpression)return;
    els.macroTitle.textContent=`M${activeMacro}`;
    els.macroExpression.value=macroExpressions[activeMacro]||'';
    renderMacroTimeline();
  }
  async function readMacrosFromKeyboard(){
    if(!hidDevice?.opened)throw new Error('请先连接 HID。');const c=await hidCommand(CMD.GET_MACRO_COUNT);macroCount=Math.max(0,c[1]||0);if(!macroCount)throw new Error('键盘固件没有启用 Macro。');macroBufferSize=await getMacroBufferSize();const raw=await getMacroBytes();macroExpressions=decodeMacroBytes(raw,macroCount);while(macroExpressions.length<macroCount)macroExpressions.push('');activeMacro=Math.min(activeMacro,macroCount-1);macroDirty=false;els.macroCountLabel.textContent=`Macro：${macroCount}`;els.macroBufferLabel.textContent=`Buffer：${macroBufferSize} bytes`;els.macroStatus.textContent='已从键盘读取';renderMacroList();loadMacroEditor();toast(`已读取 ${macroCount} 个宏`);
  }
  async function saveMacrosToKeyboard(){
    if(!hidDevice?.opened)throw new Error('请先连接 HID。');saveMacroEditorLocal();if(!macroCount)throw new Error('请先读取 Macro。');const raw=encodeAllMacros(macroExpressions,macroCount);if(!macroBufferSize)macroBufferSize=await getMacroBufferSize();if(raw.length>macroBufferSize)throw new Error(`宏内容共 ${raw.length} bytes，超过 Buffer ${macroBufferSize} bytes。`);await setMacroBytes(raw);macroDirty=false;els.macroStatus.textContent=`已保存 · ${raw.length}/${macroBufferSize} bytes`;renderMacroList();toast('宏已保存到键盘');
  }
  function exportMacrosFile(){
    saveMacroEditorLocal();
    const count=Math.max(1,macroCount||macroExpressions.length||16);
    const payload={
      format:'chisa-qk80mk2-macros',
      version:1,
      exportedAt:new Date().toISOString(),
      device:{name:'QK80 MK2',vendorId:VID,productId:PID,protocol:els.protocolValue?.textContent||'unknown'},
      count,
      activeMacro,
      macros:Array.from({length:count},(_,i)=>macroExpressions[i]||'')
    };
    const stamp=new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
    downloadJson(payload,`QK80-MK2-Macros-${stamp}.json`);
    els.macroStatus.textContent=`已导出 ${count} 个宏到 JSON`;
    toast('宏文件已导出');
  }
  async function importMacrosFile(file){
    const text=await file.text();
    const data=JSON.parse(text);
    let arr=null,count=0,selected=0;
    if(Array.isArray(data)){arr=data;count=data.length;}
    else if(data?.format==='chisa-qk80mk2-macros'&&Array.isArray(data.macros)){arr=data.macros;count=Number(data.count)||arr.length;selected=Number(data.activeMacro)||0;}
    else if(Array.isArray(data?.macros?.expressions)){arr=data.macros.expressions;count=Number(data.macros.count)||arr.length;}
    if(!arr)throw new Error('不是可识别的 QK80 MK2 宏 JSON。');
    count=Math.max(1,Math.min(64,count||arr.length||16));
    macroCount=count;
    macroExpressions=Array.from({length:count},(_,i)=>typeof arr[i]==='string'?arr[i]:'');
    activeMacro=Math.max(0,Math.min(count-1,selected));
    macroDirty=true;
    els.macroCountLabel.textContent=`Macro：${macroCount}（已导入）`;
    els.macroBufferLabel.textContent=macroBufferSize?`Buffer：${macroBufferSize} bytes`:'Buffer：保存时读取';
    renderMacroList();loadMacroEditor();
    els.macroStatus.textContent=`已从 ${file.name} 导入 ${count} 个宏，尚未写入键盘`;
    toast(`已导入 ${count} 个宏`);
  }
  function macroRecordEvent(e){
    if(!macroRecording||e.repeat)return;
    if(e.target?.closest?.('.macro-recorder-stop'))return;
    const name=eventCodeToMacroKey[e.code];if(!name)return;
    e.preventDefault();e.stopPropagation();
    const now=Date.now(),delay=maybeRecordDelay(now);
    appendRecordedMacro(delay+(e.type==='keydown'?`{+${name}}`:`{-${name}}`));
    macroLastEventAt=now;
    els.macroStatus.textContent=`录制中：${macroFriendlyName(name)} ${e.type==='keydown'?'按下':'松开'}`;
  }
  function macroRecordMouseButton(e){
    if(!macroRecording)return;
    if(e.target?.closest?.('.macro-recorder-stop'))return;
    const name=mouseButtonToMacroKey[e.button];if(!name)return;
    e.preventDefault();e.stopPropagation();
    const now=Date.now(),delay=maybeRecordDelay(now);
    appendRecordedMacro(delay+(e.type==='mousedown'?`{+${name}}`:`{-${name}}`));
    macroLastEventAt=now;
    els.macroStatus.textContent=`录制中：${macroFriendlyName(name)} ${e.type==='mousedown'?'按下':'松开'}`;
  }
  function macroRecordWheel(e){
    if(!macroRecording)return;
    if(e.target?.closest?.('.macro-recorder-box'))return;
    e.preventDefault();e.stopPropagation();
    let name=null;
    if(Math.abs(e.deltaY)>=Math.abs(e.deltaX))name=e.deltaY<0?'KC_MS_WH_UP':'KC_MS_WH_DOWN';
    else name=e.deltaX<0?'KC_MS_WH_LEFT':'KC_MS_WH_RIGHT';
    const now=Date.now(),delay=maybeRecordDelay(now);
    appendRecordedMacro(delay+`{${name}}`);
    macroLastEventAt=now;
    els.macroStatus.textContent=`录制中：${macroFriendlyName(name)}`;
  }
  function macroSuppressContext(e){if(macroRecording){e.preventDefault();e.stopPropagation();}}
  function startMacroRecording(){
    if(macroRecording)return;
    macroRecording=true;macroLastEventAt=0;
    macroRecorderBaseCount=parseMacroVisual(macroExpressions[activeMacro]||'').length;
    els.macroRecordBtn.textContent='■ 停止';els.macroRecordBtn.classList.add('recording');
    els.macroRecorderIndex.textContent=activeMacro;els.macroRecorderOverlay.classList.remove('hidden');
    renderMacroRecorderPreview();
    window.addEventListener('keydown',macroRecordEvent,true);window.addEventListener('keyup',macroRecordEvent,true);
    window.addEventListener('mousedown',macroRecordMouseButton,true);window.addEventListener('mouseup',macroRecordMouseButton,true);
    window.addEventListener('wheel',macroRecordWheel,{capture:true,passive:false});
    window.addEventListener('contextmenu',macroSuppressContext,true);
    els.macroStatus.textContent='录制中：弹窗会实时显示新录入的动作。';
  }
  function stopMacroRecording(){
    if(!macroRecording)return;
    macroRecording=false;
    els.macroRecordBtn.textContent='● 录制';els.macroRecordBtn.classList.remove('recording');
    els.macroRecorderOverlay.classList.add('hidden');
    window.removeEventListener('keydown',macroRecordEvent,true);window.removeEventListener('keyup',macroRecordEvent,true);
    window.removeEventListener('mousedown',macroRecordMouseButton,true);window.removeEventListener('mouseup',macroRecordMouseButton,true);
    window.removeEventListener('wheel',macroRecordWheel,true);window.removeEventListener('contextmenu',macroSuppressContext,true);
    els.macroStatus.textContent='录制已停止，点击“保存全部宏”写入键盘。';
  }
  function toggleMacroRecording(){macroRecording?stopMacroRecording():startMacroRecording();}

  async function readCustomPayload(channel,id,len=1){const r=await getCustom(channel,id);return Array.from(r.slice(3,3+len));}
  async function writeCustomNoSave(channel,id,values){await hidCommand(CMD.CUSTOM_SET,[channel,id,...values]);}
  async function commitCustom(channel){await hidCommand(CMD.CUSTOM_SAVE,[channel]);}
  async function captureDeviceSettings(){return {
    magic:{channel:CHANNEL.MAGIC,values:{1:await readCustomPayload(CHANNEL.MAGIC,1),2:await readCustomPayload(CHANNEL.MAGIC,2),3:await readCustomPayload(CHANNEL.MAGIC,3),4:await readCustomPayload(CHANNEL.MAGIC,4)}},
    features:{channel:CHANNEL.FEATURES,values:{1:await readCustomPayload(CHANNEL.FEATURES,1),2:await readCustomPayload(CHANNEL.FEATURES,2),6:await readCustomPayload(CHANNEL.FEATURES,6),7:await readCustomPayload(CHANNEL.FEATURES,7)}},
    connect:{channel:CHANNEL.CONNECT,values:{1:await readCustomPayload(CHANNEL.CONNECT,1)}}
  };}
  function updateConnectActionAvailability(){
    const mode=Number(els.connectMode?.value||0);
    if(els.clearCurrentBindBtn)els.clearCurrentBindBtn.disabled=mode===0;
    if(els.clearAllBindsBtn)els.clearAllBindsBtn.disabled=mode<2;
    if(els.receiverDfuBtn)els.receiverDfuBtn.disabled=mode!==1;
  }
  async function readDeviceSettings(){
    if(!hidDevice?.opened)throw new Error('请先连接 HID。');const s=await captureDeviceSettings();els.magicNkro.checked=!!s.magic.values[1][0];els.magicGui.checked=!!s.magic.values[2][0];els.magicAltGui.checked=!!s.magic.values[3][0];els.magicCapsCtrl.checked=!!s.magic.values[4][0];els.featureLedPower.checked=!!s.features.values[1][0];els.featureSleep.value=s.features.values[2][0]??0;els.featureDebounceMode.value=s.features.values[6][0]??0;els.featureDebounceDelay.value=s.features.values[7][0]??3;els.connectMode.value=s.connect.values[1][0]??0;updateConnectActionAvailability();toast('设备设置读取完成');return s;
  }
  async function saveMagic(){for(const [id,el] of [[1,els.magicNkro],[2,els.magicGui],[3,els.magicAltGui],[4,els.magicCapsCtrl]])await writeCustomNoSave(CHANNEL.MAGIC,id,[el.checked?1:0]);await commitCustom(CHANNEL.MAGIC);toast('MAGIC 已保存');}
  async function saveFeatures(){const vals=[[1,els.featureLedPower.checked?1:0],[2,Number(els.featureSleep.value)],[6,Number(els.featureDebounceMode.value)],[7,Number(els.featureDebounceDelay.value)]];for(const [id,v] of vals)await writeCustomNoSave(CHANNEL.FEATURES,id,[v]);await commitCustom(CHANNEL.FEATURES);toast('FEATURES 已保存');}
  async function syncKeyboardTime(){const d=new Date(),seconds=Math.floor(d.getTime()/1000)-d.getTimezoneOffset()*60;await hidCommand(CMD.CUSTOM_SET,[CHANNEL.DATETIME,...numIntoBytes(seconds)]);await commitCustom(CHANNEL.DATETIME);toast('键盘时间已同步');}
  async function saveConnectMode(){if(!confirm('切换连接模式后，当前 HID / CDC 连接可能立即断开。继续吗？'))return;const mode=Number(els.connectMode.value);try{await writeCustomNoSave(CHANNEL.CONNECT,1,[mode]);await commitCustom(CHANNEL.CONNECT);}catch(err){log('WARN',`连接模式切换后通信中断：${err.message}`);}toast('已发送连接模式切换指令');}
  async function triggerConnectAction(id,label){if(!confirm(`${label}？此操作可能导致配对信息丢失或设备切换模式。`))return;await writeCustomNoSave(CHANNEL.CONNECT,id,[1]);try{await commitCustom(CHANNEL.CONNECT);}catch{}toast(`${label} 指令已发送`);}
  async function eepromReset(){if(els.resetConfirm.value.trim()!=='RESET')throw new Error('请输入 RESET 进行确认。');if(!confirm('这会清空键盘 VIA/EEPROM 配置，包括改键和宏。确定继续？'))return;try{await hidCommand(CMD.EEPROM_RESET,[],1800);}finally{els.resetConfirm.value='';}toast('EEPROM Reset 已发送，请重新插拔键盘');}
  function tickClock(){if(els.browserClock)els.browserClock.textContent=new Date().toLocaleString('zh-CN',{hour12:false});}

  async function captureLightingProfile(){const result={};for(const def of lightDefs){const vals={};vals[1]=await readCustomPayload(def.channel,1);vals[2]=await readCustomPayload(def.channel,2);if(def.speed)vals[3]=await readCustomPayload(def.channel,3);vals[4]=await readCustomPayload(def.channel,4,2);result[def.key]={channel:def.channel,values:vals};}return result;}
  async function applyChannelValues(block){if(!block?.values)return;for(const [id,v] of Object.entries(block.values))await writeCustomNoSave(Number(block.channel),Number(id),Array.from(v));await commitCustom(Number(block.channel));}
  async function writeAllLayers(layers){const flat=[];for(const layer of layers)for(const code of layer){flat.push((code>>8)&0xff,code&0xff);}for(let off=0;off<flat.length;off+=28){const chunk=flat.slice(off,off+28);await hidCommand(CMD.SET_KEYMAP_BUFFER,[(off>>8)&0xff,off&0xff,chunk.length,...chunk],1800);}}
  function downloadJson(obj,filename){const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),500);}
  async function exportProfile(){
    if(!hidDevice?.opened)throw new Error('请先连接 HID。');els.profileExportStatus.textContent='正在读取键盘…';const layers=[];for(let i=0;i<layerCount;i++){els.profileExportStatus.textContent=`正在读取 Layer ${i+1}/${layerCount}…`;try{layers.push(await readLayerFast(i));}catch{layers.push(await readLayerSlow(i));}}
    const mc=await hidCommand(CMD.GET_MACRO_COUNT);const count=mc[1]||0;const macroRaw=count?Array.from(await getMacroBytes()):[];const lighting=await captureLightingProfile();const settings=await captureDeviceSettings();const profile={format:'chisa-qk80mk2-profile',version:1,exportedAt:new Date().toISOString(),device:{name:'QK80 MK2',vendorId:VID,productId:PID,protocol:els.protocolValue.textContent},layers,macros:{count,raw:macroRaw},lighting,settings,matrix:{fps:Number(els.fpsSelect.value),frames:frames.map(f=>[...f]),note:'frames are from current web editor cache'},perKeyRgb:{previewFps:Number(els.rgbPreviewFps.value||5),liveFps:Number(els.rgbLiveFps.value||2),frames:rgbFrames.map(f=>[...f]),ledMap:[...rgbLedMap],note:'Per-Key RGB frames are browser-side cache; apply manually from RGB page'}};const safeName=(els.profileName.value.trim()||'QK80-MK2-Profile').replace(/[\\/:*?"<>|]+/g,'-');downloadJson(profile,`${safeName}.json`);els.profileExportStatus.textContent=`已导出：${layers.length} Layer · ${count} Macro · ${new Date().toLocaleTimeString('zh-CN',{hour12:false})}`;toast('Profile 已导出');
  }
  function profileSummaryText(p){return [`设备：${p.device?.name||'未知'}`,`Layer：${p.layers?.length??0}`,`Macro：${p.macros?.count??0}`,`灯光：${p.lighting?Object.keys(p.lighting).length:0} 组`,`点阵：${p.matrix?.frames?.length??0} 帧 @ ${p.matrix?.fps??'-'} FPS`,`主键盘 RGB：${p.perKeyRgb?.frames?.length??0} 帧（载入编辑器，不自动写入）`].join('\n');}
  async function loadProfileFile(file){const text=await file.text();const p=JSON.parse(text);if(p.format!=='chisa-qk80mk2-profile')throw new Error('不是 CHISA QK80 MK2 Profile。');if(p.device?.vendorId!==VID||p.device?.productId!==PID)throw new Error('Profile 设备 VID/PID 与 QK80 MK2 不匹配。');loadedProfile=p;els.profileSummary.textContent=profileSummaryText(p);els.applyProfileBtn.disabled=false;toast('Profile 已载入，尚未写入键盘');}
  async function applyProfile(){
    if(!loadedProfile)throw new Error('请先选择 Profile。');if(!hidDevice?.opened)throw new Error('请先连接 HID。');if(!confirm('即将覆盖键位、宏、灯光和设备设置。继续吗？'))return;const p=loadedProfile;
    if(Array.isArray(p.layers)&&p.layers.length)await writeAllLayers(p.layers);
    if(p.macros?.raw?.length)await setMacroBytes(new Uint8Array(p.macros.raw));
    if(p.lighting)for(const block of Object.values(p.lighting))await applyChannelValues(block);
    if(p.settings?.magic)await applyChannelValues(p.settings.magic);if(p.settings?.features)await applyChannelValues(p.settings.features);
    if(els.profileApplyConnection.checked&&p.settings?.connect)await applyChannelValues(p.settings.connect);
    if(p.matrix?.frames?.length){frames=p.matrix.frames.map(f=>f.slice(0,49));currentFrame=0;els.fpsSelect.value=String(p.matrix.fps||10);renderPixelGrid();renderFrameList();if(els.profileApplyMatrix.checked)await uploadMatrix();}
    if(p.perKeyRgb?.frames?.length){rgbFrames=p.perKeyRgb.frames.map(f=>f.slice(0,qkLayout.length));rgbCurrentFrame=0;if(Array.isArray(p.perKeyRgb.ledMap)&&p.perKeyRgb.ledMap.length===qkLayout.length){rgbLedMap=p.perKeyRgb.ledMap.map(Number);localStorage.setItem(RGB_MAP_STORAGE_KEY,JSON.stringify(rgbLedMap));}els.rgbPreviewFps.value=String(p.perKeyRgb.previewFps||5);els.rgbLiveFps.value=String(p.perKeyRgb.liveFps||2);buildRgbKeyboard();renderRgbFrameList();}
    await readPhysicalLayer();toast('Profile 已应用到键盘；主键盘 RGB 帧已载入编辑器');
  }




  // v0.6.2 — local appearance / theme system.
  // Theme values live in localStorage; uploaded background image lives in IndexedDB,
  // so clearing browser/site data intentionally resets everything.
  const APPEARANCE_STORAGE_KEY = 'qk80mk2.appearance.v1';
  const APPEARANCE_DB_NAME = 'qk80mk2-driver-local';
  const APPEARANCE_DB_STORE = 'assets';
  const APPEARANCE_BG_KEY = 'appearance-background';
  const APPEARANCE_PRESETS = {
    lime:   { name:'Angry Lime',   accent:'#caff00', keySelect:'#caff00', bg:'#e9eef0', panel:'#f5f7f8', textMode:'light' },
    rose:   { name:'Chisa Rose',   accent:'#ff8fb1', keySelect:'#ff76a4', bg:'#f6edef', panel:'#fff8fa', textMode:'light' },
    ocean:  { name:'Ocean',        accent:'#4bbcff', keySelect:'#35aef6', bg:'#e8f1f7', panel:'#f7fbff', textMode:'light' },
    violet: { name:'Violet Night', accent:'#b69cff', keySelect:'#c8b5ff', bg:'#1c1a25', panel:'#282633', textMode:'dark' },
    carbon: { name:'Carbon',       accent:'#ff7a45', keySelect:'#ff995f', bg:'#121719', panel:'#1d2528', textMode:'dark' },
  };
  const APPEARANCE_DEFAULT = {
    preset:'lime', accent:'#caff00', keySelect:'#caff00', bg:'#e9eef0', panel:'#f5f7f8', textMode:'light',
    bgFit:'cover', bgPosition:'center center', bgOpacity:35, bgBlur:0, bgName:''
  };
  let appearanceState = { ...APPEARANCE_DEFAULT };
  let appearanceBackgroundUrl = '';

  function normalizeHex(value, fallback='#000000') {
    const v=String(value||'').trim();
    return /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : fallback;
  }
  function hexRgb(hex){
    const v=normalizeHex(hex).slice(1);return [0,2,4].map(i=>parseInt(v.slice(i,i+2),16));
  }
  function rgbHex(rgb){return '#'+rgb.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');}
  function mixHex(a,b,t=.5){const x=hexRgb(a),y=hexRgb(b);return rgbHex(x.map((v,i)=>v+(y[i]-v)*t));}
  function relLum(hex){
    const c=hexRgb(hex).map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4;});
    return .2126*c[0]+.7152*c[1]+.0722*c[2];
  }
  function contrastInk(hex){return relLum(hex)>.48?'#111719':'#ffffff';}
  function loadAppearanceState(){
    try{appearanceState={...APPEARANCE_DEFAULT,...JSON.parse(localStorage.getItem(APPEARANCE_STORAGE_KEY)||'{}')};}catch{appearanceState={...APPEARANCE_DEFAULT};}
    appearanceState.accent=normalizeHex(appearanceState.accent,APPEARANCE_DEFAULT.accent);
    appearanceState.keySelect=normalizeHex(appearanceState.keySelect,appearanceState.accent);
    appearanceState.bg=normalizeHex(appearanceState.bg,APPEARANCE_DEFAULT.bg);
    appearanceState.panel=normalizeHex(appearanceState.panel,APPEARANCE_DEFAULT.panel);
    appearanceState.bgOpacity=Math.max(5,Math.min(100,Number(appearanceState.bgOpacity)||35));
    appearanceState.bgBlur=Math.max(0,Math.min(24,Number(appearanceState.bgBlur)||0));
  }
  function saveAppearanceState(){localStorage.setItem(APPEARANCE_STORAGE_KEY,JSON.stringify(appearanceState));}
  function setRootVar(name,value){document.documentElement.style.setProperty(name,value);}
  function applyAppearanceState(){
    const darkUi=appearanceState.textMode==='dark'||(appearanceState.textMode==='auto'&&relLum(appearanceState.panel)<.34);
    const text=darkUi?'#f2f5f6':'#111719';
    const muted=darkUi?'#a5b0b5':'#667278';
    const line=mixHex(appearanceState.panel,darkUi?'#ffffff':'#000000',darkUi?.18:.22);
    const lineStrong=mixHex(appearanceState.panel,darkUi?'#ffffff':'#000000',darkUi?.34:.38);
    const surface=mixHex(appearanceState.panel,appearanceState.bg,.26);
    const surface2=mixHex(appearanceState.panel,appearanceState.bg,.47);
    const surface3=mixHex(appearanceState.panel,appearanceState.bg,.65);
    const inputBg=mixHex(appearanceState.panel,darkUi?'#ffffff':'#ffffff',darkUi?.07:.60);
    const sidebar=mixHex(appearanceState.panel,appearanceState.bg,.60);
    const topbar=mixHex(appearanceState.panel,appearanceState.bg,.18);
    const accentStrong=mixHex(appearanceState.accent,darkUi?'#ffffff':'#000000',.18);
    const accentSoft=mixHex(appearanceState.panel,appearanceState.accent,darkUi?.18:.24);
    const boardA=darkUi?mixHex(appearanceState.panel,'#000000',.34):mixHex(appearanceState.panel,'#000000',.46);
    const boardB=darkUi?mixHex(boardA,'#000000',.22):mixHex(boardA,'#000000',.12);
    [
      ['--bg',appearanceState.bg],['--panel',appearanceState.panel],['--panel-2',surface2],['--surface',surface],['--surface-2',surface2],['--surface-3',surface3],
      ['--input-bg',inputBg],['--rgb-palette-bg',darkUi?'#090a0d':'#ffffff'],['--sidebar-bg',sidebar],['--topbar-bg',topbar],['--line',line],['--line-strong',lineStrong],['--text',text],['--muted',muted],
      ['--accent',appearanceState.accent],['--accent-strong',accentStrong],['--accent-soft',accentSoft],['--accent-ink',contrastInk(appearanceState.accent)],
      ['--key-select',appearanceState.keySelect],['--key-select-ink',contrastInk(appearanceState.keySelect)],['--board-a',boardA],['--board-b',boardB],
      ['--driver-bg-opacity',String(appearanceState.bgOpacity/100)],['--driver-bg-blur',`${appearanceState.bgBlur}px`],['--driver-bg-fit',appearanceState.bgFit||'cover'],['--driver-bg-position',appearanceState.bgPosition||'center center']
    ].forEach(([k,v])=>setRootVar(k,v));
    const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute('content',appearanceState.bg);
  }
  function openAppearanceDb(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(APPEARANCE_DB_NAME,1);
      req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(APPEARANCE_DB_STORE))db.createObjectStore(APPEARANCE_DB_STORE);};
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('无法打开本地背景数据库'));
    });
  }
  async function appearanceDbGet(key){const db=await openAppearanceDb();return new Promise((resolve,reject)=>{const tx=db.transaction(APPEARANCE_DB_STORE,'readonly');const r=tx.objectStore(APPEARANCE_DB_STORE).get(key);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);tx.oncomplete=()=>db.close();});}
  async function appearanceDbPut(key,value){const db=await openAppearanceDb();return new Promise((resolve,reject)=>{const tx=db.transaction(APPEARANCE_DB_STORE,'readwrite');tx.objectStore(APPEARANCE_DB_STORE).put(value,key);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};});}
  async function appearanceDbDelete(key){const db=await openAppearanceDb();return new Promise((resolve,reject)=>{const tx=db.transaction(APPEARANCE_DB_STORE,'readwrite');tx.objectStore(APPEARANCE_DB_STORE).delete(key);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};});}
  function setAppearanceBackgroundBlob(blob){
    if(appearanceBackgroundUrl){URL.revokeObjectURL(appearanceBackgroundUrl);appearanceBackgroundUrl='';}
    if(blob){appearanceBackgroundUrl=URL.createObjectURL(blob);setRootVar('--driver-bg-image',`url("${appearanceBackgroundUrl}")`);}else setRootVar('--driver-bg-image','none');
    const preview=document.getElementById('appearanceBgPreview');
    if(preview)preview.style.backgroundImage=blob?`linear-gradient(rgba(10,15,18,.18),rgba(10,15,18,.18)),url("${appearanceBackgroundUrl}")`:'linear-gradient(135deg,var(--surface-2),var(--panel))';
    const state=document.getElementById('appearanceBgState');if(state)state.textContent=blob?(appearanceState.bgName||'本地背景已保存'):'未设置图片';
  }
  function renderAppearanceControls(){
    const map={appearanceAccent:'accent',appearanceKeySelect:'keySelect',appearanceBg:'bg',appearancePanel:'panel',appearanceTextMode:'textMode',appearanceBgFit:'bgFit',appearanceBgPosition:'bgPosition',appearanceBgOpacity:'bgOpacity',appearanceBgBlur:'bgBlur'};
    Object.entries(map).forEach(([id,key])=>{const el=document.getElementById(id);if(el)el.value=String(appearanceState[key]);});
    document.querySelectorAll('[data-theme-preset]').forEach(b=>b.classList.toggle('active',b.dataset.themePreset===appearanceState.preset));
    const label=document.getElementById('appearancePresetLabel');if(label)label.textContent=APPEARANCE_PRESETS[appearanceState.preset]?.name||(appearanceState.preset==='custom'?'Custom':'自定义');
    const opacity=document.getElementById('appearanceBgOpacityValue');if(opacity)opacity.textContent=`${appearanceState.bgOpacity}%`;
    const blur=document.getElementById('appearanceBgBlurValue');if(blur)blur.textContent=`${appearanceState.bgBlur} px`;
    const preview=document.getElementById('appearanceBgPreview');if(preview){preview.style.backgroundSize=appearanceState.bgFit||'cover';preview.style.backgroundPosition=appearanceState.bgPosition||'center center';}
  }
  function setAppearanceCustom(){appearanceState.preset='custom';}
  function bindAppearanceControls(){
    document.querySelectorAll('[data-theme-preset]').forEach(btn=>btn.addEventListener('click',()=>{
      const key=btn.dataset.themePreset,preset=APPEARANCE_PRESETS[key];if(!preset)return;
      appearanceState={...appearanceState,...preset,preset:key};applyAppearanceState();saveAppearanceState();renderAppearanceControls();toast(`已切换：${preset.name}`);
    }));
    const colorIds=['appearanceAccent','appearanceKeySelect','appearanceBg','appearancePanel'];
    colorIds.forEach(id=>document.getElementById(id)?.addEventListener('input',e=>{const key={appearanceAccent:'accent',appearanceKeySelect:'keySelect',appearanceBg:'bg',appearancePanel:'panel'}[id];appearanceState[key]=e.target.value;setAppearanceCustom();applyAppearanceState();saveAppearanceState();renderAppearanceControls();}));
    document.getElementById('appearanceTextMode')?.addEventListener('change',e=>{appearanceState.textMode=e.target.value;setAppearanceCustom();applyAppearanceState();saveAppearanceState();renderAppearanceControls();});
    document.getElementById('appearanceBgFit')?.addEventListener('change',e=>{appearanceState.bgFit=e.target.value;applyAppearanceState();saveAppearanceState();});
    document.getElementById('appearanceBgPosition')?.addEventListener('change',e=>{appearanceState.bgPosition=e.target.value;applyAppearanceState();saveAppearanceState();});
    document.getElementById('appearanceBgOpacity')?.addEventListener('input',e=>{appearanceState.bgOpacity=Number(e.target.value);applyAppearanceState();saveAppearanceState();renderAppearanceControls();});
    document.getElementById('appearanceBgBlur')?.addEventListener('input',e=>{appearanceState.bgBlur=Number(e.target.value);applyAppearanceState();saveAppearanceState();renderAppearanceControls();});
    const file=document.getElementById('appearanceBgFile');
    document.getElementById('appearanceUploadBgBtn')?.addEventListener('click',()=>file?.click());
    file?.addEventListener('change',()=>safe(async()=>{
      const f=file.files?.[0];file.value='';if(!f)return;if(!f.type.startsWith('image/'))throw new Error('请选择图片文件。');if(f.size>25*1024*1024)throw new Error('背景图片请控制在 25 MB 以内。');
      await appearanceDbPut(APPEARANCE_BG_KEY,f);appearanceState.bgName=f.name;saveAppearanceState();setAppearanceBackgroundBlob(f);toast('背景图片已保存到当前浏览器');
    }));
    document.getElementById('appearanceClearBgBtn')?.addEventListener('click',()=>safe(async()=>{await appearanceDbDelete(APPEARANCE_BG_KEY);appearanceState.bgName='';saveAppearanceState();setAppearanceBackgroundBlob(null);toast('本地背景图片已清除');}));
    document.getElementById('appearanceResetBtn')?.addEventListener('click',()=>safe(async()=>{
      if(!confirm('恢复 Angry Lime 默认主题，并清除当前浏览器保存的自定义背景吗？'))return;
      appearanceState={...APPEARANCE_DEFAULT};localStorage.removeItem(APPEARANCE_STORAGE_KEY);await appearanceDbDelete(APPEARANCE_BG_KEY).catch(()=>{});applyAppearanceState();renderAppearanceControls();setAppearanceBackgroundBlob(null);toast('界面样式已恢复默认');
    }));
  }
  async function initAppearance(){
    loadAppearanceState();applyAppearanceState();renderAppearanceControls();bindAppearanceControls();
    try{setAppearanceBackgroundBlob(await appearanceDbGet(APPEARANCE_BG_KEY));}catch(err){console.warn('Background restore failed',err);setAppearanceBackgroundBlob(null);}
  }


  async function safe(fn){try{await fn();}catch(err){console.error(err);log('ERROR',err?.stack||err?.message||String(err));toast(err?.message||String(err),true);}}

  function bindUI(){
    document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===btn));document.querySelectorAll('.tab-panel').forEach(p=>p.classList.toggle('active',p.id===`tab-${btn.dataset.tab}`));}));
    els.connectHidBtn.addEventListener('click',()=>safe(()=>connectHid(true)));els.connectSerialBtn.addEventListener('click',()=>safe(()=>connectSerial(true)));els.disconnectBtn.addEventListener('click',()=>safe(disconnectAll));els.probeBtn.addEventListener('click',()=>safe(probeDevice));
    els.readPhysicalBtn.addEventListener('click',()=>safe(readPhysicalLayer));els.readKeyboardLightsBtn?.addEventListener('click',()=>safe(()=>readLightGroup('keyboard')));els.readDotLightBtn?.addEventListener('click',()=>safe(()=>readLightGroup('dot')));els.addBlankFrameBtn.addEventListener('click',()=>addFrame(false));els.duplicateFrameBtn.addEventListener('click',()=>addFrame(true));els.deleteFrameBtn.addEventListener('click',deleteFrame);els.clearFrameBtn.addEventListener('click',()=>{frames[currentFrame]=blankFrame();renderPixelGrid();renderFrameList();});els.uploadMatrixBtn.addEventListener('click',()=>safe(uploadMatrix));els.playPreviewBtn.addEventListener('click',startPreview);
    els.scanMatrixBtn.addEventListener('click',()=>safe(scanMatrix));els.writeKeyBtn.addEventListener('click',()=>safe(writeSelectedKey));els.undoKeyBtn?.addEventListener('click',()=>safe(undoRemap));els.redoKeyBtn?.addEventListener('click',()=>safe(redoRemap));els.resetKeymapBtn?.addEventListener('click',()=>safe(resetLayer0FactoryKeys));els.cancelRemapBtn.addEventListener('click',clearPendingKeycode);els.useHexBtn.addEventListener('click',()=>safe(async()=>useHexAsPending()));els.keySearchInput.addEventListener('input',renderKeyPicker);els.clearLogBtn.addEventListener('click',()=>els.debugLog.textContent='');els.fpsSelect.addEventListener('change',()=>{if(previewTimer){stopPreview();startPreview();}});
    els.pixelGrid.addEventListener('contextmenu',e=>e.preventDefault());
    els.pixelGrid.addEventListener('pointerdown',e=>{const pixel=e.target.closest('.pixel');if(!pixel)return;e.preventDefault();matrixPaintMode=(e.button===2?'erase':'paint');matrixPaintLastIndex=-1;paintMatrixPixel(Number(pixel.dataset.index),matrixPaintMode);});
    els.pixelGrid.addEventListener('pointermove',e=>{if(!matrixPaintMode)return;const hit=document.elementFromPoint(e.clientX,e.clientY)?.closest?.('.pixel');if(hit&&els.pixelGrid.contains(hit))paintMatrixPixel(Number(hit.dataset.index),matrixPaintMode);});
    window.addEventListener('pointerup',finishMatrixStroke);window.addEventListener('pointercancel',finishMatrixStroke);
    els.rgbReadBtn.addEventListener('click',()=>safe(()=>runRgbExclusive('读取逐键 RGB', readPerKeyRgbFromKeyboard)));
    els.rgbSaveStaticBtn.addEventListener('click',()=>safe(()=>runRgbExclusive('写入静态 RGB', saveRgbStaticFrame)));
    els.rgbClearFrameBtn.addEventListener('click',clearRgbFrame);
    els.rgbFillBtn.addEventListener('click',()=>fillRgbFrame(els.rgbPaintColor.value));
    els.rgbNeutralBtn.addEventListener('click',()=>fillRgbFrame('#ffffff'));
    els.rgbPreviewBtn.addEventListener('click',toggleRgbPreview);
    els.rgbPreviewFps.addEventListener('change',()=>{if(rgbPreviewTimer){stopRgbPreview();toggleRgbPreview();}});
    els.rgbLiveBtn.addEventListener('click',()=>safe(toggleRgbLive));
    els.rgbAddFrameBtn.addEventListener('click',()=>addRgbFrame(false));
    els.rgbDuplicateFrameBtn.addEventListener('click',()=>addRgbFrame(true));
    els.rgbDeleteFrameBtn.addEventListener('click',deleteRgbFrame);
    els.rgbSetLedIndexBtn.addEventListener('click',()=>safe(async()=>saveRgbLedMapping()));
    els.rgbTestLedIndexBtn.addEventListener('click',()=>safe(()=>runRgbExclusive('测试 LED 索引', flashTestRgbIndex)));
    els.rgbResetLedMapBtn.addEventListener('click',()=>{if(confirm('恢复默认顺序映射 0…N？'))resetRgbLedMapping();});
    els.readMacrosBtn.addEventListener('click',()=>safe(readMacrosFromKeyboard));
    populateMacroKeyDatalist();
    els.importMacrosBtn.addEventListener('click',()=>els.macroFileInput.click());
    els.exportMacrosBtn.addEventListener('click',exportMacrosFile);
    els.macroFileInput.addEventListener('change',()=>{const f=els.macroFileInput.files?.[0];if(f)safe(()=>importMacrosFile(f));els.macroFileInput.value='';});
    els.saveMacrosBtn.addEventListener('click',()=>safe(saveMacrosToKeyboard));
    els.macroExpression.addEventListener('input',()=>{macroExpressions[activeMacro]=els.macroExpression.value;macroDirty=true;els.macroStatus.textContent='原始表达式已修改，尚未保存';renderMacroList();renderMacroTimeline();});
    els.macroAddDelayBtn.addEventListener('click',()=>openMacroActionEditor('insert',parseMacroVisual(macroExpressions[activeMacro]||'').length-1,'delay'));
    els.macroAddActionBtn.addEventListener('click',()=>openMacroActionEditor('insert',parseMacroVisual(macroExpressions[activeMacro]||'').length-1,'key'));
    els.macroActionTabs.addEventListener('click',e=>{const b=e.target.closest('[data-action-type]');if(b)setMacroActionType(b.dataset.actionType);});
    els.macroActionCloseBtn.addEventListener('click',closeMacroActionEditor);els.macroActionCancelBtn.addEventListener('click',closeMacroActionEditor);els.macroActionSaveBtn.addEventListener('click',()=>safe(commitMacroActionEditor));
    els.macroActionOverlay.addEventListener('mousedown',e=>{if(e.target===els.macroActionOverlay)closeMacroActionEditor();});
    [els.macroActionKeyName,els.macroActionDelay,els.macroActionText].forEach(el=>el?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();safe(commitMacroActionEditor);}else if(e.key==='Escape'){e.preventDefault();closeMacroActionEditor();}}));
    els.macroRecordBtn.addEventListener('click',toggleMacroRecording);els.macroStopOverlayBtn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();stopMacroRecording();});
    els.macroClearBtn.addEventListener('click',()=>{syncMacroExpression('');els.macroStatus.textContent='宏已清空，尚未保存到键盘';});
    els.exportProfileBtn.addEventListener('click',()=>safe(exportProfile));els.profileFileInput.addEventListener('change',()=>{const f=els.profileFileInput.files?.[0];if(f)safe(()=>loadProfileFile(f));});els.applyProfileBtn.addEventListener('click',()=>safe(applyProfile));
    els.readDeviceSettingsBtn.addEventListener('click',()=>safe(readDeviceSettings));els.saveMagicBtn.addEventListener('click',()=>safe(saveMagic));els.saveFeaturesBtn.addEventListener('click',()=>safe(saveFeatures));els.syncTimeBtn.addEventListener('click',()=>safe(syncKeyboardTime));els.connectMode.addEventListener('change',updateConnectActionAvailability);els.saveConnectModeBtn.addEventListener('click',()=>safe(saveConnectMode));els.clearCurrentBindBtn.addEventListener('click',()=>safe(()=>triggerConnectAction(3,'删除当前绑定')));els.clearAllBindsBtn.addEventListener('click',()=>safe(()=>triggerConnectAction(4,'删除全部蓝牙绑定')));els.receiverDfuBtn.addEventListener('click',()=>safe(()=>triggerConnectAction(5,'进入 2.4G Receiver DFU')));els.eepromResetBtn.addEventListener('click',()=>safe(eepromReset));
    if(navigator.hid)navigator.hid.addEventListener('disconnect',e=>{if(hidDevice===e.device){hidDevice=null;rgbLiveRunning=false;els.rgbLiveBtn.textContent='▶ 实时播放到键盘';setDot(els.hidDot,false);els.hidInfo.textContent='已断开';els.connectHidBtn.textContent='连接 HID';updateHistoryButtons();toast('HID 已断开',true);}});
    if(navigator.serial)navigator.serial.addEventListener('disconnect',()=>{serialPort=null;setDot(els.serialDot,false);els.serialInfo.textContent='已断开';els.connectSerialBtn.textContent='连接 CDC';els.cdcValue.textContent='待连接';});
  }

  async function autoReconnect(){
    try{const h=await findAuthorizedRawHid();if(h){if(!h.opened)await h.open();attachHid(h);await probeDevice();await readPhysicalLayer();}}catch(err){log('WARN',`HID 自动连接失败：${err.message}`);}
    try{const p=await findAuthorizedSerial();if(p)els.serialInfo.textContent='已授权 CDC，点击“连接 CDC”打开串口';}catch{}
  }

  function bindShellStatus(){
    const topDot=document.querySelector('.topbar-online-dot');
    const sideDot=document.querySelector('.sidebar-foot-dot');
    const sync=()=>{
      const hidOk=!!els.hidDot?.classList.contains('ok');
      const serialOk=!!els.serialDot?.classList.contains('ok');
      for(const dot of [topDot,sideDot]){
        if(!dot)continue;
        dot.classList.toggle('ok',hidOk||serialOk);
      }
    };
    const observer=new MutationObserver(sync);
    if(els.hidDot)observer.observe(els.hidDot,{attributes:true,attributeFilter:['class']});
    if(els.serialDot)observer.observe(els.serialDot,{attributes:true,attributeFilter:['class']});
    sync();
  }

  checkEnvironment();buildLightingUI();buildLayerTabs();buildPhysicalKeyboard();buildKeyCategories();renderKeyPicker();updateRemapButtons();renderPixelGrid();renderFrameList();ensureRgbState();buildRgbPalette();buildRgbKeyboard();renderRgbFrameList();renderMacroList();loadMacroEditor();tickClock();setInterval(tickClock,1000);bindUI();bindShellStatus();updateConnectActionAvailability();initAppearance().catch(err=>console.warn('Appearance init failed',err));autoReconnect();
})();
