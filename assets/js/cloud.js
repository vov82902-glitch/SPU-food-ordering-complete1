/* ==========================================================
   cloud.js — ซิงก์ข้อมูลกับ Firebase Firestore

   ทำงานยังไง:
   1) โหลด Firebase แล้วดึงข้อมูลล่าสุดจาก Firestore มาเก็บใน localStorage
   2) จากนั้นค่อยโหลดสคริปต์ของหน้า (main.js + สคริปต์หน้านั้น)
      -> โค้ดเดิมที่อ่าน localStorage ใช้งานได้เหมือนเดิม
   3) ฟังการเปลี่ยนแปลงแบบ real-time: มีคนอื่นแก้ข้อมูล -> อัปเดต localStorage ให้ทันที
   4) ตอนบันทึก (saveOrders ฯลฯ ใน main.js) จะเรียก cloudSave() ส่งเฉพาะส่วนที่เปลี่ยนขึ้น Firestore

   วิธีใช้ในหน้า HTML (แทนการโหลด main.js ตรงๆ):
   <script src="assets/js/cloud.js" data-load="assets/js/main.js assets/js/login.js"></script>

   ข้อมูลที่ซิงก์ (localStorage key -> collection ใน Firestore)
   food_orders   -> orders        (1 ออเดอร์ = 1 document)
   food_students -> students      (1 นักศึกษา = 1 document, id = รหัสนักศึกษา)
   food_stores   -> storeConfigs  (ตั้งค่าร้าน 1 ร้าน = 1 document)
   food_data     -> floors / stores / menus (แยกเก็บ เพราะ 1 document ใหญ่ได้ไม่เกิน 1MB)

   ข้อมูลที่ "ไม่" ซิงก์ (เป็นของแต่ละเครื่อง): food_user, food_cart, food_tries
========================================================== */

(function () {
    const FIREBASE_VERSION = '10.12.2';
    const firebaseConfig = {
        apiKey: 'AIzaSyCa90Ja6UBUMtfJcXq47m_H1WZdlnBgPn8',
        authDomain: 'spu-food-ee25a.firebaseapp.com',
        projectId: 'spu-food-ee25a',
        storageBucket: 'spu-food-ee25a.firebasestorage.app',
        messagingSenderId: '526098006581',
        appId: '1:526098006581:web:bba7da240d253e1803a77c'
    };
    const FIRST_LOAD_TIMEOUT = 8000;   // รอเซิร์ฟเวอร์นานสุดกี่ ms ก่อนใช้ข้อมูลที่มีในเครื่อง

    const thisScript = document.currentScript;
    const pageScripts = (thisScript.dataset.load || '').split(/\s+/).filter(Boolean);

    /* ---------- แปลงข้อมูล localStorage <-> documents ---------- */
    function clean(value) {                       // Firestore ไม่รับ undefined
        return JSON.parse(JSON.stringify(value));
    }
    function listToMap(list, idOf) {
        let map = {};
        list.forEach(function (item, i) { map[idOf(item, i)] = clean(item); });
        return map;
    }
    function byIndex(a, b) { return (a._i || 0) - (b._i || 0); }
    function values(map) { return Object.keys(map || {}).map(function (id) { return map[id]; }); }
    function isEmpty(map) { return !map || Object.keys(map).length === 0; }

    const KEYS = {
        food_orders: {
            cols: ['orders'],
            toDocs: function (orders) {
                return { orders: listToMap(orders || [], function (o, i) { return String(o.id || 'x' + i); }) };
            },
            fromDocs: function (d) {
                if (isEmpty(d.orders)) return null;
                return values(d.orders).sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
            }
        },
        food_students: {
            cols: ['students'],
            toDocs: function (list) { return { students: clean(list || {}) }; },
            fromDocs: function (d) { return isEmpty(d.students) ? null : d.students; }
        },
        food_stores: {
            cols: ['storeConfigs'],
            toDocs: function (configs) { return { storeConfigs: clean(configs || {}) }; },
            fromDocs: function (d) { return isEmpty(d.storeConfigs) ? null : d.storeConfigs; }
        },
        food_data: {
            cols: ['floors', 'stores', 'menus'],
            toDocs: function (floors) {
                let out = { floors: {}, stores: {}, menus: {} };
                (floors || []).forEach(function (floor, fi) {
                    let f = clean(floor);
                    delete f.stores;
                    f._i = fi;
                    out.floors[String(floor.id)] = f;
                    (floor.stores || []).forEach(function (store, si) {
                        let s = clean(store);
                        delete s.menus; delete s.floorId; delete s.floorName;
                        s._floor = floor.id;
                        s._i = si;
                        out.stores[String(store.id)] = s;
                        (store.menus || []).forEach(function (menu, mi) {
                            let m = clean(menu);
                            m._store = store.id;
                            m._i = mi;
                            out.menus[store.id + '_' + (menu.id != null ? menu.id : 'i' + mi)] = m;
                        });
                    });
                });
                return out;
            },
            fromDocs: function (d) {
                if (isEmpty(d.floors)) return null;
                let stores = values(d.stores);
                let menus = values(d.menus);
                return values(d.floors).sort(byIndex).map(function (f) {
                    let floor = Object.assign({}, f);
                    delete floor._i;
                    floor.stores = stores.filter(function (s) { return s._floor === f.id; }).sort(byIndex).map(function (s) {
                        let store = Object.assign({}, s);
                        delete store._floor; delete store._i;
                        store.menus = menus.filter(function (m) { return m._store === s.id; }).sort(byIndex).map(function (m) {
                            let menu = Object.assign({}, m);
                            delete menu._store; delete menu._i;
                            return menu;
                        });
                        return store;
                    });
                    return floor;
                });
            }
        }
    };

    // JSON ที่เรียง key เสมอ ใช้เทียบว่าข้อมูลเปลี่ยนไหม (Firestore ไม่รับประกันลำดับ field)
    function stable(value) {
        if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
        if (value && typeof value === 'object') {
            return '{' + Object.keys(value).sort().map(function (k) {
                return JSON.stringify(k) + ':' + stable(value[k]);
            }).join(',') + '}';
        }
        return JSON.stringify(value);
    }

    /* ---------- สถานะที่รู้ล่าสุดจาก Firestore ---------- */
    let db = null;
    let cloudData = {};    // { collection: { docId: data } }
    let cloudText = {};    // { collection: { docId: stable(data) } }
    let pending = [];      // งานบันทึกที่ยังส่งไม่เสร็จ

    // เอาข้อมูลจาก Firestore ไปเขียนลง localStorage ของ key นี้
    function writeLocal(key) {
        let spec = KEYS[key];
        let docs = {};
        spec.cols.forEach(function (col) { docs[col] = cloudData[col] || {}; });
        let value = spec.fromDocs(docs);
        let raw = value == null ? null : JSON.stringify(value);
        if (raw === localStorage.getItem(key)) return;
        try {
            if (raw == null) localStorage.removeItem(key);
            else localStorage.setItem(key, raw);
        } catch (e) {
            console.error('[cloud] เขียน localStorage ไม่ได้', key, e);
            return;
        }
        // แจ้งหน้าเว็บว่าข้อมูลเปลี่ยน (หน้าร้าน/หน้าคิวฟัง event นี้อยู่แล้ว)
        try { window.dispatchEvent(new StorageEvent('storage', { key: key })); } catch (e) { /* เบราว์เซอร์เก่า */ }
    }

    function applySnapshot(col, snap) {
        let data = {}, text = {};
        snap.docs.forEach(function (doc) {
            data[doc.id] = doc.data();
            text[doc.id] = stable(data[doc.id]);
        });
        cloudData[col] = data;
        cloudText[col] = text;
        Object.keys(KEYS).forEach(function (key) {
            if (KEYS[key].cols.indexOf(col) !== -1) writeLocal(key);
        });
    }

    /* ---------- บันทึกขึ้น Firestore (เรียกจาก main.js) ---------- */
    window.cloudSave = function (key, value) {
        let spec = KEYS[key];
        if (!spec || !db) return;
        let docs = spec.toDocs(value);
        let ops = [];
        spec.cols.forEach(function (col) {
            let next = docs[col] || {};
            let prevText = cloudText[col] || {};
            cloudData[col] = cloudData[col] || {};
            cloudText[col] = cloudText[col] || {};
            Object.keys(next).forEach(function (id) {
                let t = stable(next[id]);
                if (prevText[id] === t) return;               // ไม่ได้เปลี่ยน ไม่ต้องส่ง
                ops.push({ col: col, id: id, data: next[id] });
                cloudData[col][id] = next[id];
                cloudText[col][id] = t;
            });
            Object.keys(prevText).forEach(function (id) {
                if (id in next) return;
                ops.push({ col: col, id: id, remove: true });  // ถูกลบออกจากข้อมูล -> ลบใน Firestore
                delete cloudData[col][id];
                delete cloudText[col][id];
            });
        });
        // Firestore ส่งได้ครั้งละไม่เกิน 500 รายการ
        for (let i = 0; i < ops.length; i += 400) {
            let batch = db.batch();
            ops.slice(i, i + 400).forEach(function (op) {
                let ref = db.collection(op.col).doc(op.id);
                if (op.remove) batch.delete(ref); else batch.set(ref, op.data);
            });
            let job = batch.commit().catch(function (err) {
                console.error('[cloud] บันทึกไม่สำเร็จ', err);
                if (typeof showToast === 'function') showToast('บันทึกขึ้นระบบไม่สำเร็จ: ' + esc(err.message), 'bad');
            });
            pending.push(job);
            job.then(function () { pending.splice(pending.indexOf(job), 1); });
        }
    };

    // รอให้บันทึกเสร็จก่อนเปลี่ยนหน้า (ไม่งั้นข้อมูลอาจส่งไม่ทัน)
    window.cloudGo = function (url) {
        let timeout = new Promise(function (resolve) { setTimeout(resolve, 5000); });
        Promise.race([Promise.all(pending.slice()), timeout]).then(function () { location.href = url; });
    };

    /* ---------- หน้าจอระหว่างโหลด ---------- */
    let cover = document.createElement('div');
    cover.id = 'cloud-loading';
    cover.textContent = 'กำลังโหลดข้อมูล...';
    cover.style.cssText = 'position:fixed;inset:0;z-index:9999;display:grid;place-items:center;' +
        'background:rgba(255,255,255,0.85);font:600 16px Sarabun,system-ui,sans-serif;color:#555';
    (document.body || document.documentElement).appendChild(cover);

    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            let s = document.createElement('script');
            s.src = src;
            s.async = false;
            s.onload = resolve;
            s.onerror = function () { reject(new Error('โหลด ' + src + ' ไม่ได้')); };
            document.body.appendChild(s);
        });
    }

    function startPage(note) {
        return pageScripts.reduce(function (p, src) {
            return p.then(function () { return loadScript(src); });
        }, Promise.resolve()).then(function () {
            cover.remove();
            if (note && typeof showToast === 'function') showToast(note, 'bad');
        });
    }

    // ดึงข้อมูลครั้งแรก + ฟังการเปลี่ยนแปลงตลอด
    function connect() {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        // เก็บแคชในเครื่อง: งานที่ยังส่งไม่เสร็จจะถูกส่งต่อแม้เปลี่ยนหน้า
        return db.enablePersistence({ synchronizeTabs: true }).catch(function (err) {
            console.warn('[cloud] ใช้แคชในเครื่องไม่ได้', err.code);
        }).then(function () {
            let cols = [];
            Object.keys(KEYS).forEach(function (key) { cols = cols.concat(KEYS[key].cols); });
            let waiting = cols.length;
            return new Promise(function (resolve) {
                cols.forEach(function (col) {
                    let fresh = false;
                    db.collection(col).onSnapshot({ includeMetadataChanges: true }, function (snap) {
                        applySnapshot(col, snap);
                        // ครั้งแรกรอข้อมูลจากเซิร์ฟเวอร์ (ไม่ใช่แคชเก่าในเครื่อง)
                        if (!fresh && !snap.metadata.fromCache) {
                            fresh = true;
                            if (--waiting === 0) resolve();
                        }
                    }, function (err) {
                        console.error('[cloud] อ่าน ' + col + ' ไม่ได้', err);
                        if (!fresh) { fresh = true; if (--waiting === 0) resolve(); }
                    });
                });
            });
        });
    }

    let base = 'https://www.gstatic.com/firebasejs/' + FIREBASE_VERSION + '/';
    let timedOut = false;
    let timer = new Promise(function (resolve) {
        setTimeout(function () { timedOut = true; resolve(); }, FIRST_LOAD_TIMEOUT);
    });

    loadScript(base + 'firebase-app-compat.js')
        .then(function () { return loadScript(base + 'firebase-firestore-compat.js'); })
        .then(function () { return Promise.race([connect(), timer]); })
        .then(function () {
            return timedOut ? 'เชื่อมต่อเซิร์ฟเวอร์ช้า กำลังใช้ข้อมูลในเครื่อง' : '';
        }, function (err) {
            console.error('[cloud]', err);
            return 'เชื่อมต่อระบบไม่ได้ ตรวจสอบอินเทอร์เน็ต';
        })
        .then(startPage)
        .catch(function (err) {
            console.error('[cloud]', err);
            cover.textContent = 'โหลดหน้าไม่สำเร็จ ลองรีเฟรชหน้าเว็บ';
        });
})();
