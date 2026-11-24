/**
- Genesora AI — waitlist backend WITH referral positions (OPTIONAL)
 *
- The website works without this. Until you add it, the live site shows
- "Spot saved ✓" plus the referral link, but no place-in-line number.
 *
- IMPORTANT: if your current script does other things (emails, formatting),
- MERGE these functions into it instead of replacing it.
 *
- Sheet header row (row 1), in this exact order:
-   Timestamp | Type | Name | Email | Detail1 | Detail2 | Country | RefCode | ReferredBy
 *
- How the line works: everyone is ordered by sign-up time, and each friend
- who joins through your link moves you up SPOTS_PER_REFERRAL places.
- Only rows whose Type starts with "User" count in the line.
 *
- After editing: Deploy > Manage deployments > edit > New version.
 */

var SHEET_NAME = 'Sheet1';
var SPOTS_PER_REFERRAL = 5;

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet_() {
  var ss = SpreadsheetApp.getActive();
  return ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
}

function verifyTurnstile_(token) {
  if (!token) return false;
  var secret = PropertiesService.getScriptProperties().getProperty('TURNSTILE_SECRET');
  if (!secret) throw new Error('TURNSTILE_SECRET is not set in Script Properties');

  var res = UrlFetchApp.fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'post',
    payload: {
      secret: secret,
      response: String(token)
    },
    muteHttpExceptions: true
  });
  var data = JSON.parse(res.getContentText());
  return Boolean(data && data.success);
}

function doPost(e) {
  var p = (e && e.parameter) || {};

  try {
    if (!verifyTurnstile_(p.turnstileToken)) {
      return json_({ status: 'error', message: 'Human verification failed. Please try again.' });
    }
  } catch (err) {
    return json_({ status: 'error', message: String(err) });
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sh = getSheet_();
    var email = String(p.email || '').trim().toLowerCase();
    var code = String(p.refCode || '').trim().toUpperCase();
    var ref = String(p.ref || '').trim().toUpperCase();
    var rows = sh.getDataRange().getValues();

    // Same email twice? Return the existing spot instead of adding a duplicate.
    if (email) {
      for (var i = 1; i < rows.length; i++) {
        if (String(rows[i][3]).toLowerCase() === email) {
          var existing = String(rows[i][7] || '');
          return json_(merge_({ status: 'success', refCode: existing }, stats_(rows, existing)));
        }
      }
    }

    if (ref === code) ref = '';           // no self-referrals
    if (ref && !codeExists_(rows, ref)) ref = ''; // ignore unknown codes

    sh.appendRow([new Date(), p.type || '', p.name || '', email, p.detail1 || '', p.detail2 || '', p.country || '', code, ref]);
    SpreadsheetApp.flush();

    rows = sh.getDataRange().getValues();
    return json_(merge_({ status: 'success', refCode: code }, stats_(rows, code)));
  } catch (err) {
    return json_({ status: 'error', message: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// GET ?action=status&code=ABC-1234  ->  { ok, position, total, referrals }
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === 'status') {
    var code = String(p.code || '').trim().toUpperCase();
    var s = stats_(getSheet_().getDataRange().getValues(), code);
    return json_(s.position ? merge_({ ok: true }, s) : { ok: false });
  }
  return json_({ ok: true });
}

function merge_(a, b) { for (var k in b) a[k] = b[k]; return a; }

function isUser_(row) { return String(row[1]).toLowerCase().indexOf('user') === 0; }

function codeExists_(rows, code) {
  for (var i = 1; i < rows.length; i++) if (String(rows[i][7]).toUpperCase() === code) return true;
  return false;
}

function stats_(rows, code) {
  if (!code) return {};
  var refCounts = {}, entries = [], mine = null;
  for (var i = 1; i < rows.length; i++) {
    if (!isUser_(rows[i])) continue;
    var c = String(rows[i][7]).toUpperCase();
    var by = String(rows[i][8]).toUpperCase();
    if (by) refCounts[by] = (refCounts[by] || 0) + 1;
    entries.push({ code: c, order: i });
  }
  entries.forEach(function (en) {
    en.refs = refCounts[en.code] || 0;
    en.eff = en.order - SPOTS_PER_REFERRAL * en.refs;
    if (en.code === code) mine = en;
  });
  if (!mine) return {};
  var position = 1;
  entries.forEach(function (en) {
    if (en === mine) return;
    if (en.eff < mine.eff || (en.eff === mine.eff && en.order < mine.order)) position++;
  });
  return { position: position, total: entries.length, referrals: mine.refs };
}