/**
 * PreOwned Showroom Admin — serialized write gateway (Google Apps Script).
 *
 * Purpose: Google Sheets has no transactions. Competing critical writes
 * (payments, reservations, sale completion, delivery) must be serialized. This
 * Web App holds a shared LockService lock and applies an ordered list of
 * actions from the lock holder's point of view, then returns the resulting
 * records so the app can refresh its cache.
 *
 * IMPORTANT — this file must stay semantically identical to
 * src/lib/store/execute-actions.ts. Both execute the same CriticalAction[]
 * plans; the app is verified against the demo store, and this file is verified
 * against the same plans by tests/gateway-parity.test.ts, which loads this
 * source with mocked Apps Script globals. If you change action semantics in one
 * place, change both and re-run that test.
 *
 * Setup (see DEPLOYMENT.md):
 *  1. Open the application spreadsheet → Extensions → Apps Script.
 *  2. Paste this file. Save.
 *  3. Deploy → New deployment → type "Web app".
 *     - Execute as: Me (the sheet owner)
 *     - Who has access: Anyone (requests are authenticated below by HMAC)
 *  4. Copy the /exec URL into GATEWAY_URL.
 *  5. Set GATEWAY_HMAC_SECRET in the app env AND in Script Properties
 *     (Project Settings → Script Properties): key HMAC_SECRET, same value.
 */

var BASE_COLUMNS = ['id', 'createdAt', 'updatedAt', 'version', 'operationId', 'createdBy', 'updatedBy', 'archived'];

function doPost(e) {
  try {
    var body = e && e.postData && e.postData.contents;
    if (!body) return json_({ ok: false, error: 'Empty request', status: 400 });

    var req = verifyEnvelope_(body);
    if (!req) return json_({ ok: false, error: 'Invalid signature', status: 401 });
    if (!req.operationId || !Array.isArray(req.actions)) {
      return json_({ ok: false, error: 'operationId and actions are required', status: 400 });
    }

    // Serialize ALL competing critical writes through one shared lock.
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(30000)) {
      // Retryable: the app backs off and tries again.
      return json_({ ok: false, error: 'Gateway busy, try again', status: 503 });
    }
    try {
      // Idempotency: a replayed operationId returns the first result instead of
      // applying the writes twice. Checked INSIDE the lock so two concurrent
      // retries of the same operation cannot both pass.
      var prior = getCompletedOp_(req.operationId);
      if (prior) {
        return json_({ ok: true, operationId: req.operationId, replayed: true, results: prior });
      }
      var results = applyActions_(req);
      markCompletedOp_(req.operationId, results);
      return json_({ ok: true, operationId: req.operationId, results: results });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    var status = (err && err.gatewayStatus) || 500;
    return json_({ ok: false, error: String((err && err.message) || err), status: status });
  }
}

/** Envelope: base64url(payload) + "." + hmacHex(payload). */
function verifyEnvelope_(body) {
  var secret = PropertiesService.getScriptProperties().getProperty('HMAC_SECRET');
  if (!secret) throw fail_('HMAC_SECRET script property is not set', 500);

  var dot = body.lastIndexOf('.');
  if (dot < 0) return null;
  var b64 = body.slice(0, dot);
  var sig = body.slice(dot + 1);
  var payload = Utilities.newBlob(Utilities.base64DecodeWebSafe(b64)).getDataAsString();

  // The app signs the raw payload; compare against the same.
  var mac = Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_256, payload, secret);
  var expectedHex = mac.map(function (b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
  if (!constantTimeEquals_(expectedHex, sig)) return null;
  return JSON.parse(payload);
}

function constantTimeEquals_(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function fail_(message, status) {
  var e = new Error(message);
  e.gatewayStatus = status || 409;
  return e;
}

/**
 * Applies the action list. Mirrors executeActions() in the app:
 *  - createdIds is positionally aligned with actions (null for non-create).
 *  - refIds maps each create action's `as` name to its new id; services prefer
 *    this over positions, which shift when a plan gains an action.
 *  - "$ref:<name>" values resolve to the id of an earlier create with as:<name>.
 */
function applyActions_(req) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var now = new Date().toISOString();
  var createdIds = [];
  var updated = [];
  var refIds = {};

  for (var a = 0; a < req.actions.length; a++) {
    var action = req.actions[a];
    var sheet = ss.getSheetByName(action.table);
    if (!sheet) throw fail_('Unknown tab: ' + action.table, 500);

    if (action.type === 'assert') {
      var rows = readRows_(sheet).filter(function (r) { return !isTrue_(r.archived); });
      if (action.notExists) {
        var ne = action.notExists;
        var hit = rows.filter(function (r) {
          if (str_(r[ne.field]) !== str_(ne.equals)) return false;
          var ands = ne.and || [];
          for (var i = 0; i < ands.length; i++) {
            if (str_(r[ands[i].field]) !== str_(ands[i].equals)) return false;
          }
          if (ne.andNot && str_(r[ne.andNot.field]) === str_(ne.andNot.equals)) return false;
          return true;
        })[0];
        if (hit) throw fail_(action.message, action.status || 409);
      }
      if (action.exists) {
        var ex = action.exists;
        var found = rows.filter(function (r) {
          if (str_(r[ex.field]) !== str_(ex.equals)) return false;
          var ands = ex.and || [];
          for (var i = 0; i < ands.length; i++) {
            if (str_(r[ands[i].field]) !== str_(ands[i].equals)) return false;
          }
          return true;
        })[0];
        if (!found) throw fail_(action.message, action.status || 400);
      }
      createdIds.push(null);
      continue;
    }

    if (action.type === 'assert-field') {
      var fid = resolveRef_(action.id, refIds);
      var rowIdx = findRowById_(sheet, fid);
      if (rowIdx < 0) throw fail_(action.message, 404);
      var current = readRow_(sheet, rowIdx);
      var value = str_(current[action.field]);
      if (action.equals !== undefined && value !== str_(action.equals)) {
        throw fail_(action.message, action.status || 400);
      }
      if (action.notEquals !== undefined && value === str_(action.notEquals)) {
        throw fail_(action.message, action.status || 409);
      }
      if (action.notGreaterThan !== undefined && Number(value) > Number(action.notGreaterThan)) {
        throw fail_(action.message, action.status || 400);
      }
      createdIds.push(null);
      continue;
    }

    if (action.type === 'assert-sum') {
      var sumRows = readRows_(sheet).filter(function (r) { return !isTrue_(r.archived); });
      var terms = action.where || [];
      var exclude = action.excludeWhenSet || [];
      var total = 0;
      for (var s2 = 0; s2 < sumRows.length; s2++) {
        var rr = sumRows[s2];
        var matches = true;
        for (var t = 0; t < terms.length; t++) {
          if (str_(rr[terms[t].field]) !== str_(terms[t].equals)) { matches = false; break; }
        }
        if (matches) {
          for (var x = 0; x < exclude.length; x++) {
            if (str_(rr[exclude[x]]) !== '') { matches = false; break; }
          }
        }
        if (matches) total += Number(rr[action.field] || 0);
      }
      if (total + Number(action.plus) > Number(action.notGreaterThan)) {
        throw fail_(action.message, action.status || 400);
      }
      createdIds.push(null);
      continue;
    }

    if (action.type === 'create') {
      var headers = getHeaders_(sheet);
      var id = action.id || Utilities.getUuid();
      var data = resolveRefs_(action.data || {}, refIds);
      var row = headers.map(function (h) {
        if (h === 'id') return id;
        if (h === 'createdAt' || h === 'updatedAt') return now;
        if (h === 'version') return 1;
        if (h === 'operationId') return req.operationId;
        if (h === 'createdBy' || h === 'updatedBy') return req.actor;
        if (h === 'archived') return 'FALSE';
        var v = data[h];
        return v === undefined || v === null ? '' : v;
      });
      sheet.appendRow(row);
      createdIds.push(id);
      if (action.as) refIds[action.as] = id;
      continue;
    }

    if (action.type === 'update') {
      var uid = resolveRef_(action.id, refIds);
      if (!uid) throw fail_('update requires id', 400);
      var uIdx = findRowById_(sheet, uid);
      if (uIdx < 0) throw fail_('Row not found in ' + action.table + ' for id ' + uid, 404);
      var uHeaders = getHeaders_(sheet);
      var cur = sheet.getRange(uIdx, 1, 1, uHeaders.length).getValues()[0];
      var versionCol = uHeaders.indexOf('version');
      var curVersion = versionCol >= 0 ? Number(cur[versionCol]) : 0;
      if (action.expectedVersion !== undefined && curVersion !== Number(action.expectedVersion)) {
        throw fail_('This record was changed by someone else. Reload and try again.', 409);
      }
      var uData = resolveRefs_(action.data || {}, refIds);
      var newRow = uHeaders.map(function (h, i) {
        if (h === 'id') return uid;
        if (h === 'updatedAt') return now;
        if (h === 'version') return curVersion + 1;
        if (h === 'operationId') return req.operationId;
        if (h === 'updatedBy') return req.actor;
        if (Object.prototype.hasOwnProperty.call(uData, h)) return uData[h];
        return cur[i];
      });
      sheet.getRange(uIdx, 1, 1, newRow.length).setValues([newRow]);
      updated.push(rowToObject_(uHeaders, newRow));
      createdIds.push(null);
      continue;
    }

    if (action.type === 'archive') {
      var aid = resolveRef_(action.id, refIds);
      var aIdx = findRowById_(sheet, aid);
      if (aIdx < 0) throw fail_('Row not found in ' + action.table + ' for id ' + aid, 404);
      var aHeaders = getHeaders_(sheet);
      var aRow = sheet.getRange(aIdx, 1, 1, aHeaders.length).getValues()[0];
      var aCol = aHeaders.indexOf('archived');
      var vCol = aHeaders.indexOf('version');
      if (aCol >= 0) aRow[aCol] = 'TRUE';
      if (vCol >= 0) aRow[vCol] = Number(aRow[vCol]) + 1;
      var uAtCol = aHeaders.indexOf('updatedAt');
      if (uAtCol >= 0) aRow[uAtCol] = now;
      var uByCol = aHeaders.indexOf('updatedBy');
      if (uByCol >= 0) aRow[uByCol] = req.actor;
      sheet.getRange(aIdx, 1, 1, aRow.length).setValues([aRow]);
      updated.push(rowToObject_(aHeaders, aRow));
      createdIds.push(null);
      continue;
    }

    throw fail_('Unknown action type: ' + action.type, 400);
  }

  return { createdIds: createdIds, updated: updated, refIds: refIds };
}

/** ---------- helpers ---------- */

function str_(v) {
  return v === undefined || v === null ? '' : String(v);
}

function isTrue_(v) {
  return str_(v).toUpperCase() === 'TRUE';
}

function resolveRef_(value, refIds) {
  if (typeof value === 'string' && value.indexOf('$ref:') === 0) {
    var name = value.slice(5);
    if (!refIds[name]) throw fail_('Unresolved $ref "' + name + '" in critical write', 500);
    return refIds[name];
  }
  return value;
}

function resolveRefs_(data, refIds) {
  var out = {};
  Object.keys(data).forEach(function (k) {
    out[k] = resolveRef_(data[k], refIds);
  });
  return out;
}

function getHeaders_(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
}

function rowToObject_(headers, values) {
  var o = {};
  headers.forEach(function (h, i) {
    o[h] = values[i] === undefined || values[i] === null ? '' : String(values[i]);
  });
  return o;
}

function readRow_(sheet, rowIndex) {
  var headers = getHeaders_(sheet);
  return rowToObject_(headers, sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0]);
}

function readRows_(sheet) {
  var last = sheet.getLastRow();
  var headers = getHeaders_(sheet);
  if (last < 2) return [];
  var values = sheet.getRange(2, 1, last - 1, headers.length).getValues();
  return values.map(function (v) { return rowToObject_(headers, v); });
}

function findRowById_(sheet, id) {
  var last = sheet.getLastRow();
  if (last < 2) return -1;
  var ids = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2; // sheet row number
  }
  return -1;
}

/**
 * Idempotency store. Script Properties are capped (~9 KB per value, 500 KB
 * total), so only the compact result is kept and old entries are pruned.
 */
function getCompletedOp_(operationId) {
  var raw = PropertiesService.getScriptProperties().getProperty('op:' + operationId);
  if (!raw) return null;
  try {
    return JSON.parse(raw).results;
  } catch (err) {
    return null;
  }
}

function markCompletedOp_(operationId, results) {
  var props = PropertiesService.getScriptProperties();
  try {
    props.setProperty('op:' + operationId, JSON.stringify({ at: new Date().toISOString(), results: results }));
  } catch (err) {
    pruneOps_();
    try {
      props.setProperty('op:' + operationId, JSON.stringify({ at: new Date().toISOString(), results: results }));
    } catch (err2) {
      // Losing the idempotency marker must not fail a write that already
      // succeeded; the Operations tab remains the durable record.
    }
  }
}

/** Drops operation markers older than 7 days. */
function pruneOps_() {
  var props = PropertiesService.getScriptProperties();
  var all = props.getProperties();
  var cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  Object.keys(all).forEach(function (k) {
    if (k.indexOf('op:') !== 0) return;
    try {
      if (new Date(JSON.parse(all[k]).at).getTime() < cutoff) props.deleteProperty(k);
    } catch (err) {
      props.deleteProperty(k);
    }
  });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
